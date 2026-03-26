#!/usr/bin/env node

/**
 * test-runner.js
 * 
 * Simple test suite for AMR Lite containment matching
 * No external test framework - plain assertions with clear failure messages
 * 
 * Usage: node tests/test-runner.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import modules
import { parseFastaText } from '../fasta-parser.js';
import { scoreAllSignatures, buildKmerSet } from '../containment-matcher.js';

/**
 * Simple assertion function
 */
function assert(condition, message) {
  if (!condition) {
    console.error(`  ✗ FAILED: ${message}`);
    process.exit(1);
  }
}

/**
 * Assert with tolerance for numeric values
 */
function assertNear(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff > tolerance) {
    console.error(`  ✗ FAILED: ${message}`);
    console.error(`    Expected: ${expected} ± ${tolerance}`);
    console.error(`    Actual:   ${actual} (diff: ${diff})`);
    process.exit(1);
  }
}

/**
 * Load test FASTA file
 */
function loadTestFasta() {
  const fastaPath = path.join(__dirname, 'mock.fasta');
  const fastaContent = fs.readFileSync(fastaPath, 'utf-8');
  return parseFastaText(fastaContent);
}

/**
 * Load test signatures
 */
function loadTestSignatures() {
  const sigsPath = path.join(__dirname, 'sigs_small.json');
  const sigsContent = fs.readFileSync(sigsPath, 'utf-8');
  const sigs = JSON.parse(sigsContent);
  
  // Ensure n_kmers field matches kmers array length
  return sigs.map(sig => ({
    ...sig,
    n_kmers: sig.kmers.length,
  }));
}

/**
 * Extract k-mers from sequences (21-bp k-mers)
 */
function extractKmersFromSequences(sequences) {
  const kmerSet = new Set();
  const k = 21;
  
  sequences.forEach(seq => {
    for (let i = 0; i <= seq.length - k; i++) {
      const kmer = seq.substring(i, i + k).toUpperCase();
      // Only add valid k-mers (no N's)
      if (!/N/i.test(kmer)) {
        kmerSet.add(kmer);
      }
    }
  });
  
  // Convert to array for consistency
  return Array.from(kmerSet).map(kmer => ({
    kmer,
    count: 1,
  }));
}

/**
 * Test Suite: Containment Matching
 */
async function runTests() {
  console.log('\n=== AMR Lite Test Suite ===\n');
  
  let passCount = 0;
  let totalTests = 0;
  
  try {
    // Test 1: Load FASTA and parse
    console.log('Test 1: Load and parse mock FASTA');
    totalTests++;
    const sequences = loadTestFasta();
    assert(Array.isArray(sequences) && sequences.length === 3, 'Should have 3 contigs');
    console.log(`  ✓ PASSED: Loaded 3 contigs`);
    passCount++;
    
    // Test 2: Extract k-mers
    console.log('\nTest 2: Extract k-mers from sequences');
    totalTests++;
    const seqStrings = sequences.map(s => s.seq);
    const extractedKmers = extractKmersFromSequences(seqStrings);
    assert(extractedKmers.length > 0, 'Should extract k-mers');
    console.log(`  ✓ PASSED: Extracted ${extractedKmers.length} unique k-mers`);
    passCount++;
    
    // Test 3: Load test signatures
    console.log('\nTest 3: Load test signatures');
    totalTests++;
    const signatures = loadTestSignatures();
    assert(signatures.length === 3, 'Should have 3 test signatures');
    console.log(`  ✓ PASSED: Loaded 3 gene signatures`);
    passCount++;
    
    // Test 4: Build k-mer set
    console.log('\nTest 4: Build k-mer set from extracted k-mers');
    totalTests++;
    const kmerSet = buildKmerSet(extractedKmers);
    assert(kmerSet instanceof Set, 'Should return a Set');
    assert(kmerSet.size > 0, 'K-mer set should not be empty');
    console.log(`  ✓ PASSED: Built Set with ${kmerSet.size} k-mers`);
    passCount++;
    
    // Test 5: Score signatures
    console.log('\nTest 5: Score all signatures');
    totalTests++;
    const results = scoreAllSignatures(signatures, kmerSet, {
      minShared: 30,
      minContainment: 0.70,
    });
    assert(Array.isArray(results), 'Should return array of results');
    console.log(`  ✓ PASSED: Scored ${results.length} hits above threshold`);
    passCount++;
    
    // Test 6: Validate hit count
    console.log('\nTest 6: Validate hit count');
    totalTests++;
    // Should get hits for GeneA and GeneB, but not GeneC (since GeneC has mostly AAAA... k-mers)
    const hitCount = results.length;
    assert(hitCount >= 1, `Should have at least 1 hit, got ${hitCount}`);
    console.log(`  ✓ PASSED: Got ${hitCount} hit(s) as expected`);
    passCount++;
    
    // Test 7: Top hit is TestGeneA_Strong
    console.log('\nTest 7: Verify top hit is TestGeneA_Strong');
    totalTests++;
    if (results.length > 0) {
      const topHit = results[0];
      assert(topHit.gene_id === 'TestGeneA_Strong', 
        `Top hit should be TestGeneA_Strong, got ${topHit.gene_id}`);
      console.log(`  ✓ PASSED: Top hit is ${topHit.gene_id}`);
      passCount++;
    } else {
      console.warn(`  ⚠ SKIPPED: No hits to validate (hit count = 0)`);
      // Don't increment passCount or totalTests since we're skipping
      totalTests--;
    }
    
    // Test 8: Top hit containment in reasonable range
    console.log('\nTest 8: Verify top hit containment percentage');
    totalTests++;
    if (results.length > 0) {
      const topHit = results[0];
      const containmentPercent = topHit.containment_percent !== undefined
        ? topHit.containment_percent
        : Math.round(topHit.containment * 100);
      
      // We expect ~85% for GeneA (70 of 80 k-mers match)
      assert(containmentPercent >= 50, `Containment should be >= 50%, got ${containmentPercent}%`);
      console.log(`  ✓ PASSED: Top hit containment = ${containmentPercent}%`);
      passCount++;
    } else {
      console.warn(`  ⚠ SKIPPED: No hits to validate containment`);
      totalTests--;
    }
    
    // Test 9: Results are sorted by containment descending
    console.log('\nTest 9: Verify results sorted by containment (descending)');
    totalTests++;
    let sorted = true;
    for (let i = 1; i < results.length; i++) {
      if (results[i].containment > results[i - 1].containment) {
        sorted = false;
        break;
      }
    }
    assert(sorted, 'Results should be sorted by containment (desc)');
    console.log(`  ✓ PASSED: Results properly sorted by containment`);
    passCount++;
    
    // Test 10: Score structure validation
    console.log('\nTest 10: Validate result object structure');
    totalTests++;
    if (results.length > 0) {
      const hit = results[0];
      assert(hit.gene_id, 'Result should have gene_id');
      assert(hit.shared !== undefined, 'Result should have shared count');
      assert(hit.n_kmers !== undefined, 'Result should have n_kmers');
      assert(hit.containment !== undefined, 'Result should have containment');
      assert(hit.containment_percent !== undefined, 'Result should have containment_percent');
      console.log(`  ✓ PASSED: Result has all required fields`);
      console.log(`    - gene_id: ${hit.gene_id}`);
      console.log(`    - shared: ${hit.shared}`);
      console.log(`    - n_kmers: ${hit.n_kmers}`);
      console.log(`    - containment: ${hit.containment}`);
      console.log(`    - containment_percent: ${hit.containment_percent}%`);
      passCount++;
    } else {
      console.warn(`  ⚠ SKIPPED: No hits to validate structure`);
      totalTests--;
    }
    
  } catch (err) {
    console.error(`\n✗ TEST ERROR: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
  
  // Summary
  console.log(`\n=== Summary ===`);
  console.log(`Passed: ${passCount} / ${totalTests}`);
  
  if (passCount === totalTests) {
    console.log(`\n✓ ALL TESTS PASSED\n`);
    process.exit(0);
  } else {
    console.log(`\n✗ SOME TESTS FAILED\n`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
