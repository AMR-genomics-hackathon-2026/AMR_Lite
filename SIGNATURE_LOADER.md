# Signature Pack Loader

Robust, in-memory signature pack loader with gzip decompression, JSON validation, organism filtering, and error recovery.

## Overview

The signature pack loader (`signature-loader.js`) handles:
- **Gzip decompression** using pako from CDN
- **JSON schema validation** with detailed error messages
- **In-memory caching** for performance
- **Organism filtering** with UI dropdown
- **Error recovery** with fallback to plain JSON
- **Search and filter** functions for signature retrieval

## Usage

### Basic Loading

```javascript
import { loadSignatures, getCachedSignatures } from './signature-loader.js';

// Load from gzipped JSON
const sigs = await loadSignatures('./data/amr_signatures.json.gz');
console.log(`Loaded ${sigs.length} signatures`);
```

### Filtering & Search

```javascript
import { filterByOrganism, searchByGeneId } from './signature-loader.js';

// Filter by organism
const ecoli = filterByOrganism('Escherichia/Shigella');

// Search by gene ID
const ndm = searchByGeneId('ndm');
```

### Getting Metadata

```javascript
import { getCachedOrganisms, getSignatureSummary } from './signature-loader.js';

// Get all organisms
const organisms = getCachedOrganisms();

// Get summary stats
const summary = getSignatureSummary();
// { geneCount, totalKmers, avgGeneLength, kSizes, organisms }
```

## Signature Schema

Each signature object must follow this schema:

```json
{
  "gene_id": "string (required)",
  "name": "string (required)",
  "organism": "string (required)",
  "length_bp": "number > 0 (required)",
  "k": "number, 1-31 (required)",
  "n_kmers": "number >= 0 (required)",
  "kmers": ["string", "..."] (required, must match n_kmers count),
  "mechanism": "string (optional)",
  "phenotype_note": "string (optional)"
}
```

### Validation Rules

- `gene_id`: Non-empty string
- `length_bp`: Positive integer (gene length in base pairs)
- `k`: Integer between 1 and 31 (kmer size)
- `n_kmers`: Non-negative integer; must equal `kmers.length`
- `kmers`: Array of k-mer strings; all must be valid IUPAC DNA codes

### Example Signature

```json
{
  "gene_id": "blaNDM-1",
  "name": "NDM-1 Beta-Lactamase",
  "organism": "Enterobacteriaceae",
  "length_bp": 891,
  "k": 21,
  "n_kmers": 5,
  "kmers": [
    "ACGTACGTACGTACGTACGTAA",
    "CGTACGTACGTACGTACGTAAC",
    "GTACGTACGTACGTACGTAACG",
    "TACGTACGTACGTACGTAACGT",
    "ACGTACGTACGTACGTAACGTA"
  ],
  "mechanism": "Beta-lactamase (carbapenem resistance)",
  "phenotype_note": "Genotype only; phenotype prediction not supported"
}
```

## File Format

### Compressed Format (Recommended)

**File**: `data/amr_signatures.json.gz` (~0.6 KB for demo, scales ~25-30% of uncompressed)

1. Plain JSON array (as above)
2. Gzipped with `gzip` or `python3 -m gzip`
3. Served with `Content-Type: application/gzip`

**Advantages:**
- 70-75% size reduction for network transfer
- Loads → decompress → validate → cache
- Fallback to plain JSON if gzip fails

### Plain Format (Fallback)

**File**: `data/amr_signatures.json`

Same JSON array format, uncompressed. Used if `.gz` unavailable or pako not loaded.

## Generation

### Creating Compressed Pack

From the project root:

```bash
# Python
python3 scripts/gzip-signatures.py

# Node.js
node scripts/gzip-signatures.js
```

Both scripts:
1. Read `data/amr_signatures.json`
2. Gzip compress
3. Write to `data/amr_signatures.json.gz`
4. Report compression ratio

## UI Integration

### Organism Filter Dropdown

Automatically populated by `app.js`:

```html
<select id="signatureFilter">
  <option value="">All Organisms</option>
  <!-- Populated by JS with organisms from signatures -->
</select>
```

**Change Handler**: `handleSignatureFilter()` in `app.js`

- Logs filter change to console
- Updates status log
- Filters queries for next analysis

### Error Handling with Toasts

If load fails, user sees:

```
✕ Signature pack error: ...error message...
[Retry link]
```

Toast is persistent (no auto-dismiss) and shows:
1. Clear error message
2. Retry button to reload
3. Close (✕) button to dismiss

## Error Scenarios & Recovery

| Scenario | Behavior |
|----------|----------|
| Network error (gzip fetch) | Try plain JSON fallback |
| Invalid gzip | Try plain JSON fallback |
| Invalid JSON | Show error toast + use mock sigs |
| Schema validation fail | Show detailed error (which indices) + use mock sigs |
| Pako not loaded | Fallback to plain JSON |
| Both formats fail | Use mock signatures + warning toast |

### Mock Signatures

If all else fails, app loads built-in mock signatures:
- 3 genes (blaNDM-1, oqxAB, acrAB)
- 2 organisms (Enterobacteriaceae, Escherichia/Shigella)
- Suitable for testing UI flow

## API Reference

### `loadSignatures(url: string)`

```javascript
async function loadSignatures(url = '/data/amr_signatures.json.gz')
```

- **Default**: `/data/amr_signatures.json.gz`
- **Returns**: Promise<Array<SignatureObject>>
- **Throws**: Error with detailed message
- **Side effects**: Caches result, populates filter dropdown

### `validateSignature(sig: any)`

```javascript
function validateSignature(sig) -> boolean
```

Pure function; validates single signature object.

### `validatePack(data: any)`

```javascript
function validatePack(data) -> {valid: boolean, error: string|null}
```

Validates entire signature pack array; returns detailed error.

### `extractOrganisms(signatures: Array)`

```javascript
function extractOrganisms(signatures) -> string[]
```

Extracts and sorts unique organism names.

### `filterByOrganism(organisms: string|string[])`

```javascript
function filterByOrganism(organisms) -> Array
```

Filters cached signatures by organism name(s).

### `searchByGeneId(query: string)`

```javascript
function searchByGeneId(query) -> Array
```

Case-insensitive substring search in cached signatures.

### `getCachedSignatures()`

```javascript
function getCachedSignatures() -> Array|null
```

Returns cached signatures or null if not loaded.

### `getCachedOrganisms()`

```javascript
function getCachedOrganisms() -> string[]
```

Returns unique organisms from cached sigs (sorted).

### `getSignatureSummary()`

```javascript
function getSignatureSummary() -> object|null
```

Returns: `{geneCount, totalKmers, avgGeneLength, kSizes, organisms}`

### `clearCache()`

```javascript
function clearCache()
```

Resets all cached data (for testing/reset).

## Performance

| Operation | Time |
|-----------|------|
| Download .gz (1 network) | 0-100 ms |
| Decompress (pako) | 1-5 ms |
| Parse JSON | <1 ms |
| Validate 5 sigs | <1 ms |
| Extract organisms | <1 ms |
| Filter (100 sigs) | <1 ms |
| **Total first load** | ~5-100 ms + network |
| **Cache hit** | <1 ms |

## Browser Compatibility

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Safari 14+
- ✅ Edge 79+

Requires:
- Fetch API
- ES2018 (async/await, Promise)
- Pako for gzip (CDN)

## Testing

### Unit Tests

```bash
# Check validation
node -e "
  import('./signature-loader.js').then(m => {
    const sig = {gene_id:'test', length_bp:100, k:21, n_kmers:1, kmers:['A'.repeat(21)]};
    console.log(m.validateSignature(sig) ? 'PASS' : 'FAIL');
  });
"
```

### Integration Test

1. Start server in `/data/` directory
2. Open browser console (F12)
3. Run:
   ```javascript
   await loadSignatures('./amr_signatures.json.gz');
   console.log(getCachedSignatures().length, 'signatures loaded');
   ```
4. Expected: `5 signatures loaded` (or more depending on pack)

## Troubleshooting

### "Pako library not available"

**Issue**: Pako CDN not loaded

**Solution**: Ensure `index.html` has:
```html
<script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script>
```
Before the module script tag.

### "Signature pack is empty"

**Issue**: JSON array is empty or missing signatures

**Solution**: Check `data/amr_signatures.json` has at least one valid signature object.

### "Invalid signatures at indices: ..."

**Issue**: One or more signatures don't match schema

**Solution**: 
1. Verify each signature has: `gene_id, length_bp, k, n_kmers, kmers`
2. Check `kmers.length === n_kmers`
3. Verify all k-mers are valid IUPAC DNA codes

## References

- [Pako GZIP Documentation](https://github.com/nodeca/pako)
- [IUPAC DNA Codes](https://en.wikipedia.org/wiki/Nucleic_acid_notation)
- [Gzip Specification](https://tools.ietf.org/html/rfc1952)

---

**Last Updated**: 2024
**Version**: 1.0
