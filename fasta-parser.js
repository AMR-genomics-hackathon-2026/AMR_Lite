/**
 * FASTA Parser Module
 * Robust multi-FASTA parser with stats calculation
 * Pure functions for testability
 */

/**
 * IUPAC ambiguity codes (DNA/RNA)
 * Maps to uppercase
 */
const IUPAC_DNA = /^[ACGTRYSWKMBDHVN-]+$/i;

/**
 * Calculate total base pairs from sequence array
 * @param {Array<{header: string, seq: string}>} sequences
 * @returns {number} Total base pairs
 */
export function calcTotalBp(sequences) {
  return sequences.reduce((sum, seq) => sum + seq.seq.length, 0);
}

/**
 * Calculate N50 from sequence array
 * N50 = contig length at which 50% of total bases are in contigs of that length or longer
 * @param {Array<{header: string, seq: string}>} sequences
 * @returns {number} N50 value (0 if no sequences)
 */
export function calcN50(sequences) {
  if (!sequences || sequences.length === 0) return 0;
  
  // Get sorted lengths (descending)
  const lengths = sequences.map(s => s.seq.length).sort((a, b) => b - a);
  
  // Calculate total
  const total = lengths.reduce((sum, len) => sum + len, 0);
  if (total === 0) return 0;
  
  // Find cumulative sum at 50%
  const halfTotal = total / 2;
  let cumSum = 0;
  
  for (const len of lengths) {
    cumSum += len;
    if (cumSum >= halfTotal) {
      return len;
    }
  }
  
  return 0;
}

/**
 * Normalize sequence to uppercase IUPAC
 * @param {string} seq - Raw sequence
 * @returns {string} Uppercase sequence
 */
function normalizeSequence(seq) {
  return seq.toUpperCase();
}

/**
 * Validate sequence contains only IUPAC characters
 * @param {string} seq - Sequence to validate
 * @returns {boolean} True if valid IUPAC
 */
export function isValidIUPAC(seq) {
  return IUPAC_DNA.test(seq);
}

/**
 * Parse FASTA record (header + sequence)
 * @param {string} fastaText - Full FASTA content
 * @returns {Array<{header: string, seq: string}>} Array of sequences
 */
export function parseFastaText(fastaText) {
  const sequences = [];
  const lines = fastaText.split('\n');
  
  let currentHeader = null;
  let currentSeq = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip blank lines and comments
    if (!line) continue;
    if (line.startsWith(';')) continue;
    
    if (line.startsWith('>')) {
      // Save previous sequence if exists
      if (currentHeader !== null && currentSeq.length > 0) {
        sequences.push({
          header: currentHeader,
          seq: normalizeSequence(currentSeq),
        });
      }
      
      // Start new sequence
      currentHeader = line.substring(1).trim(); // Remove '>' and trim
      currentSeq = '';
    } else {
      // Append to current sequence
      currentSeq += line;
    }
  }
  
  // Save last sequence
  if (currentHeader !== null && currentSeq.length > 0) {
    sequences.push({
      header: currentHeader,
      seq: normalizeSequence(currentSeq),
    });
  }
  
  return sequences;
}

/**
 * Parse FASTA file (handles .gz and .txt)
 * @param {File} file - FASTA file to parse
 * @returns {Promise<Array<{header: string, seq: string}>>} Array of sequences
 */
export async function parseFasta(file) {
  if (!file) {
    throw new Error('No file provided');
  }
  
  let fastaText;
  
  try {
    if (file.name.endsWith('.gz')) {
      // Gzipped file
      if (typeof pako === 'undefined') {
        throw new Error('Gzip decompression requires pako library (not loaded)');
      }
      const buffer = await file.arrayBuffer();
      fastaText = pako.ungzip(buffer, { to: 'string' });
    } else {
      // Plain text file
      fastaText = await file.text();
    }
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
  
  if (!fastaText || fastaText.trim().length === 0) {
    throw new Error('File is empty or contains no readable content');
  }
  
  try {
    const sequences = parseFastaText(fastaText);
    
    if (sequences.length === 0) {
      throw new Error('No valid FASTA records found in file');
    }
    
    // Validate sequences
    const invalidSeqs = sequences.filter(s => !isValidIUPAC(s.seq));
    if (invalidSeqs.length > 0) {
      console.warn(`Warning: ${invalidSeqs.length} sequence(s) contain non-IUPAC characters`);
    }
    
    return sequences;
  } catch (err) {
    throw new Error(`Failed to parse FASTA: ${err.message}`);
  }
}

/**
 * Calculate comprehensive statistics from sequences
 * @param {Array<{header: string, seq: string}>} sequences
 * @returns {{contigs: number, totalBp: number, n50: number, minLen: number, maxLen: number, avgLen: number}}
 */
export function calculateStats(sequences) {
  if (!sequences || sequences.length === 0) {
    return {
      contigs: 0,
      totalBp: 0,
      n50: 0,
      minLen: 0,
      maxLen: 0,
      avgLen: 0,
    };
  }
  
  const lengths = sequences.map(s => s.seq.length);
  const totalBp = lengths.reduce((sum, len) => sum + len, 0);
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const avgLen = totalBp / sequences.length;
  
  return {
    contigs: sequences.length,
    totalBp,
    n50: calcN50(sequences),
    minLen,
    maxLen,
    avgLen: Math.round(avgLen),
  };
}

/**
 * Format stats object for display
 * @param {{contigs: number, totalBp: number, n50: number, minLen: number, maxLen: number, avgLen: number}} stats
 * @returns {string} Formatted stats string
 */
export function formatStats(stats) {
  return `${stats.contigs} contigs, ${stats.totalBp.toLocaleString()} bp, N50=${stats.n50}`;
}
