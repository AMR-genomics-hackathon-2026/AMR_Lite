#!/usr/bin/env python3
"""
Helper script to generate gzipped AMR signature pack
Usage: python scripts/gzip-signatures.py
"""

import gzip
import json
import os
from pathlib import Path

# Get paths
script_dir = Path(__file__).parent
base_dir = script_dir.parent
input_path = base_dir / "data" / "amr_signatures.json"
output_path = base_dir / "data" / "amr_signatures.json.gz"

print(f"Reading {input_path}...")
with open(input_path, 'r') as f:
    data_str = f.read()

data_bytes = data_str.encode('utf-8')
print(f"Original size: {len(data_bytes) / 1024:.1f} KB")

print("Compressing...")
with gzip.open(output_path, 'wb') as f:
    f.write(data_bytes)

compressed_size = os.path.getsize(output_path)
print(f"✓ Created {output_path}")
print(f"Compressed size: {compressed_size / 1024:.1f} KB")
print(f"Compression ratio: {compressed_size / len(data_bytes) * 100:.1f}%")
