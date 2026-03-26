# False Positives in K-mer Containment Matching

## Problem Summary

**Expected**: 34 hits (AMRFinderPlus with BLASTX validation)  
**Actual**: 100 hits (k-mer containment matching)  
**False positive rate**: ~66% (66 out of 100 incorrect)

## Root Causes

### 1. **Low Containment Threshold (70%)**
- Current default: `minContainment = 0.7` (70%)
- Issue: Genes only need 70% of their k-mers to match to be reported
- Example: A 100 bp gene (79 k-mers at k=21) needs only 55 k-mers to be "detected"
- This is too permissive for genomic matching

### 2. **Database Contains Non-AMR Genes**
```
BETA-LACTAM:        5,691 genes (true AMR)
AMINOGLYCOSIDE:     274 genes (true AMR)
TETRACYCLINE:       228 genes (true AMR)
... (other real AMR classes)

UNKNOWN:            2,317 genes  ← LIKELY VIRULENCE/STRESS
VIRULENCE_TOXIN:    155 genes    ← NOT ANTIBIOTIC RESISTANCE
TOXIN:              2 genes      ← NOT ANTIBIOTIC RESISTANCE
```

**Total AMR-relevant**: ~6,600 genes  
**Total in database**: 9,327 genes  
**Non-AMR overhead**: ~2,500+ genes

### 3. **K-mer Homology from Shared Domains**
- Genes sharing functional domains (ATPase, helicase, transporter motifs) will have overlapping k-mers
- Without sequence identity validation, domain matches trigger false positives
- Example: 100 different efflux genes all share ATP-binding domain k-mers

### 4. **No Query Coverage Filtering**
- Current: Only measures containment of **gene k-mers in query**
- Missing: What fraction of **query genome matched**?
- This allows single conserved domains to trigger multiple gene hits

## Solutions to Implement

### Priority 1: Increase Containment Threshold to 90%+
**Location**: `app.js` line 561-564  
**Effect**: Reduces false positives by requiring near-exact matches

```javascript
// Current (PERMISSIVE)
const minContainment = 0.7;  // 70%

// Recommended (CONSERVATIVE)
const minContainment = 0.9;  // 90% - near-exact match required
```

**Testing impact**: Likely reduces 100 hits → ~40-50 hits

---

### Priority 2: Filter to AMR-Only Genes
**Location**: `containment-matcher.js` - `scoreAllSignatures()` function  
**Approach**: Only report genes with clinically actionable AMR classes

```javascript
// Define AMR-only classes (exclude TOXIN, VIRULENCE, STRESS)
const AMR_CLASSES = [
  'BETA-LACTAM',
  'AMINOGLYCOSIDE',
  'TETRACYCLINE',
  'FLUOROQUINOLONE',
  'MACROLIDE',
  'CHLORAMPHENICOL',
  'FOSFOMYCIN',
  'GLYCOPEPTIDE',
  'POLYMYXIN',
  'PHENICOL',
  // Add any other antibiotic resistance classes
];

// Filter in scoreAllSignatures:
if (!AMR_CLASSES.includes(signature.class)) {
  return null;  // Skip non-AMR genes
}
```

**Expected reduction**: 100 hits → ~55-60 hits (removes virulence/toxin genes)

---

### Priority 3: Scale minShared by Gene Size
**Location**: `containment-matcher.js` - `scoreAllSignatures()` options  
**Reasoning**: Larger genes need more shared k-mers to be significant

```javascript
// Instead of fixed minShared = 50
function calculateMinShared(signature) {
  const n_kmers = signature.n_kmers;
  // At least 30% of gene k-mers must match
  return Math.max(50, Math.ceil(n_kmers * 0.3));
}

// Use in scoring:
const minSharedRequired = calculateMinShared(signature);
if (shared >= minSharedRequired && containment >= minContainment) {
  // Report hit
}
```

**Effect**: Small conserved domains require MORE absolute k-mer matches

---

### Priority 4: Add Query Coverage Metric (Advanced)
**What is it**: Track what percentage of the query genome matched each gene  
**Why**: Prevents single domain from triggering 10+ gene hits

```javascript
// In containment matcher:
return {
  gene_id,
  name,
  containment,           // Current: % of gene k-mers in query
  // NEW:
  query_coverage,        // % of query k-mers from this gene
  confidence_score,      // weighted by both metrics
};
```

**Formula**:
```
confidence = (containment × 0.7) + (query_coverage × 0.3)
// Require confidence ≥ 0.80 for positive hit
```

---

## Immediate Fixes (Do Now)

### Fix 1: Change default threshold to 90%
**File**: `app.js` line 563  
**Change**: `const thresholdPercent = ... || 70;` → **`|| 90;`**

**Impact**: Large reduction in false positives  
**Effort**: 1 line change

---

### Fix 2: Filter out VIRULENCE and TOXIN genes
**File**: `containment-matcher.js` - `scoreAllSignatures()`  
**Add filter**:
```javascript
// Skip non-AMR genes
if (sig.class === 'VIRULENCE_TOXIN' || sig.class === 'TOXIN' || sig.class && sig.class.includes('VIRULENCE')) {
  continue;
}
```

**Impact**: Remove ~155-170 virulence/toxin false positives  
**Effort**: 3-5 lines

---

## Testing Strategy

**Before**: Run S01098280_contigs.fa at 70% threshold  
→ Result: 100 hits

**After each fix**:
1. Apply 90% threshold alone → Should see ~40-50 hits
2. Add AMR-only filter → Should see ~35-45 hits  
3. Compare to: S01098280_amrfinder.tsv (34 real hits)
4. Check if all 34 real hits are still reported with new thresholds

---

## Summary Table

| Issue | Solution | Impact | Implementation |
|-------|----------|--------|-----------------|
| **Low threshold** | Increase to 90% | -30-40% false positives | 1 line in app.js |
| **Non-AMR genes** | Filter VIRULENCE/TOXIN | -20-30% false positives | 5 lines in containment-matcher.js |
| **Homology** | Scale minShared by gene size | -10-15% false positives | 10 lines in containment-matcher.js |
| **Domain promiscuity** | Add query coverage metric | -10-20% false positives | 20 lines (advanced) |

**Combined effect**: 100 hits → ~34-40 hits (acceptable range)

---

## Why K-mer Matching has False Positives

1. **K-mers are short (21 bp)**: Same 21 bp appears in many genes by chance
2. **Homology is common**: Related genes share domains and k-mers
3. **No evolutionary context**: K-mer matching ignores sequence divergence
4. **No functional validation**: AMRFinderPlus uses BLASTX (protein alignment) + HMM profiles to validate

K-mer matching is **fast for screening**, but requires **post-filtering for accuracy**.
