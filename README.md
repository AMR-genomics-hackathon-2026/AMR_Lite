# AMR Lite

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

### Option 1: Double-Click (No Terminal)

1. Clone or download this repository.
2. Open `index.html` by double-clicking it in your file manager.
3. Select a FASTA file (`.fasta`, `.fa`, `.fna`, or gzipped variants).
4. Adjust k-mer size and containment threshold if needed.
5. Click **Run Analysis**.

### Option 2: Serve Locally (Recommended for Dev)

```bash
cd amr-lite
npm install
npm run serve
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Option 3: npx serve

```bash
cd amr-lite
npx serve .
```

## Project Structure

```
amr-lite/
├── index.html                 # Main UI (semantic HTML + accessibility)
├── app.js                     # Core logic: FASTA parsing, k-mer extraction, scoring
├── style.css                  # Responsive styling
├── package.json               # Optional npm tooling (pako, dev scripts)
├── .editorconfig              # Editor config (indentation, charset)
├── .gitignore                 # Git ignore patterns (node_modules, macOS, etc.)
├── LICENSE                    # MIT License
├── README.md                  # This file
├── assets/                    # Static assets (images, fonts, etc.)
└── data/
    └── amr_signatures.json.gz # Precomputed signature pack (gzipped JSON)
```

## How It Works

### 1. Load Genome

Upload an assembled genome in FASTA format (.fasta, .fa, .fna, or gzipped).

### 2. Extract K-mers

The app extracts all k-mers (default 21 bp) from your genome sequence using a sliding window.

### 3. Compare Against Signatures

For each AMR gene signature in the pack, it calculates the percentage of that gene's k-mers found in your genome (k-mer containment).

### 4. Report Results

Genes exceeding the containment threshold (default 90%) are reported with:
- **Gene ID** and name
- **Organism** association
- **Mechanism** (e.g., beta-lactamase, efflux pump)
- **Containment %** (higher = stronger signal)

## Signature Pack Format

The `data/amr_signatures.json.gz` file contains a JSON structure like:

```json
{
  "blaNDM-1": {
    "name": "NDM-1 Beta-Lactamase",
    "organism": "Enterobacteriaceae",
    "kmers": ["ACGTACGTACGTACGTACGTA", "..."],
    "mechanism": "Beta-lactamase (carbapenem resistance)",
    "phenotype_note": "Genotype only; phenotype prediction not supported"
  },
  ...
}
```

See `app.js` > `createMockSignatures()` for the demo signature structure.

## Parameters

- **K-mer size** (default: 21): Standard for AMR gene signatures; adjust for sensitivity/specificity.
- **Containment threshold** (default: 90%): Minimum % of gene k-mers required to report a hit.

## Limitations

1. **Genotype-only**: Does not predict phenotype, MIC, or clinical resistance.
2. **No full assembly validation**: Only tests k-mer containment; does not perform alignment or functional annotation.
3. **Fixed signature pack**: Limited to precomputed signatures; not a comprehensive AMR database like AMRFinderPlus or CARD.
4. **No minimizer optimization**: Uses naive k-mer extraction; could be optimized with minimizers for speed.

## Dependencies

### Required

- Modern web browser (Chrome, Firefox, Safari, Edge).

### Optional

- **`pako`** (npm): For gzip decompression support.
  - Install: `npm install --save pako`
  - If not available, `.gz` files will fail gracefully.

## Development

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build (if needed)

```bash
npm run build
```

### Lint

Currently no linting configured; add ESLint if desired.

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
- **K-mer containment methods**: [arXiv](https://arxiv.org/search/?query=kmer+containment)

## License

MIT License. See [LICENSE](LICENSE) for details.

## Disclaimer

This tool is provided for **research and educational purposes only**. It is not intended for clinical diagnosis or treatment decisions. Always consult clinical microbiology guidelines and certified diagnostic laboratories for clinical or therapeutic guidance.

---

**Questions or Feedback?** Open an issue or contact the maintainers.
