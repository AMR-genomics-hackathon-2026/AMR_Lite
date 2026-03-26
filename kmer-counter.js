/**
 * WebR K-mer Counting Module
 * Uses R's kmer package via WebR for efficient k-mer counting
 */

import { getWebR, isWebRReady, logWebRStatus } from './webr-init.js';

let kmerPackageInstalled = false;

/**
 * Install kmer R package if not already installed
 * Caches installation status for the session
 */
async function ensureKmerPackage() {
  if (kmerPackageInstalled) {
    logWebRStatus('kmer package already installed (cached)', 'info');
    return true;
  }

  try {
    const webR = getWebR();
    
    logWebRStatus('Checking kmer package...', 'info');
    
    // Check if already installed
    const checkResult = await webR.evalR(`requireNamespace("kmer", quietly=TRUE)`);
    const isInstalled = await checkResult.toBoolean();
    
    if (isInstalled) {
      logWebRStatus('kmer package already available', 'success');
      kmerPackageInstalled = true;
      return true;
    }
    
    // Install kmer package
    logWebRStatus('Installing kmer package from CRAN (this may take 1-2 minutes)...', 'info');
    
    const installResult = await webR.evalR(`
      tryCatch({
        install.packages("kmer", repos="https://cran.r-project.org")
        TRUE
      }, error = function(e) {
        message(paste("Install failed:", e$message))
        FALSE
      })
    `);
    
    const success = await installResult.toBoolean();
    
    if (success) {
      logWebRStatus('kmer package installed successfully', 'success');
      kmerPackageInstalled = true;
      return true;
    } else {
      logWebRStatus('Failed to install kmer package', 'error');
      return false;
    }
  } catch (err) {
    logWebRStatus(`Error ensuring kmer package: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Write FASTA sequences to WebR filesystem
 * @param {Array<{header: string, seq: string}>} sequences
 * @returns {Promise<string>} Path to written file
 */
async function writeFastaToWebR(sequences) {
  try {
    const webR = getWebR();
    
    // Build FASTA content
    let fastaContent = '';
    for (const seq of sequences) {
      fastaContent += `>${seq.header}\n${seq.seq}\n`;
    }
    
    logWebRStatus(`Writing ${sequences.length} sequences to WebR FS...`, 'info');
    
    // Write to WebR filesystem
    const path = '/work/query.fa';
    await webR.FS.writeFile(path, fastaContent);
    
    logWebRStatus(`Wrote ${fastaContent.length} bytes to ${path}`, 'info');
    return path;
  } catch (err) {
    throw new Error(`Failed to write FASTA to WebR FS: ${err.message}`);
  }
}

/**
 * Count k-mers using R's kmer package
 * @param {Array<{header: string, seq: string}>} sequences - FASTA sequences
 * @param {number} k - K-mer size (default 21)
 * @param {boolean} canonical - Use canonical k-mers (default true)
 * @returns {Promise<Array<{kmer: string, count: number}>>} Array of k-mer counts
 */
export async function countKmersWithR(sequences, k = 21, canonical = true) {
  if (!isWebRReady()) {
    throw new Error('WebR is not ready. Initialize WebR first.');
  }

  if (!sequences || sequences.length === 0) {
    throw new Error('No sequences provided');
  }

  const totalBp = sequences.reduce((sum, s) => sum + s.seq.length, 0);
  const maxBp = 50_000_000; // 50 Mbp limit for browser safety

  if (totalBp > maxBp) {
    throw new Error(
      `Genome too large for browser k-mer counting: ${(totalBp / 1_000_000).toFixed(1)} Mbp exceeds ${maxBp / 1_000_000} Mbp limit. ` +
      `Please use smaller inputs or run on a server.`
    );
  }

  try {
    // Ensure kmer package is installed
    const installed = await ensureKmerPackage();
    if (!installed) {
      throw new Error('kmer package could not be installed');
    }

    // Write FASTA to WebR FS
    const fastaPath = await writeFastaToWebR(sequences);

    const webR = getWebR();
    logWebRStatus(`Counting ${k}-mers (canonical=${canonical}) for ${totalBp.toLocaleString()} bp...`, 'info');

    // Run kmer::kcount
    const rCode = `
      tryCatch({
        kmer::kcount(
          reads = "${fastaPath}",
          k = ${k},
          canonical = ${canonical ? 'TRUE' : 'FALSE'}
        )
      }, error = function(e) {
        list(error = paste("kmer::kcount failed:", e$message))
      })
    `;

    logWebRStatus('Running kmer::kcount in R...', 'info');
    const result = await webR.evalR(rCode);
    const resultObj = await result.toObject();

    // Check for errors
    if (resultObj.error) {
      throw new Error(resultObj.error);
    }

    // Extract k-mers and counts from result
    logWebRStatus('Extracting k-mer results from R...', 'info');
    
    const kmers = await result.toArray();
    
    // Convert to array of {kmer, count}
    const kmerArray = [];
    for (const kmer of kmers) {
      const kmerStr = await kmer.toString();
      const count = await kmer.toNumber ? await kmer.toNumber() : 1;
      kmerArray.push({
        kmer: kmerStr,
        count,
      });
    }

    logWebRStatus(`Extracted ${kmerArray.length} unique k-mers`, 'success');
    return kmerArray;
  } catch (err) {
    // Handle memory errors gracefully
    if (err.message.includes('memory') || err.message.includes('Memory')) {
      logWebRStatus(
        'Memory error: Genome may be too large for browser. Try splitting into smaller files or use server-based analysis.',
        'error'
      );
      throw new Error(
        'Memory limit exceeded. Please use a smaller genome or increase browser memory allocation.'
      );
    }

    logWebRStatus(`K-mer counting error: ${err.message}`, 'error');
    throw err;
  }
}

/**
 * Get session k-mer package installation status
 */
export function isKmerInstalled() {
  return kmerPackageInstalled;
}
