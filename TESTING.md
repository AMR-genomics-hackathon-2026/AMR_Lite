# Testing AMR Lite with WebR K-mer Support

## Quick Start (Browser Testing)

### Option 1: Double-Click to Open
```bash
open /Users/kw524/AMRbrowser_plus/amr-lite/index.html
```

### Option 2: Run Local Server
```bash
cd /Users/kw524/AMRbrowser_plus/amr-lite
npm install  # First time only
npx serve .
# Opens http://localhost:3000 (or similar)
```

## What to Expect on Page Load

1. **Initialization Log** (in browser console and status panel):
   ```
   === AMR Lite Initialization Started ===
   ✓ UI elements initialized
   Initializing application...
   [WebR...] Loading WebR from CDN...
   [WebR...] Instantiating WebR engine...
   [WebR...] Initializing WebR (this may take 10-30 seconds on first load)...
   [WebR...] WebR initialized successfully
   [WebR...] Running WebR smoke test...
   [WebR...] Smoke test passed...
   ✓ App fully initialized with WebR
   ```

2. **Status Panel** shows: "✓ Ready. Load a FASTA file to begin."

3. **Browser Console** shows: All initialization steps with timestamps

## Testing File Upload

### 1. Download Sample FASTA
Click the blue **"📥 Download Sample FASTA"** link in the UI.
This creates `sample.fasta` with two short test sequences.

### 2. Upload Sample FASTA
- Click "Select FASTA File" or the dashed upload area
- Select the downloaded `sample.fasta`
- Should see: `✓ Loaded: sample.fasta - 2 contigs, 486 bp, N50=243`

### 3. Check Console Logs
Open DevTools (F12 or right-click → Inspect) → Console tab:
```
[INFO] File input change event triggered
[INFO] File selected: sample.fasta
[INFO] loadFastaFile called with: File {name: "sample.fasta", ...}
[INFO] Calling parseFasta...
[INFO] Parse successful, sequences: 2
[INFO] Stats calculated: {contigs: 2, totalBp: 486, n50: 243, ...}
```

### 4. Run Analysis
- Click **"▶️ Analyse"** button
- Should see results table with detected AMR genes
- Downloads become active (CSV/JSON buttons)

## Troubleshooting

### Issue: "Failed to initialize UI elements"
- Check that all HTML IDs match the JavaScript `UIElements` object
- Open DevTools console to see which element is missing

### Issue: "File input change event not triggered"
- Check file input element exists in HTML
- Try clearing browser cache and reload
- Try a different browser

### Issue: WebR initialization hangs >60 seconds
- WASM download can take 30-60s on first load
- Check browser network tab (DevTools → Network) for WASM file download
- May need more time on slower connections

### Issue: "No file selected" after clicking upload
- Check browser permissions for file access
- Try a different file browser dialog

### Issue: FASTA parsing fails with "No valid FASTA records found"
- Make sure file has `>header` lines starting with `>`
- Check that sequences don't have invalid characters

## Testing WebR K-mer Function

Once WebR is initialized and a FASTA is loaded, you can test the R-based k-mer counter:

```javascript
// In browser console:
import { countKmersWithR } from './kmer-counter.js';

// This will:
// 1. Install 'kmer' R package (1-2 min first time)
// 2. Write FASTA to WebR filesystem
// 3. Run kmer::kcount() in R
// 4. Return array of {kmer, count} objects

const result = await countKmersWithR(State.fastaSequences, 21, true);
console.log(`Found ${result.length} unique 21-mers`);
```

## Expected Browser Caps

- **Max genome size**: ~5-10 Mbp (depending on browser available memory)
- **K-mer size**: 15-31 bp (default 21)
- **Typical time for 5 Mbp genome**: 5-15 seconds for k-mer counting

## Files Structure

```
amr-lite/
├── index.html              # Main UI with pako CDN + module script
├── app.js                  # Main app logic (ES module)
├── webr-init.js            # WebR initialization + smoke test
├── fasta-parser.js         # FASTA parsing + stats (N50, etc)
├── kmer-counter.js         # WebR-based k-mer counting
├── style.css               # Responsive styling
├── package.json            # npm dependencies (pako, devtools)
└── data/amr_signatures.json # Mock AMR signatures
```

## Acceptance Criteria Status

✅ FASTA parser with N50 calculation
✅ WebR initialization with smoke test
✅ File upload with stats display
✅ ES modules throughout
✅ WebR k-mer counting function (countKmersWithR)
✅ Robust error handling and logging
✅ Memory caps (50 Mbp limit)
✅ Package caching for 'kmer' package

## Next Steps

1. **Test on actual genome**: Try uploading a real 1-5 Mbp genome
2. **Integrate k-mer results**: Use `countKmersWithR()` output in AMR analysis
3. **Performance tuning**: May need to optimize for larger genomes (minimizers, parallel processing)
4. **Add phenotype prediction**: Via machine learning model (out of scope for genotype-only)
