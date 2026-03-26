#!/usr/bin/env node

/**
 * Helper script to generate gzipped AMR signature pack
 * Usage: node scripts/gzip-signatures.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const inputPath = path.join(__dirname, '../data/amr_signatures.json');
const outputPath = path.join(__dirname, '../data/amr_signatures.json.gz');

console.log(`Reading ${inputPath}...`);
const data = fs.readFileSync(inputPath);

console.log(`Compressing (${(data.length / 1024).toFixed(1)} KB)...`);
zlib.gzip(data, (err, compressed) => {
  if (err) {
    console.error('❌ Gzip failed:', err);
    process.exit(1);
  }
  
  fs.writeFileSync(outputPath, compressed);
  console.log(`✓ Created ${outputPath} (${(compressed.length / 1024).toFixed(1)} KB)`);
  console.log(`Compression ratio: ${(compressed.length / data.length * 100).toFixed(1)}%`);
});
