// Precomputes extraction results for the samples so they always load the same.
const fs = require('fs'), P = require('../public/demos/extract/fields.js');
const s = JSON.parse(fs.readFileSync('/tmp/extract-samples.json', 'utf8'));
s.forEach(d => { d.result = P.parse(d.text); });
fs.writeFileSync(__dirname + '/../public/demos/extract/samples.js', '/* Sample data, fictional. Results precomputed by tools/build-extract-samples.js */\nwindow.GMAExtractSamples = ' + JSON.stringify(s, null, 1) + ';\n');
s.forEach(d => { console.log('==', d.id); for (const [k, v] of Object.entries(d.result.fields)) console.log(k.padEnd(11), v.confidence.padEnd(8), v.value); console.log(d.result.line_items.length, 'items', d.result.checks.join(' | ')); });
