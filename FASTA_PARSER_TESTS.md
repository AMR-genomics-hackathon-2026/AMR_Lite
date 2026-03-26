# FASTA Parser Test Suite

Quick unit tests for the FASTA parser module.

Run in browser console after importing:
```javascript
import { calcTotalBp, calcN50, isValidIUPAC, parseFastaText, calculateStats } from './fasta-parser.js';

// Test 1: calcTotalBp
const seqs1 = [
  { header: 'seq1', seq: 'ACGT' },
  { header: 'seq2', seq: 'ACGTACGT' }
];
console.assert(calcTotalBp(seqs1) === 12, 'calcTotalBp failed');

// Test 2: calcN50
const seqs2 = [
  { header: 'seq1', seq: 'A'.repeat(100) },
  { header: 'seq2', seq: 'A'.repeat(80) },
  { header: 'seq3', seq: 'A'.repeat(20) }
];
// Total = 200, 50% = 100. cumsum: 100 (stops at seq1), N50 should be 100
console.assert(calcN50(seqs2) === 100, 'calcN50 failed');

// Test 3: isValidIUPAC
console.assert(isValidIUPAC('ACGTRYSWKMBDHVN') === true, 'isValidIUPAC valid DNA failed');
console.assert(isValidIUPAC('ACGTXYZ') === false, 'isValidIUPAC invalid DNA failed');

// Test 4: parseFastaText
const fasta = `>seq1
ACGTACGT
>seq2
TGCATGCA`;
const parsed = parseFastaText(fasta);
console.assert(parsed.length === 2, 'parseFastaText count failed');
console.assert(parsed[0].header === 'seq1', 'parseFastaText header failed');
console.assert(parsed[0].seq === 'ACGTACGT', 'parseFastaText seq failed');

// Test 5: calculateStats
const stats = calculateStats(parsed);
console.assert(stats.contigs === 2, 'calculateStats contigs failed');
console.assert(stats.totalBp === 16, 'calculateStats totalBp failed');

console.log('✓ All FASTA parser tests passed!');
```
