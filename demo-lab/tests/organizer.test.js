// node demo-lab/tests/organizer.test.js
const O = require('../public/demos/organizer/organizer.js'); let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
global.window = {}; require('../public/demos/organizer/samples.js'); const S = window.GMAOrganizerSamples;
const rows = O.plan(S, O.DEFAULT_RULES), by = n => rows.find(r => r.original === n);
ok(by('INV 20418 northfield pine hollow 9-18-26.pdf').path === 'J2041-PineHollow/Invoice/2026-09-18_J2041-PineHollow_Invoice_NorthfieldSteel.pdf', 'invoice path');
ok(by('kettlebrook invoice cedar run Oct2 2026.pdf').date === '2026-10-02', 'month name date');
ok(by('delivery ticket blue ledge 100526 mill pond.pdf').date === '2026-10-05', 'mmddyy date');
ok(by('cr stair shop dwg rev B 20260915.pdf').newName === '2026-09-15_J2047-CedarRun_Drawing.pdf', 'drawing no vendor');
ok(by('PO 5521 pinehollow Northfield (1).pdf').status === 'duplicate', 'dup (1)');
ok(by('copy of IMG_4472 pine hollow mezz deck.jpg').status === 'duplicate', 'dup copy of');
ok(by('Scan_0007.pdf').status === 'review' && by('Scan_0007.pdf').newName === 'Scan_0007.pdf', 'unknown kept');
ok(by('pine hollow cedar run combined dwg.pdf').status === 'review', 'two jobs not guessed');
ok(by('PO 5521 pinehollow Northfield.pdf').status === 'check', 'file date flagged');
// no file date fallback: name without date goes to review
ok(O.plan([{ name: 'inv nss pine hollow.pdf', size: 1 }], O.DEFAULT_RULES)[0].status === 'review', 'no date review');
// same target name gets a suffix
const c = O.plan([{ name: 'inv nss 2041 2026-01-02.pdf', size: 1 }, { name: 'invoice northfield pine hollow 1-2-26.pdf', size: 2 }], O.DEFAULT_RULES);
ok(c[1].newName.endsWith('_2.pdf'), 'collision suffix ' + c[1].newName);
const csv = O.toCsv(rows); ok(csv.split('\r\n').length === S.length + 2, 'csv rows');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
