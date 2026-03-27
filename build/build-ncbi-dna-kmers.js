#!/usr/bin/env node

import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';

/**
 * NCBI AMRFinderPlus AMR_CDS.fa Parser & DNA K-mer Database Builder
 * Builds k-mer signatures from DNA coding sequences
 * 
 * This is the CORRECT approach for genome matching:
 * - Users upload genome contigs (DNA/nucleotide sequences)
 * - We extract k-mers from coding DNA sequences
 * - Match genomic k-mers against the database
 */

/**
 * Parse NCBI AMR_CDS.fa header format
 * >node_id|prot_acc|dna_acc|part|total_parts|gene_symbol|allele|gene_name source_coordinates
 */
function parseNCBIHeader(header) {
  const parts = header.substring(1).split('|'); // Remove '>', split by pipes
  
  return {
    node_id: parts[0] || '',
    protein_accession: parts[1] || '',
    dna_accession: parts[2] || '',
    part_num: parts[3] || '1',
    total_parts: parts[4] || '1',
    gene_symbol: parts[5] || '',
    allele_symbol: parts[6] || '',
    gene_name: (parts[7] || '').replace(/_/g, ' '),
  };
}

/**
 * Extract k-mers from DNA sequence (codons)
 * Standard genomic k-mer size is 21 bp
 */
function extractDNAKmers(sequence, k = 21) {
  const kmers = new Set();
  const seq = sequence.toUpperCase().replace(/[^ACGT]/g, ''); // DNA only
  
  // Skip if still too short
  if (seq.length < k) {
    return [];
  }
  
  // Extract overlapping k-mers
  for (let i = 0; i <= seq.length - k; i++) {
    const kmer = seq.substring(i, i + k);
    if (kmer.length === k && !/N/i.test(kmer)) {
      kmers.add(kmer);
    }
  }
  
  return Array.from(kmers);
}

/**
 * Parse FASTA file and extract records
 */
async function parseFastaFile(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    let currentHeader = '';
    let currentSeq = '';
    let recordCount = 0;

    const lineReader = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    lineReader.on('line', (line) => {
      if (line.startsWith('>')) {
        // Save previous record
        if (currentHeader && currentSeq) {
          records.push({
            header: currentHeader,
            sequence: currentSeq,
            length: currentSeq.length,
            metadata: parseNCBIHeader(currentHeader)
          });
          recordCount++;
          if (recordCount % 1000 === 0) {
            process.stdout.write(`  Parsed: ${recordCount} sequences...\r`);
          }
        }
        currentHeader = line;
        currentSeq = '';
      } else if (line.trim()) {
        currentSeq += line.trim();
      }
    });

    lineReader.on('close', () => {
      // Save last record
      if (currentHeader && currentSeq) {
        records.push({
          header: currentHeader,
          sequence: currentSeq,
          length: currentSeq.length,
          metadata: parseNCBIHeader(currentHeader)
        });
      }
      console.log(`  ✓ Parsed: ${records.length} sequences`);
      resolve(records);
    });

    lineReader.on('error', reject);
  });
}

/**
 * Build signature from DNA sequence
 */
function buildSignature(record, kmerSize = 21) {
  const meta = record.metadata;
  
  const kmers = extractDNAKmers(record.sequence, kmerSize);
  
  // Infer resistance class from gene symbol (simplified)
  let resistanceClass = 'UNKNOWN';
  const symbol = meta.gene_symbol.toLowerCase();
  
  if (symbol.includes('bla')) resistanceClass = 'BETA-LACTAM';
  else if (symbol.includes('tet')) resistanceClass = 'TETRACYCLINE';
  else if (symbol.includes('macr') || symbol.includes('erm')) resistanceClass = 'MACROLIDE';
  else if (symbol.includes('qnr') || symbol.includes('oqx')) resistanceClass = 'FLUOROQUINOLONE';
  else if (symbol.includes('aad') || symbol.includes('aph')) resistanceClass = 'AMINOGLYCOSIDE';
  else if (symbol.includes('van')) resistanceClass = 'GLYCOPEPTIDE';
  else if (symbol.includes('cat')) resistanceClass = 'CHLORAMPHENICOL';
  else if (symbol.includes('fos')) resistanceClass = 'FOSFOMYCIN';
  else if (symbol.includes('stx')) resistanceClass = 'VIRULENCE_TOXIN';
  else if (symbol.includes('est')) resistanceClass = 'TOXIN';
  
  return {
    gene_id: meta.gene_symbol || meta.protein_accession,
    accession: meta.protein_accession,
    dna_accession: meta.dna_accession,
    name: meta.gene_name || meta.gene_symbol,
    organism: 'Multiple (NCBI Reference)',
    mechanism: resistanceClass,
    class: resistanceClass,
    length_bp: record.length,
    k: kmerSize,
    n_kmers: kmers.length,
    kmers: kmers,
    phenotype_note: 'Genotype only; phenotype prediction not supported - DNA k-mer matching',
  };
}

/**
 * Write database to gzipped JSON
 */
async function writeDatabaseGz(signatures, outputPath) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(signatures, null, 2);
    
    const file = fs.createWriteStream(outputPath);
    const gzip = zlib.createGzip();
    
    gzip.on('error', reject);
    file.on('error', reject);
    file.on('finish', resolve);
    
    gzip.pipe(file);
    gzip.write(data);
    gzip.end();
  });
}

/**
 * Main builder function
 */
async function buildDatabase(inputPath, outputPath, kmerSize = 21) {
  console.log('\n=== NCBI AMRFinderPlus DNA K-mer Database Builder ===\n');
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`K-mer size: ${kmerSize} bp (DNA)`);
  console.log();

  try {
    // Parse FASTA
    console.log('Parsing AMR_CDS.fa file...');
    const records = await parseFastaFile(inputPath);
    console.log();

    // Build signatures
    console.log('Building DNA k-mer signatures...');
    const signatures = [];
    let skipped = 0;
    let totalKmers = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        // Skip short sequences
        if (record.sequence.length < kmerSize) {
          skipped++;
          continue;
        }
        
        const sig = buildSignature(record, kmerSize);
        if (sig.kmers.length > 0) {
          signatures.push(sig);
          totalKmers += sig.kmers.length;
        }
      } catch (err) {
        skipped++;
      }

      if ((i + 1) % 1000 === 0) {
        process.stdout.write(`  Built: ${signatures.length} signatures...\r`);
      }
    }

    console.log(`  ✓ Total signatures: ${signatures.length}`);
    console.log(`  ✓ Skipped: ${skipped}`);

    // Calculate statistics
    const avgKmers = Math.round(totalKmers / signatures.length);
    const kmersPerGene = signatures.map(s => s.n_kmers);
    const minKmers = Math.min(...kmersPerGene);
    const maxKmers = Math.max(...kmersPerGene);

    console.log('\nStatistics:');
    console.log(`  Total k-mers: ${totalKmers.toLocaleString()}`);
    console.log(`  Avg k-mers/gene: ${avgKmers}`);
    console.log(`  Min k-mers: ${minKmers}`);
    console.log(`  Max k-mers: ${maxKmers}`);

    // Class distribution
    const classes = {};
    signatures.forEach(s => {
      classes[s.class] = (classes[s.class] || 0) + 1;
    });
    
    console.log('\nResistance Classes (top 10):');
    const sortedClasses = Object.entries(classes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    sortedClasses.forEach(([cls, count]) => {
      console.log(`  ${cls.padEnd(25)}: ${count.toString().padStart(4)} genes`);
    });

    // Write database
    console.log(`\nWriting to: ${outputPath}`);
    process.stdout.write('  Compressing...');
    await writeDatabaseGz(signatures, outputPath);
    
    const stats = fs.statSync(outputPath);
    console.log('\r  ✓ Compressed.');
    console.log(`  File size: ${(stats.size / 1024 / 1024).toFixed(1)} MB\n`);

    console.log('✅ Database build complete!\n');
    return signatures.length;

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  let inputPath = 'data/AMR_CDS.fa';
  let outputPath = 'data/amr_signatures.json.gz';
  let kmerSize = 21; // Standard genomic k-mer size

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') inputPath = args[++i];
    if (args[i] === '--output') outputPath = args[++i];
    if (args[i] === '--k') kmerSize = parseInt(args[++i]) || 21;
  }

  await buildDatabase(inputPath, outputPath, kmerSize);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
