/**
 * Runtime K-mer Utility Module
 * 
 * Computes k-mers from DNA sequences on-the-fly
 * Supports variable k-values: 15, 21, 31 (or any size)
 * 
 * This replaces the old approach of pre-computing and storing all k-mers,
 * enabling space-efficient database format and flexibility.
 */

/**
 * Extract k-mers from a DNA sequence
 * @param {string} sequence - DNA sequence (ACGT)
 * @param {number} k - K-mer size (default: 21)
 * @returns {Set<string>} - Set of unique k-mers
 */
export function extractKmersFromSequence(sequence, k = 21) {
  const kmers = new Set();
  const seq = (sequence || '').toUpperCase().replace(/[^ACGT]/g, '');

  if (seq.length < k) {
    return kmers;
  }

  for (let i = 0; i <= seq.length - k; i++) {
    kmers.add(seq.substring(i, i + k));
  }

  return kmers;
}

/**
 * Extract k-mers from multiple DNA sequences
 * Useful for batch processing genes or query genomes
 * @param {string[]} sequences - Array of DNA sequences
 * @param {number} k - K-mer size
 * @returns {Set<string>} - Union of all k-mers
 */
export function extractKmersFromSequences(sequences, k = 21) {
  const allKmers = new Set();

  sequences.forEach((seq) => {
    const kmers = extractKmersFromSequence(seq, k);
    kmers.forEach((kmer) => allKmers.add(kmer));
  });

  return allKmers;
}

/**
 * Count k-mers in a sequence (returns array of {kmer, count})
 * @param {string} sequence - DNA sequence
 * @param {number} k - K-mer size
 * @returns {Object} - Map of kmer -> count
 */
export function countKmersInSequence(sequence, k = 21) {
  const counts = {};
  const seq = (sequence || '').toUpperCase().replace(/[^ACGT]/g, '');

  if (seq.length < k) {
    return counts;
  }

  for (let i = 0; i <= seq.length - k; i++) {
    const kmer = seq.substring(i, i + k);
    counts[kmer] = (counts[kmer] || 0) + 1;
  }

  return counts;
}

/**
 * Get statistics about k-mers in a sequence
 * @param {string} sequence - DNA sequence
 * @param {number} k - K-mer size
 * @returns {Object} - {total_kmers, unique_kmers, complexity, most_common}
 */
export function getKmerStats(sequence, k = 21) {
  const seq = (sequence || '').toUpperCase().replace(/[^ACGT]/g, '');
  const totalKmers = Math.max(0, seq.length - k + 1);

  if (totalKmers === 0) {
    return {
      total_kmers: 0,
      unique_kmers: 0,
      complexity: 0,
      sequence_length: 0,
    };
  }

  const counts = countKmersInSequence(sequence, k);
  const uniqueKmers = Object.keys(counts).length;
  const complexity = uniqueKmers / totalKmers; // 0-1, higher = more diverse

  // Find most common k-mer
  let mostCommon = null;
  let maxCount = 0;
  Object.entries(counts).forEach(([kmer, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = kmer;
    }
  });

  return {
    total_kmers: totalKmers,
    unique_kmers: uniqueKmers,
    complexity: Math.round(complexity * 1000) / 1000,
    sequence_length: seq.length,
    most_common_kmer: mostCommon,
    most_common_count: maxCount,
  };
}

/**
 * Compare k-mer overlap between two sequences
 * @param {string} seq1 - First DNA sequence
 * @param {string} seq2 - Second DNA sequence
 * @param {number} k - K-mer size
 * @returns {Object} - {overlap, seq1_unique, seq2_unique}
 */
export function compareKmerOverlap(seq1, seq2, k = 21) {
  const kmers1 = extractKmersFromSequence(seq1, k);
  const kmers2 = extractKmersFromSequence(seq2, k);

  let overlap = 0;
  kmers1.forEach((kmer) => {
    if (kmers2.has(kmer)) {
      overlap++;
    }
  });

  return {
    overlap,
    seq1_unique: kmers1.size,
    seq2_unique: kmers2.size,
    seq1_only: kmers1.size - overlap,
    seq2_only: kmers2.size - overlap,
    jaccard_similarity: overlap / (kmers1.size + kmers2.size - overlap),
  };
}

/**
 * Get commonly used k-values for analysis
 * @returns {Array<number>} - Recommended k-values
 */
export function getRecommendedKValues() {
  return [15, 21, 31];
}

/**
 * Validate k-value
 * @param {number} k - K value to validate
 * @returns {boolean} - True if valid
 */
export function isValidKValue(k) {
  return Number.isInteger(k) && k > 0 && k <= 500;
}
