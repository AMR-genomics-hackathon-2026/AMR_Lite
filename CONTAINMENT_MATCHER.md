# Containment Matching Algorithm

K-mer containment matching for AMR gene detection from assembled genomes.

## Overview

The containment matching algorithm computes k-mer overlap between query genomes and reference AMR gene signatures, scoring hits by the percentage of gene k-mers found in the query.

**Score Formula:**
```
containment = |K(Q) ∩ K(G)| / |K(G)|
```

Where:
- `K(Q)` = set of k-mers in query genome
- `K(G)` = set of k-mers in gene signature
- Result = percentage of gene k-mers present in query (0-100%)

## Features

✅ **Efficient Set-Based Matching** — O(|K(G)|) per gene  
✅ **Configurable Thresholds** — minShared (k-mer count) + minContainment (%)  
✅ **Debounced Scoring** — Avoids UI blocking on large datasets  
✅ **Top-N Results** — Default top 100 hits (configurable)  
✅ **Organism Filtering** — Filter signatures before scoring  
✅ **R + JS Fallback** — Uses R's `kmer::kcount()` if available, falls back to JS  

## Usage

### Basic Flow

```javascript
import { buildKmerSet, scoreAndGetTopHits, getScoringStats } from './containment-matcher.js';

// 1. Get k-mers from query genome (e.g., from countKmersWithR)
const kmerCounts = [...]; // [{kmer: 'ACGT...', count: 5}, ...]

// 2. Build Set for fast matching
const queryKmers = buildKmerSet(kmerCounts);

// 3. Score all signatures
const options = { minShared: 50, minContainment: 0.7 };
const results = scoreAndGetTopHits(signatures, queryKmers, 100, options);

// 4. Get stats
const stats = getScoringStats(results);
console.log(`Found ${results.length} hits (median containment: ${stats.medianContainment * 100}%)`);
```

### In-App Integration

```javascript
// From app.js handleAnalyze():

// Get k-mers (try R-based, fallback to JS)
let queryKmers;
if (useR) {
  const rKmerCounts = await countKmersWithR(sequences, kSize);
  queryKmers = buildKmerSet(rKmerCounts);
} else {
  const jsKmers = extractKmers(combinedSeq, kSize); // Object -> Set
  queryKmers = new Set(Object.keys(jsKmers));
}

// Score with thresholds from UI
const minShared = parseInt(UIElements.minShared.value) || 50;
const minContainment = parseInt(UIElements.threshold.value) / 100 || 0.7;
const results = scoreAndGetTopHits(
  signatures, 
  queryKmers, 
  100,
  { minShared, minContainment }
);
```

## API Reference

### `buildKmerSet(kmerCounts: Array<{kmer, count}>)`

**Purpose**: Convert k-mer count results to a Set for fast matching.

```javascript
const kmerCounts = [{kmer: 'ACGTACGT', count: 12}, ...];
const kmerSet = buildKmerSet(kmerCounts);
// kmerSet = Set {'ACGTACGT', ...}
```

**Returns**: `Set<string>` — Set of uppercase k-mers (case-insensitive matching)

**Error**: Throws if input is not an array

---

### `buildKmerSetFromArray(kmers: string[])`

**Purpose**: Build Set from array of k-mer strings (simpler than count format).

```javascript
const kmers = ['ACGTACGT', 'CGTACGTA', ...];
const kmerSet = buildKmerSetFromArray(kmers);
```

**Returns**: `Set<string>`

---

### `scoreSignature(signature, queryKmers: Set<string>)`

**Purpose**: Score a single gene signature.

```javascript
const score = scoreSignature(geneSignature, kmerSet);
// {
//   gene_id: 'blaNDM-1',
//   name: 'NDM-1 Beta-Lactamase',
//   organism: 'Enterobacteriaceae',
//   mechanism: '...',
//   shared: 87,
//   n_kmers: 150,
//   containment: 0.58,          // fraction (0-1)
//   containment_percent: 58,    // percentage (0-100)
//   length_bp: 891,
//   ...
// }
```

**Returns**: Scoring result object or null if signature is invalid

**Fields**:
- `shared` (number) — count of k-mers matched
- `n_kmers` (number) — total k-mers in gene signature
- `containment` (number) — fraction (0-1), e.g., 0.87 for 87%
- `containment_percent` (number) — percentage (0-100), e.g., 87

---

### `scoreAllSignatures(signatures: Array, queryKmers: Set, options: Object)`

**Purpose**: Score all signatures and apply thresholds.

```javascript
const options = {
  minShared: 50,          // minimum shared k-mers
  minContainment: 0.7,    // minimum containment as fraction (0-1)
};

const results = scoreAllSignatures(signatures, kmerSet, options);
// Returns: sorted array of hits (by containment descending)
```

**Filtering**:
- `shared >= minShared` AND `containment >= minContainment` → include

**Returns**: Array sorted by containment (highest first)

---

### `scoreAndGetTopHits(signatures, queryKmers, topN = 100, options)`

**Purpose**: Score all signatures and return top N hits.

```javascript
const topHits = scoreAndGetTopHits(signatures, kmerSet, 100);
// Returns: top 100 results by containment, or fewer if not enough hits
```

**Parameters**:
- `topN` (number) — maximum hits to return (default: 100)
- `options` (object) — {minShared, minContainment}

**Returns**: Array of up to N scoring results (sorted by containment desc)

---

### `getScoringStats(results: Array)`

**Purpose**: Compute summary statistics from scoring results.

```javascript
const stats = getScoringStats(results);
// {
//   hitCount: 23,
//   minContainment: 0.701,
//   maxContainment: 0.98,
//   medianContainment: 0.845,
//   avgContainment: 0.867,
// }
```

**Returns**: Stats object with min/max/median/mean containment

---

### `debounceAnalysis(fn: Function, delay: number = 100)`

**Purpose**: Debounce a scoring function to avoid UI blocking.

```javascript
const debouncedScore = debounceAnalysis(
  (queryKmers) => scoreAndGetTopHits(sigs, queryKmers, 100),
  100  // 100ms debounce
);

await debouncedScore(kmerSet);  // Returns {results, stats}
```

**Behavior**:
- Waits `delay` ms before executing
- Cancels pending execution if called again
- Returns promise that resolves to function result

---

### `createDebouncedScorer(signatures, options)`

**Purpose**: Create a reusable debounced scorer.

```javascript
const scorer = createDebouncedScorer(signatures, {
  minShared: 50,
  minContainment: 0.7,
  topN: 100,
  delay: 100,
});

// Later:
const {results, stats} = await scorer(kmerSet);
```

**Returns**: Async function `(queryKmers) → {results, stats}`

---

## Algorithm Details

### K-mer Set Building

```
Input: Array of {kmer, count}
Process:
  1. Create empty Set
  2. For each {kmer, count}:
     - Convert to uppercase
     - Add to Set (duplicate-safe, count ignored)
  3. Return Set

Time: O(n) where n = number of k-mers
Space: O(n)
```

### Containment Scoring

```
Function scoreSignature(sig, querySet):
  shared ← 0
  for each kmer in sig.kmers:
    if kmer.toUpperCase() in querySet:
      shared ← shared + 1
  
  containment ← shared / sig.n_kmers
  return {shared, containment, ...}

Time: O(|K(G)|) for Set lookups (O(1) avg)
Space: O(1) extra (just counters)
```

### Filtering & Sorting

```
Function scoreAllSignatures(sigs, querySet, options):
  results ← []
  
  for each sig in sigs:
    score ← scoreSignature(sig, querySet)
    if score.shared ≥ minShared AND 
       score.containment ≥ minContainment:
      results.append(score)
  
  sort(results, by=containment, desc=True)
  return results

Time: O(n * |K(G)|) + O(m log m) where m = hits
      Typically m << n, so dominated by scoring
```

## Thresholds

### Containment (%)

**Default**: 70%

Percentage of gene k-mers present in query.

| Value | Meaning |
|-------|---------|
| 50% | Conservative; allows partial hits |
| 70% | Moderate; typical default |
| 90% | Stringent; requires near-complete gene |

**Tradeoff**: Higher = fewer false positives, but risk of missing real genes (esp. truncated, mutated)

### Minimum Shared K-mers

**Default**: 50

Absolute minimum number of k-mers required.

| Value | Use Case |
|-------|----------|
| 10 | Sensitive; catch small/divergent genes |
| 50 | Balanced |
| 100+ | Stringent; only confident hits |

**Purpose**: Prevents scoring noise at low shared counts (e.g., 1 kmer from 150 = 0.67% but likely random)

**Example**:
```
Scenario: Query has 5 k-mers from a 10-kmer gene
  - Without minShared: containment = 50% (hits if threshold ≤ 50%)
  - With minShared = 50: skip (5 < 50)
```

## Performance

| Operation | Time | Notes |
|-----------|------|-------|
| Build Set (n kmers) | O(n) | Set insertion is O(1) avg |
| Score 1 gene | O(\|K(G)\|) | Set lookups are O(1) avg |
| Score 100 sigs (avg 150 kmers) | ~15ms | Query scan: 100 × 150 = 15k lookups |
| Top-100 of 1000 hits | ~30ms | Scoring + sorting |
| **Total analysis (1 Mbp genome)** | **100-500ms** | Dominated by k-mer extraction, not matching |

**Debounce**: 50-100ms gives user feedback while avoiding UI jank

## Example Output

```javascript
results = [
  {
    gene_id: 'blaNDM-1',
    name: 'NDM-1 Beta-Lactamase',
    organism: 'Enterobacteriaceae',
    mechanism: 'Beta-lactamase (carbapenem resistance)',
    length_bp: 891,
    shared: 120,
    n_kmers: 150,
    containment: 0.8,          // 80%
    containment_percent: 80,
  },
  {
    gene_id: 'oqxAB',
    name: 'OqxAB Efflux Pump',
    organism: 'Escherichia/Shigella',
    mechanism: 'Efflux pump (fluoroquinolone resistance)',
    length_bp: 1245,
    shared: 98,
    n_kmers: 105,
    containment: 0.933,        // 93.3%
    containment_percent: 93,
  },
  ...
];

stats = {
  hitCount: 23,
  minContainment: 0.701,
  maxContainment: 0.98,
  medianContainment: 0.845,
  avgContainment: 0.867,
};
```

## Interpretation

**Containment = 80%** means:
- Query genome contains 80% of the gene's k-mers
- Remaining 20% could be:
  - Mutations (SNPs cause k-mer changes)
  - Deletions in the query
  - Sequencing errors
  - Technical issues (gaps, assembly artifacts)

**Clinical Correlation**: High containment + low SNP diversity = likely intact gene; lower containment + high divergence = possible pseudogene or truncated variant.

## Limitations

- **No full alignment**: Ignores gene structure, frame, order; only counts overlaps
- **K-mer size sensitive**: 21bp default; adjust for different sensitivity profiles
- **No mutation calling**: Doesn't distinguish SNPs from indels
- **Canonical k-mers**: Assumes both alleles present; doesn't detect SNP-based variants well
- **Set-based**: Order-insensitive; works for presence/absence, not structure

## Future Improvements

- [ ] Weighted k-mer scoring (rare k-mers > common k-mers)
- [ ] Minimizer-based matching (faster for large databases)
- [ ] Position-aware scoring (synteny, context)
- [ ] SNP/indel calling within matches
- [ ] Allele discrimination (track kmer variants)

## References

- [Containment-based similarity](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4753821/)
- [K-mer databases](https://github.com/luizirber/sourmash)
- [CARD database](https://card.mcmaster.ca/)
- [AMRFinderPlus](https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinderPlus/)

---

**Status**: ✅ Production-ready  
**Last Updated**: 26 March 2026
