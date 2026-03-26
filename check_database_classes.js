import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./data/amr_signatures.json', 'utf8'));

const classes = {};
data.forEach(sig => {
  const cls = sig.class || 'UNKNOWN';
  classes[cls] = (classes[cls] || 0) + 1;
});

console.log('Class distribution in database:');
Object.entries(classes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cls, count]) => {
    console.log(`  ${cls}: ${count}`);
  });

console.log(`\nTotal: ${data.length}`);
console.log(`\nVIRULENCE_TOXIN genes: ${classes['VIRULENCE_TOXIN'] || 0}`);
console.log(`TOXIN genes: ${classes['TOXIN'] || 0}`);

// Show sample VIRULENCE_TOXIN genes
const virGenes = data.filter(s => s.class === 'VIRULENCE_TOXIN').slice(0, 5);
console.log(`\nSample VIRULENCE_TOXIN genes:`);
virGenes.forEach(g => console.log(`  - ${g.gene_id}: ${g.name}`));
