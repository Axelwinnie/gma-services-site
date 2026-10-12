// node demo-lab/tests/extract.test.js
const P = require('../public/demos/extract/fields.js'); let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
global.window = {}; require('../public/demos/extract/samples.js'); const S = window.GMAExtractSamples;
const want = {
  invoice: { vendor: 'Northfield Steel Supply', doc_number: 'NSS-20418', date: '2026-09-18', po_number: '5521', job: 'Pine Hollow mezzanine', subtotal: '9892.30', tax: '618.27', total: '10510.57', items: 5 },
  estimate: { vendor: 'Kettle Brook Coatings', doc_number: 'KBC-0912', date: '2026-10-02', po_number: '', job: 'Entry canopy steel paint', subtotal: '8516.00', total: '8516.00', items: 4 },
  delivery: { vendor: 'Blue Ledge Building Supply', doc_number: 'BL-77810', date: '2026-10-05', po_number: '6104', subtotal: '', total: '', items: 4 }
};
S.forEach(s => {
  const r = P.parse(s.text), w = want[s.id];
  for (const k in w) if (k !== 'items') ok(r.fields[k].value === w[k], s.id + ' ' + k + ' got ' + r.fields[k].value);
  ok(r.line_items.length === w.items, s.id + ' items ' + r.line_items.length);
  ok(JSON.stringify(r) === JSON.stringify(s.result), s.id + ' precomputed result is stale, rerun tools/build-extract-samples.js');
});
// never invent: missing fields stay blank and flagged
const e = P.parse('Some Shop\nThanks for your business');
['doc_number', 'date', 'total', 'po_number', 'job'].forEach(k => ok(e.fields[k].value === '' && e.fields[k].confidence === 'missing', 'invent ' + k));
// mismatch gets flagged low
const m = P.parse('Acme Iron\nInvoice No: A-100\nQty Description Price Amount\n2 Bolts 5.00 10.00\nSubtotal $10.00\nTax $1.00\nTotal $99.00');
ok(m.fields.total.confidence === 'low', 'total mismatch flagged');
const d = P.parse('X Co\nDate: Sept 3, 2026'); ok(d.fields.date.value === '2026-09-03', 'month name date ' + d.fields.date.value);
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
