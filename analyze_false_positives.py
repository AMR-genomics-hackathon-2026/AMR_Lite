#!/usr/bin/env python3

import json
import re
from collections import defaultdict

# Load real AMRFinderPlus results
real_hits = set()
with open('./data/S01098280_amrfinder.tsv', 'r') as f:
    for i, line in enumerate(f):
        if i == 0:
            continue  # Skip header
        parts = line.strip().split('\t')
        if len(parts) >= 6:
            gene_name = parts[5]
            real_hits.add(gene_name.lower())

print(f"Real AMRFinderPlus hits: {len(real_hits)}")
print(f"Genes: {sorted(real_hits)[:10]}...")

# Load signature database
with open('./data/amr_signatures.json', 'r') as f:
    signatures = json.load(f)

print(f"\nSignature database: {len(signatures)} genes")

# Analyze k-mer sizes and containment
short_genes = []
long_genes = []
for sig in signatures:
    n_kmers = sig.get('n_kmers', 0)
    if n_kmers < 100:
        short_genes.append((sig['gene_id'], n_kmers))
    else:
        long_genes.append((sig['gene_id'], n_kmers))

print(f"\nShort genes (<100 k-mers): {len(short_genes)}")
print(f"Long genes (≥100 k-mers): {len(long_genes)}")

# Find problematic genes (short, likely to have high false positive rate)
print(f"\nShort genes that could cause false positives (top 20):")
for gene, kmers in sorted(short_genes, key=lambda x: x[1])[:20]:
    status = "✓ In real results" if gene.lower() in real_hits else "✗ NOT in real results"
    print(f"  {gene}: {kmers} k-mers {status}")

# Analyze minimal thresholds
print("\n--- Threshold Analysis ---")
print("If minContainment=70% and minShared=50:")
for gene, kmers in sorted(short_genes, key=lambda x: x[1])[:10]:
    needed_at_70pct = int(kmers * 0.7)
    needed_at_90pct = int(kmers * 0.9)
    print(f"  {gene} ({kmers} k-mers): needs {needed_at_70pct} @ 70%, {needed_at_90pct} @ 90%")

print("\n--- Key Issues with K-mer Containment ---")
print("1. SHORT GENES: Genes with <100 k-mers need very few matches to exceed 70% threshold")
print("2. HOMOLOGY: Related genes share k-mers even without being the target gene")
print("3. DOMAINS: Conserved domains (like ATPase, helicase) appear in many unrelated genes")
print("4. NO LENGTH PENALTY: A 50-bp conserved domain triggers as many hits as a 1000-bp gene")
print("\n--- Possible Solutions ---")
print("✓ Increase containment to 90%+ (stricter)")
print("✓ Scale minShared by gene size: minShared = max(50, gene_kmers * 0.3)")
print("✓ Filter by 'Type' field: Only report 'AMR' type genes, not VIRULENCE/STRESS")
print("✓ Cross-validate with sequence identity: High k-mer match + low sequence ID = false positive")
print("✓ Use query coverage: Not just gene coverage, but what % of query genome matched")
