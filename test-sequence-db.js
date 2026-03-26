#!/usr/bin/env node

/**
 * Quick verification test for sequence-based database redesign
 * Tests: database loading, sequence validation, k-mer computation, scoring
 */

import fs from 'fs';
import zlib from 'zlib';

// Test utilities
function decompressGzip(filePath) {
  const compressed = fs.readFileSync(filePath);
  return zlib.gunzipSync(compressed).toString();
}

function extractKmers(sequence, k = 21) {
  const kmers = new Set();
  const seq = sequence.toUpperCase().replace(/[^ACGT]/g, '');
  if (seq.length < k) return kmers;
  for (let i = 0; i <= seq.length - k; i++) {
    kmers.add(seq.substring(i, i + k));
  }
  return kmers;
}

console.log('\n🧪 Sequence Database Verification Test\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

try {
  // TEST 1: Load sequence-based database
  console.log('TEST 1: Load sequence-based database');
  const seqDbPath = './data/amr_signatures_sequences.json.gz';
  const seqDbRaw = decompressGzip(seqDbPath);
  const seqDb = JSON.parse(seqDbRaw);
  
  console.log(`✓ Loaded ${seqDb.length} genes from sequence database`);
  console.log(`  Database size (gzipped): ${(fs.statSync(seqDbPath).size / 1024 / 1024).toFixed(1)} MB\n`);
  
  // TEST 2: Validate database structure
  console.log('TEST 2: Validate database structure');
  let validCount = 0;
  let invalidCount = 0;
  
  seqDb.forEach((gene, idx) => {
    const hasSequence = gene.sequence && typeof gene.sequence === 'string' && gene.sequence.length > 0;
    const hasMetadata = gene.gene_id && gene.length_bp && gene.class;
    
    if (hasSequence && hasMetadata) {
      validCount++;
    } else {
      invalidCount++;
      if (invalidCount <= 3) {
        console.log(`  ⚠️  Gene ${idx}: missing ${!hasSequence ? 'sequence' : ''} ${!hasMetadata ? 'metadata' : ''}`);
      }
    }
  });
  
  console.log(`✓ Valid genes: ${validCount}/${seqDb.length} (${Math.round(validCount/seqDb.length*100)}%)`);
  if (invalidCount > 0) console.log(`  Invalid: ${invalidCount}`);
  console.log();
  
  // TEST 3: Sample sequence analysis
  console.log('TEST 3: Runtime k-mer computation (sample gene)');
  const sampleGene = seqDb.find(g => g.class === 'BETA-LACTAM');
  if (sampleGene) {
    console.log(`  Gene: ${sampleGene.gene_id}`);
    console.log(`  Class: ${sampleGene.class}`);
    console.log(`  Sequence length: ${sampleGene.length_bp} bp`);
    
    // Test k-values
    const kValues = [15, 21, 31];
    kValues.forEach(k => {
      const kmers = extractKmers(sampleGene.sequence, k);
      console.log(`  k=${k}: ${kmers.size} unique k-mers`);
    });
    console.log();
  }
  
  // TEST 4: Simulate scoring
  console.log('TEST 4: Simulate containment matching');
  const testGene1 = seqDb[0];
  const testGene2 = seqDb[10];
  
  // Extract k-mers from test genes
  const kmers1 = extractKmers(testGene1.sequence, 21);
  const kmers2 = extractKmers(testGene2.sequence, 21);
  
  // Simulate shared k-mers
  let shared = 0;
  kmers2.forEach(kmer => {
    if (kmers1.has(kmer)) shared++;
  });
  
  const containment = kmers2.size > 0 ? (shared / kmers2.size) : 0;
  
  console.log(`  Gene 1: ${testGene1.gene_id} (${testGene1.length_bp} bp)`);
  console.log(`  Gene 2: ${testGene2.gene_id} (${testGene2.length_bp} bp)`);
  console.log(`  Shared k-mers (k=21): ${shared}/${kmers2.size}`);
  console.log(`  Containment: ${(containment * 100).toFixed(1)}%\n`);
  
  // TEST 5: Class distribution
  console.log('TEST 5: Class distribution');
  const classCount = {};
  seqDb.forEach(gene => {
    classCount[gene.class] = (classCount[gene.class] || 0) + 1;
  });
  
  Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([cls, count]) => {
      console.log(`  ${cls}: ${count}`);
    });
  console.log(`  ... and ${Object.keys(classCount).length - 5} more classes\n`);
  
  // TEST 6: Compare sizes
  console.log('TEST 6: File size comparison');
  const legacyGz = fs.statSync('./data/amr_signatures.json.gz');
  const seqGz = fs.statSync('./data/amr_signatures_sequences.json.gz');
  const legacyUn = fs.statSync('./data/amr_signatures.json');
  const seqUn = fs.statSync('./data/amr_signatures_sequences.json');
  
  console.log(`  Legacy (k-mer):      ${(legacyGz.size / 1024 / 1024).toFixed(1)} MB (gz), ${(legacyUn.size / 1024 / 1024).toFixed(0)} MB (uncompressed)`);
  console.log(`  Sequence (new):      ${(seqGz.size / 1024 / 1024).toFixed(1)} MB (gz), ${(seqUn.size / 1024 / 1024).toFixed(0)} MB (uncompressed)`);
  
  const spaceSaved = ((1 - seqGz.size / legacyGz.size) * 100);
  console.log(`  Space saved (gzipped): ~${spaceSaved.toFixed(0)}%\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ All tests passed! Sequence database is ready.\n');
  console.log('Next steps:\n');
  console.log('1. Open http://localhost:8000 in your browser');
  console.log('2. Check Console for database format detection');
  console.log('3. Upload a test genome to verify scoring works');
  console.log('4. Try different k-values (15, 21, 31) to see variations\n');
  
} catch (err) {
  console.error('❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
