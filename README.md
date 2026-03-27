# AMR Lite

<div align="center">
  <img src="AMR_lite_logo.png" alt="AMR Lite Logo" width="120" height="auto" />
</div>

A **static, browser-only, privacy-preserving** demo for detecting putative antimicrobial resistance (AMR) genes from assembled genomes using k-mer or minimizer containment.

> **Disclaimer:** This is a **genotype-only** demo. It detects putative AMR genes via k-mer containment and does **NOT** predict phenotype or clinical resistance outcomes. For clinical guidance, consult AMRFinderPlus, CARD, or clinical microbiology standards.

## Features

- 🔒 **Privacy-preserving**: All analysis runs in your browser; no data is sent to any server.
- 📊 **K-mer containment scoring**: Compares genome k-mers against a precomputed signature pack.
- 🚀 **No framework overhead**: Vanilla HTML, CSS, and JavaScript.
- 📦 **Minimal dependencies**: Optional `pako` for gzip decompression.
- ♿ **Accessible UI**: Semantic HTML, ARIA labels, keyboard-friendly.
- 📱 **Responsive design**: Works on desktop and mobile.

## Quick Start

### Option 1: Use the Deployed Website (Recommended)

**No setup needed!** Visit the live application:

👉 **https://amr-genomics-hackathon-2026.github.io/AMR_Lite/**

1. Open the link in your web browser
2. Upload a FASTA genome file (or download the sample below)
3. Click **Run Analysis**
4. Download results as CSV or JSON

### Option 2: Run Locally (Development)

Clone or download this repository:

```bash
git clone https://github.com/AMR-genomics-hackathon-2026/AMR_Lite.git
cd AMR_Lite

# Start local server (Python 3)
python3 -m http.server 8000
# or with npm
npm install -g http-server
http-server -p 8000
```

Then open [http://localhost:8000](http://localhost:8000)

## Project Structure

```
amr-lite/
├── index.html                    # Main UI (semantic HTML + accessibility)
├── style.css                     # Responsive styling
├── package.json                  # npm dependencies (pako for gzip)
├── LICENSE                       # MIT License
├── README.md                     # This file
├── AMR_lite_logo.png             # Logo
├── src/                          # Application source code
│   ├── app.js                    # Main controller, FASTA parsing, analysis orchestration
│   ├── signature-loader.js       # Loads and caches AMR gene signatures from database
│   ├── containment-matcher.js    # K-mer scoring and gene hit calculation
│   ├── fasta-parser.js           # FASTA file parsing and validation
│   ├── kmer-counter.js           # K-mer counting utilities
│   ├── kmer-utils.js             # K-mer extraction (variable k-value support)
│   ├── table-renderer.js         # Results table UI with sorting/filtering
│   └── webr-init.js              # Optional WebR (R in browser) integration
├── data/                         # Signature databases
│   └── amr_signatures_sequences.json.gz  # Primary: 9,325 genes (1.2 MB, sequence-based)
├── build/                        # Database build scripts (for developers)
│   └── build-ncbi-dna-kmers.js   # Builds k-mer signatures from NCBI AMRFinderPlus sequences
└── .gitignore                    # Git ignore rules
```

## Database Format

The `data/amr_signatures_sequences.json.gz` contains 9,325 AMR gene signatures in **sequence-based format**:

```json
[
  {
    "gene_id": "blaNDM-1",
    "name": "NDM-1 Beta-Lactamase", 
    "sequence": "ACGTACGTACGT...",    # DNA sequence of the gene
    "length_bp": 813,                 # Gene length in base pairs
    "organism": "Enterobacteriaceae",
    "mechanism": "Beta-lactamase (carbapenem resistance)",
    "phenotype_note": "Genotype only; phenotype prediction not supported"
  },
  ...
]
```

**Key features:**
- Sequences can be analyzed with **any k-value** (15, 21, 31, etc.) at runtime
- Replaces legacy k-mer format (95% space savings: 28 MB → 1.2 MB)
- Supports both gzipped (1.2 MB) and uncompressed (12 MB) fallback
- Backwards compatible with k-mer matching algorithm

## Analysis Parameters

- **K-mer size** (default: 21 bp): Adjustable at runtime (15, 21, 31+). Higher k-values are more specific but require longer perfect matches.
- **Containment threshold** (default: 90%): Minimum % of gene k-mers required to report a hit. Lower threshold = more hits (sensitivity), higher = fewer hits (specificity).

## Limitations

1. **Genotype-only**: Does not predict phenotype, MIC, or clinical resistance outcomes.
2. **No alignment validation**: Only tests k-mer containment; does not perform sequence alignment or functional annotation.
3. **Fixed signature set**: Limited to 9,325 precomputed signatures; not a comprehensive database like AMRFinderPlus or CARD.
4. **Browser-based only**: Large genomes (>100 MB) may be slow; designed for typical bacterial assemblies (<10 MB).
5. **Privacy note**: While no data is uploaded to servers, be cautious uploading sensitive genome data to shared computers.

## Dependencies

### Required

- **Modern web browser** with ES6 module support
  - Chrome ≥ 61 | Firefox ≥ 67 | Safari ≥ 11 | Edge ≥ 79

### Optional

- **pako** (npm): For gzip decompression
  - Installed via `npm install pako` 
  - If unavailable, falls back to uncompressed database (12 MB, slower)
- **WebR** (CDN): For optional R-based k-mer analysis
  - Loads from `https://webr.r-wasm.org/`
  - If unavailable, JavaScript k-mer extraction is used (recommended, faster)

## Development & Database Building

### Source Code Structure

- `src/`: Application logic (modules for parsing, scoring, UI)
- `data/`: Signature databases
- `build/`: Scripts for building updated signature databases from NCBI data
  - `build-ncbi-dna-kmers.js`: Builds k-mer signatures from NCBI AMRFinderPlus DNA sequences
  - Run: `node build/build-ncbi-dna-kmers.js <input.fasta> <output.json.gz>`

### Build Development Server

```bash
# Install dependencies (optional)
npm install

# Start local server
python3 -m http.server 8000
# or
npm install -g http-server && http-server -p 8000
```

Visit [http://localhost:8000](http://localhost:8000)

### Rebuild Database (Advanced Users)

The database is pre-built, but to generate a new one from NCBI data:

```bash
cd build

# From NCBI AMRFinderPlus DNA sequences
node build-ncbi-dna-kmers.js /path/to/AMR_CDS.fa
# Output: ../data/amr_signatures_sequences.json.gz
```

## Browser Compatibility

- Chrome/Chromium ≥ 60
- Firefox ≥ 55
- Safari ≥ 11
- Edge ≥ 79

Requires:
- ES6 (async/await, fetch, FileReader API)
- IndexedDB (optional, for caching)

## Future Enhancements

- [ ] WebR integration for k-mer counting via `kmer` R package.
- [ ] Minimizer-based containment scoring.
- [ ] SNP detection and resistance-associated mutations.
- [ ] Phenotype prediction (requires external ML model; not in scope for genotype-only demo).
- [ ] WASM-based k-mer counter for speed.
- [ ] Larger, curated AMR signature packs (e.g., CARD, ResFinder, AMRFinderPlus panel).
- [ ] Export results as TSV/CSV.

## References

- **AMRFinderPlus**: https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinderPlus/
- **CARD**: https://card.mcmaster.ca/
- **ResFinder**: https://www.genomicepidemiology.org/

## License

MIT License. See [LICENSE](LICENSE) for details.

## Disclaimer

This tool is provided for **research and educational purposes only**. It is not intended for clinical diagnosis or treatment decisions. Always consult clinical microbiology guidelines and certified diagnostic laboratories for clinical or therapeutic guidance.

---

**Questions or Feedback?** Open an issue or contact the maintainers.
