/**
 * Containment Matching Algorithm (UPDATED FOR SEQUENCE-BASED DATABASE)
 * 
 * NEW: Supports sequence-based signatures with runtime k-mer computation
 * OLD: Still supports pre-computed k-mer format for backwards compatibility
 * 
 * K-value support: 15, 21, 31 (or any positive integer)
 */

import { extractKmersFromSequence } from './kmer-utils.js';

/**
 * Build a Set of k-mers from k-mer count results
 * @param {Array<{kmer, count}>} kmerCounts - Output from countKmersWithR or JS k-mer counter
 * @returns {Set<string>} - Set of unique k-mers
 */
export function buildKmerSet(kmerCounts) {
  if (!Array.isArray(kmerCounts)) {
    throw new Error('kmerCounts must be an array of {kmer, count} objects');
  }
  
  const kmerSet = new Set();
  kmerCounts.forEach(item => {
    if (typeof item.kmer === 'string') {
      kmerSet.add(item.kmer.toUpperCase());
    }
  });
  
  console.log(`[Containment Matcher] Built k-mer set: ${kmerSet.size} unique k-mers`);
  return kmerSet;
}

/**
 * Build a Set of k-mers from a simple array of k-mer strings
 * @param {string[]} kmers - Array of k-mer strings
 * @returns {Set<string>} - Set of unique k-mers
 */
export function buildKmerSetFromArray(kmers) {
  if (!Array.isArray(kmers)) {
    throw new Error('kmers must be an array of strings');
  }
  
  const kmerSet = new Set(kmers.map(k => k.toUpperCase()));
  console.log(`[Containment Matcher] Built k-mer set from array: ${kmerSet.size} k-mers`);
  return kmerSet;
}

/**
 * Score a single gene signature from SEQUENCE (NEW)
 * Computes k-mers at runtime with specified k-value
 * @param {Object} signature - Gene signature with sequence: {gene_id, name, sequence, length_bp, ...}
 * @param {Set<string>} queryKmers - Set of query k-mers
 * @param {number} k - K-mer size (default 21)
 * @returns {Object} - {gene_id, name, organism, mechanism, shared, containment, n_kmers, length_bp}
 */
export function scoreSignatureFromSequence(signature, queryKmers, k = 21) {
  if (!signature || !signature.sequence || typeof signature.sequence !== 'string') {
    return null;
  }

  // Extract k-mers from the gene sequence at runtime
  const geneKmers = extractKmersFromSequence(signature.sequence, k);
  const nKmers = geneKmers.size;

  if (nKmers === 0) {
    return null; // Sequence too short for this k-value
  }

  // Count shared k-mers
  let shared = 0;
  geneKmers.forEach((kmer) => {
    if (queryKmers.has(kmer)) {
      shared++;
    }
  });

  // Compute containment: shared / gene_n_kmers
  const containment = nKmers > 0 ? shared / nKmers : 0;

  return {
    gene_id: signature.gene_id || 'unknown',
    name: signature.name || signature.gene_id,
    organism: signature.organism || 'Unknown',
    mechanism: signature.mechanism || 'Not specified',
    class: signature.class || 'UNKNOWN',
    phenotype_note: signature.phenotype_note || '',
    length_bp: signature.length_bp || 0,
    shared,
    n_kmers: nKmers,
    k_value: k, // Include k-value in output for reference
    containment: Math.round(containment * 1000) / 1000,
    containment_percent: Math.round(containment * 100),
  };
}

/**
 * Score a single gene signature against query k-mers (OLD)
 * For backwards compatibility with pre-computed k-mer databases
 * @param {Object} signature - Gene signature object {gene_id, name, organism, kmers, n_kmers, mechanism, ...}
 * @param {Set<string>} queryKmers - Set of query k-mers
 * @returns {Object} - {gene_id, name, organism, mechanism, shared, containment, n_kmers, length_bp}
 */
export function scoreSignature(signature, queryKmers) {
  if (!signature || !signature.kmers || !Array.isArray(signature.kmers)) {
    return null;
  }
  
  // Count shared k-mers (case-insensitive)
  let shared = 0;
  const geneKmers = signature.kmers.length;
  
  for (const kmer of signature.kmers) {
    if (queryKmers.has(kmer.toUpperCase())) {
      shared++;
    }
  }
  
  // Compute containment: shared / gene_n_kmers
  const containment = geneKmers > 0 ? shared / geneKmers : 0;
  
  return {
    gene_id: signature.gene_id || 'unknown',
    name: signature.name || signature.gene_id,
    organism: signature.organism || 'Unknown',
    mechanism: signature.mechanism || 'Not specified',
    phenotype_note: signature.phenotype_note || '',
    length_bp: signature.length_bp || 0,
    shared,
    n_kmers: geneKmers,
    containment: Math.round(containment * 1000) / 1000, // Round to 3 decimals
    containment_percent: Math.round(containment * 100),
  };
}

/**
 * Score all signatures against query k-mers
 * Supports both old (pre-computed k-mers) and new (sequences) formats
 * @param {string[]} signatures - Array of signature objects
 * @param {Set<string>} queryKmers - Set of query k-mers
 * @param {Object} options - {minShared, minContainment, k, filterNonAMR}
 * @returns {Array} - Sorted array of hits (by containment desc)
 */
export function scoreAllSignatures(signatures, queryKmers, options = {}) {
  const { 
    minShared = 50, 
    minContainment = 0.9,  // Updated default to 90%
    k = 21,  // K-value for sequence-based scoring
    filterNonAMR = true
  } = options;
  
  if (!Array.isArray(signatures)) {
    throw new Error('signatures must be an array');
  }
  
  if (!(queryKmers instanceof Set)) {
    throw new Error('queryKmers must be a Set');
  }
  
  // Detect database format
  const isSequenceBased = signatures.length > 0 && signatures[0].sequence && !signatures[0].kmers;
  const dbFormat = isSequenceBased ? 'sequence-based' : 'k-mer-based';
  
  console.log(
    `[Containment Matcher] Scoring ${signatures.length} signatures (${dbFormat} format) ` +
    `(k=${k}, minShared=${minShared}, minContainment=${(minContainment * 100).toFixed(0)}%)`
  );
  
  // Count classes for debugging
  const classStats = {};
  signatures.forEach(sig => {
    const cls = sig.class || 'UNKNOWN';
    classStats[cls] = (classStats[cls] || 0) + 1;
  });
  console.log(`[Containment Matcher] Database classes: ${JSON.stringify(classStats)}`);
  
  const startTime = performance.now();
  const results = [];
  let hitCount = 0;
  let skippedNonAMR = 0;
  let skippedShortSeq = 0;
  const classesSeenInResults = new Set();
  
  // Skip genes that are not AMR-related (exclude virulence, toxins)
  const NON_AMR_CLASSES = ['VIRULENCE_TOXIN', 'TOXIN'];

  signatures.forEach((sig, idx) => {
    // Filter out non-AMR gene classes
    if (filterNonAMR && NON_AMR_CLASSES.includes(sig.class)) {
      skippedNonAMR++;
      return;
    }
    
    // Choose scoring function based on database format
    let score;
    if (isSequenceBased) {
      score = scoreSignatureFromSequence(sig, queryKmers, k);
      if (!score) {
        skippedShortSeq++;
        return;
      }
    } else {
      score = scoreSignature(sig, queryKmers);
    }
    
    if (!score) return; // Skip invalid signatures
    
    // Apply thresholds
    if (score.shared >= minShared && score.containment >= minContainment) {
      results.push(score);
      hitCount++;
      classesSeenInResults.add(sig.class);
    }
  });
  
  // Sort by containment descending
  results.sort((a, b) => b.containment - a.containment);
  
  const elapsed = performance.now() - startTime;
  const classesStr = Array.from(classesSeenInResults).slice(0, 3).join(', ');
  console.log(
    `[Containment Matcher] Scoring complete: ${hitCount} hits ` +
    `(k=${k}, skipped ${skippedNonAMR} non-AMR + ${skippedShortSeq} short-seq genes, ` +
    `classes: ${classesStr}..., ${elapsed.toFixed(1)}ms)`
  );
  
  return results;
}

/**
 * Score signatures and return top N hits
 * @param {string[]} signatures - Array of signature objects
 * @param {Set<string>} queryKmers - Set of query k-mers
 * @param {number} topN - Return top N hits (default 100)
 * @param {Object} options - {minShared, minContainment, k, filterNonAMR}
 * @returns {Array} - Top N results sorted by containment desc
 */
export function scoreAndGetTopHits(signatures, queryKmers, topN = 100, options = {}) {
  const allHits = scoreAllSignatures(signatures, queryKmers, options);
  
  if (allHits.length > topN) {
    console.log(`[Containment Matcher] Limiting to top ${topN} of ${allHits.length} hits`);
    return allHits.slice(0, topN);
  }
  
  return allHits;
}

/**
 * Get statistics from scoring results
 * @param {Array} results - Results from scoring
 * @returns {Object} - {hitCount, minContainment, maxContainment, medianContainment, ...}
 */
export function getScoringStats(results) {
  if (!Array.isArray(results) || results.length === 0) {
    return {
      hitCount: 0,
      minContainment: null,
      maxContainment: null,
      medianContainment: null,
      avgContainment: null,
    };
  }
  
  const containments = results.map(r => r.containment).sort((a, b) => a - b);
  const median = containments.length % 2 === 0
    ? (containments[Math.floor(containments.length / 2) - 1] + containments[Math.floor(containments.length / 2)]) / 2
    : containments[Math.floor(containments.length / 2)];
  
  const sum = containments.reduce((a, b) => a + b, 0);
  
  return {
    hitCount: results.length,
    minContainment: Math.round(containments[0] * 1000) / 1000,
    maxContainment: Math.round(containments[containments.length - 1] * 1000) / 1000,
    medianContainment: Math.round(median * 1000) / 1000,
    avgContainment: Math.round((sum / containments.length) * 1000) / 1000,
  };
}

/**
 * Debounce function for UI-friendly analysis
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Debounce delay in ms (default 100ms)
 * @returns {Function} - Debounced function
 */
export function debounceAnalysis(fn, delay = 100) {
  let timeoutId = null;
  let lastPromise = null;
  
  return async function debounced(...args) {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          lastPromise = Promise.resolve(result);
          resolve(result);
        } catch (err) {
          lastPromise = Promise.reject(err);
          reject(err);
        }
      }, delay);
    });
  };
}

/**
 * Create a debounced scoring function
 * @param {Array} signatures - Signature database
 * @param {Object} options - {minShared, minContainment, topN, delay, k, filterNonAMR}
 * @returns {Function} - Async debounced scorer
 */
export function createDebouncedScorer(signatures, options = {}) {
  const { topN = 100, delay = 100, k = 21, ...scoringOptions } = options;
  
  const scorer = async (queryKmers) => {
    // Yield to browser to avoid blocking
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const results = scoreAndGetTopHits(signatures, queryKmers, topN, { ...scoringOptions, k });
    const stats = getScoringStats(results);
    
    return { results, stats };
  };
  
  return debounceAnalysis(scorer, delay);
}
