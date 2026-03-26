# Architecture Limitations & Improvements

## Current Limitations

### 1. **K-mer Size is Fixed at 21**

**Problem**: 
- Database is built with only k=21 k-mers
- If user changes k-value in UI, they get 0 hits
- Cannot use smaller k (faster, more sensitive) or larger k (more specific)

**Why it matters**:
- k=15: More sensitive (catches distant homologs, but more false positives)
- k=21: Current balanced approach
- k=31: More specific (fewer false positives, but misses divergent sequences)

**Current behavior**:
```
User changes slider to k=31
↓
App extracts k=31 from query genome
↓
Tries to match against database k=21
↓
Result: 0 hits (no k=31 in database)
```

**Solution needed**: Pre-compute signatures at multiple k-values

---

### 2. **File Size is Too Large for Web**

**Current sizes**:
- Uncompressed JSON: **277 MB**
- Compressed (gzip): **28 MB**

**Time to load** (over typical connection):
- 277 MB: 30-90 seconds (user abandon rate high)
- 28 MB: 5-15 seconds (acceptable if Pako works)

**Problem**: 
- Pako CDN sometimes fails → falls back to 277 MB
- Even 28 MB is large for real-time use

**Better format would be**:
- Minimize duplicate k-mers across genes
- Use binary format instead of JSON text
- Index k-mers for faster lookup

---

### 3. **Current Signature Format is Inefficient**

**Current structure** (one entry per gene):
```json
{
  "gene_id": "blaTEM-1",
  "name": "Beta-lactamase TEM-1",
  "class": "BETA-LACTAM",
  "length_bp": 861,
  "n_kmers": 841,
  "k": 21,
  "kmers": [
    "ATGACATTCTTCAGTGTCAC",
    "TGACATTCTTCAGTGTCACG",
    ...841 entries...
  ]
}
```

**Problem**: 
- Stores full k-mer strings as text (inefficient)
- Can only query at k=21
- No way to compute different metrics on-the-fly
- Same k-mer repeated across many genes (duplication)

**Better format would store**:
```json
{
  "gene_id": "blaTEM-1",
  "accession": "WP_000027057.1",
  "sequence": "ATGACATTCTTCAGTGTCAC...",  // Original DNA sequence
  "class": "BETA-LACTAM",
  "length_bp": 861,
  "metadata": {...}
}
```
Then compute k-mers at any k-value on-demand.

---

## Solutions (Priority Order)

### 1. **Immediate**: Add Multi-K Support (Medium effort)
- Rebuild database with k=15, 21, 31
- Store separately or indexed by k-value
- Size increase: ~3x (28 MB → 84 MB) - still acceptable

### 2. **Short-term**: Minimize Redundancy (Low effort)
- Many genes share k-mers (domain proteins)
- Store k-mer→[gene_id] mapping instead of duplicating
- Reduces size by ~40%

### 3. **Medium-term**: Store Sequences Instead (High effort)
- Store raw DNA sequences instead of k-mers
- Compute k-mers on-the-fly in browser
- More flexible, smaller file size
- Slower matching, but better for web

### 4. **Long-term**: Use Sketching (Advanced)
- Use minimizer sketch or HyperLogLog
- Reduces signature from 841 k-mers to ~50 hash values
- 10-20x smaller, still good matching accuracy

---

## Validation

**Why we're seeing 100 hits instead of 34**:
1. ✓ K-mer matching finds paralogous genes (by design)
2. ✓ AMRFinderPlus uses protein alignment (more stringent)
3. ✓ K-mer matching has no length/identity penalties

**This is NOT fixed by**:
- ✗ Changing k-value (only have k=21)
- ✗ Higher thresholds (already 90%, all hits are 94-100%)
- ✗ Filtering by class (VIRULENCE genes aren't the problem)

**This IS improved by**:
- ✓ Multi-k signatures (can use k=31 for specificity)
- ✓ Query coverage metric (% of input matched by this gene)  
- ✓ Minimizer sketches (more discriminative)
- ✓ Post-processing with sequence alignment

---

## Recommendations

**For users**:
- Use 90% threshold (good balance)
- Validate hits with AMRFinderPlus for clinical use
- Export results for downstream BLAST confirmation

**For development**:
1. Add query coverage % to results table (shows which genes dominate input)
2. Implement multi-k database (k=15, 21, 31)
3. Consider sequence-based format for future flexibility
4. Add result export (CSV with k-mer info)

---

## Technical Note on K-mer Matching Limits

K-mer matching **cannot distinguish**:
- True orthologs from paralogs (both have similar k-mers)
- Functional proteins from pseudogenes (k-mers are identical)
- Recent gene duplications from single copies
- High-identity variants from false homologs

This is **fundamental to the algorithm**, not fixable with database changes.

BLASTX works better because it:
- Validates at protein level (codon-aware)
- Checks alignment % and identity %
- Uses HMM profiles (domain-aware)
- Understands sequence evolution

---

## Database Rebuild Plan

If you want to fix this:

1. **Extract sequences** from AMR_CDS.fa instead of k-mers
2. **Store format**:
   ```json
   [{
     "gene_id": "geneID",
     "sequence": "ATGACATTC...",
     "class": "BETA-LACTAM",
     "length": 861
   }]
   ```
3. **Compute k-mers at query time** (k=15, 21, or 31)
4. **Size**: Much smaller (sequences don't duplicate)
5. **Flexibility**: Can change k-value, compute coverage, etc.

This is (approximately) **1-2 hours of coding** to rebuild.
