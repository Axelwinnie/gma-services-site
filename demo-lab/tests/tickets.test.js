// node demo-lab/tests/tickets.test.js
const T = require('../public/demos/ticket/tickets.js'); let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } };
const thr = (f, m) => { try { f(); ok(false, m); } catch (e) { } };
const s = T.seed(Date.UTC(2026, 9, 12, 14));
ok(T.overdue(s).map(t => t.id).join() === 'T-102,T-105,T-108', 'overdue ' + T.overdue(s).map(t => t.id));
ok(T.byPerson(s)['Marco (fab)'].length === 2, 'who has what');
thr(() => T.checkout(s, 'T-104', 'Kim (paint)', 1), 'repair tool blocked');
thr(() => T.checkout(s, 'T-101', 'Kim (paint)', 1), 'out tool blocked');
T.checkout(s, 'T-103', 'Kim (paint)', 2, 'J2052 MillPond'); ok(T.tool(s, 'T-103').holder === 'Kim (paint)', 'checkout');
T.checkin(s, 'T-102'); ok(T.overdue(s).length === 2, 'checkin clears overdue');
thr(() => T.createTicket(s, { title: '' }), 'ticket needs title');
const t = T.createTicket(s, { title: 'Grinder guard loose', requester: 'Marco (fab)', area: 'Fab bay 2', toolId: 'T-107', tagOut: true, priority: 'High' });
ok(t.id === 1049 && t.status === 'New' && T.tool(s, 'T-107').status === 'repair', 'create + tag out');
T.assign(s, t.id, 'Lou (maintenance)', 'Dana (office)'); ok(t.status === 'Assigned', 'assign moves status');
thr(() => T.setStatus(s, t.id, 'Done', 'Lou (maintenance)', ''), 'close needs note');
T.setStatus(s, t.id, 'Done', 'Lou (maintenance)', 'Tightened guard'); ok(T.tool(s, 'T-107').status === 'in', 'done returns tool');
ok(t.log.length === 3, 'log ' + t.log.length);
ok(T.seed().tickets.length === 4, 'fresh seed resets');
// --- modules
const m = T.seed(Date.UTC(2026, 9, 12, 14));
// LOTO blocks checkout and close, release by owner only
thr(() => T.checkout(m, 'T-104', 'Kim (paint)', 1), 'loto blocks checkout');
T.setStatus(m, 1046, 'In progress', 'Lou (maintenance)', '');
thr(() => T.setStatus(m, 1046, 'Done', 'Lou (maintenance)', 'fixed'), 'loto blocks close');
thr(() => T.releaseLock(m, 'LOTO-7', 'Kim (paint)'), 'only owner releases');
T.releaseLock(m, 'LOTO-7', 'Lou (maintenance)'); ok(T.rec(m.lotos, 'LOTO-7').released, 'released');
T.setStatus(m, 1046, 'Done', 'Lou (maintenance)', 'New bearings'); ok(T.tool(m, 'T-104').status === 'in', 'tool back after release + close');
thr(() => T.verifyLoto(m, 'LOTO-8'), 'verify needs lock');
T.applyLock(m, 'LOTO-8', 'Tess (welding)'); T.verifyLoto(m, 'LOTO-8'); ok(T.lotoState(T.rec(m.lotos, 'LOTO-8')) === 'locked, verified', 'loto8 state');
// JHA gate
thr(() => T.setStatus(m, 1048, 'In progress', 'Lou (maintenance)', ''), 'jha needs crew');
T.signOn(m, 'JHA-12', 'Lou (maintenance)'); T.setStatus(m, 1048, 'In progress', 'Lou (maintenance)', ''); ok(T.find(m, 1048).status === 'In progress', 'jha ok then start');
const j = T.createJha(m, { task: 'Test', ppe: ['Safety glasses'] }); thr(() => T.signOn(m, j.id, 'Marco (fab)'), 'sign on needs steps');
T.addStep(m, j.id, { step: 'a', hazards: 'b', controls: 'c' }); T.signOn(m, j.id, 'Marco (fab)'); ok(j.crew.length === 1, 'crew signed');
T.addStep(m, j.id, { step: 'd', hazards: 'e', controls: 'f' }); ok(j.crew.length === 0, 'change clears sign-ons');
// QA + NCR spawns ticket
thr(() => T.signOff(m, 'QA-302', 'Dana (office)'), 'cant sign with hold');
const n = T.raiseNcr(m, 'QA-302', 'Dana (office)'); const nt = T.find(m, n.ticket);
ok(nt && nt.ncr === n.id && nt.job === 'J2047 CedarRun' && nt.priority === 'High', 'ncr ticket');
thr(() => T.raiseNcr(m, 'QA-301', 'Dana (office)'), 'ncr needs fail/hold');
T.setCheck(m, 'QA-301', 3, 'pass'); T.signOff(m, 'QA-301', 'Dana (office)'); ok(T.qaState(T.rec(m.qa, 'QA-301')) === 'signed off', 'sign off');
// Requisitions
T.approveReq(m, 'RQ-88', 'Dana (office)'); ok(T.rec(m.reqs, 'RQ-88').po === '6140', 'po assigned');
thr(() => T.rejectReq(m, 'RQ-89', 'Dana (office)', ''), 'reject needs reason');
T.receiveReq(m, 'RQ-87', 'Lou (maintenance)'); ok(T.find(m, 1046).log.some(l => /Parts in/.test(l.text)), 'receive notes ticket');
// Rentals
const r5 = T.rec(m.rentals, 'RN-5'); ok(T.rentalAlert(r5, m.now) === 'overdue' && T.rentalCost(r5, m.now) === 12 * 145, 'rental cost/alert');
ok(T.rentalAlert(T.rec(m.rentals, 'RN-6'), m.now) === 'call off-rent', 'call off alert');
T.offRent(m, 'RN-5'); ok(T.rentalAlert(r5, m.now) === 'off rent', 'off rent');
// Analytics + dept filter
const A = T.analytics(T.seed(Date.UTC(2026, 9, 12, 14)));
ok(A.kpis.jhaPct === 50 && A.kpis.lotoActive === 1 && A.kpis.reqsPending === 2 && A.tips.length >= 3, 'analytics ' + JSON.stringify(A.kpis));
ok(T.analytics(T.seed(Date.UTC(2026, 9, 12, 14)), 'Paint').kpis.open === 0, 'dept filter');
// --- validation: no blank records
const v = T.seed(Date.UTC(2026, 9, 12, 14)), n0 = v.tools.length;
const fe = (f) => { try { f(); return null; } catch (e) { return e.fields || []; } };
ok(fe(() => T.addTool(v, { id: '', name: '', type: '', area: '' })).join() === 'id,name,type,area', 'tool all blank fields');
ok(fe(() => T.addTool(v, { id: 'T-110', name: '  ', type: 'Saw', area: 'Crib' })).join() === 'name', 'whitespace is blank');
ok(fe(() => T.addTool(v, { id: 'T-101', name: 'x', type: 'Saw', area: 'Crib' })).join() === 'id', 'dup tool id');
ok(fe(() => T.addTool(v, { id: 'T-110', name: 'x', type: 'Spaceship', area: 'Crib' })).join() === 'type', 'bad type');
ok(v.tools.length === n0, 'no blank tool saved');
T.addTool(v, { id: 't-110', name: 'Mag base', type: 'Measuring', area: 'Crib' }); ok(T.tool(v, 'T-110').status === 'in', 'tool added');
ok(fe(() => T.editTool(v, 'T-110', { name: '', type: 'Measuring', area: 'Crib' })).join() === 'name', 'edit blank');
ok(T.tool(v, 'T-110').name === 'Mag base', 'edit blank not saved');
const nt0 = v.tickets.length;
ok(fe(() => T.createTicket(v, { title: '', requester: 'Kim (paint)', area: '', priority: 'Normal' })).join() === 'title,area', 'ticket blanks');
ok(v.tickets.length === nt0, 'no blank ticket');
ok(fe(() => T.createReq(v, { item: '', qty: '', vendor: '', by: 'Kim (paint)' })).join() === 'item,qty,vendor', 'req blanks');
ok(fe(() => T.createReq(v, { item: 'x', qty: '1.5', vendor: 'V', by: 'K' })).join() === 'qty', 'req qty whole');
ok(fe(() => T.createRental(v, { item: '', vendor: '', days: '', rate: '' })).join() === 'item,vendor,days,rate', 'rental blanks');
ok(fe(() => T.createLoto(v, { machine: '', energy: [] })).join() === 'machine,energy', 'loto blanks');
ok(fe(() => T.createJha(v, { task: '', ppe: [] })).join() === 'task,ppe', 'jha blank');
ok(fe(() => T.createJha(v, { task: 'x', ppe: [] })).join() === 'ppe', 'jha needs ppe');
ok(fe(() => T.addStep(v, 'JHA-12', { step: 'a', hazards: '', controls: '' })).join() === 'hazards,controls', 'step blanks');
ok(fe(() => T.createQa(v, { job: '', part: '' })).join() === 'job,part', 'qa blanks');
// --- retag / LOTO sync
const r = T.seed(Date.UTC(2026, 9, 12, 14));
ok(fe(() => T.createTicket(r, { title: 'again', requester: 'Kim (paint)', area: 'Crib', priority: 'Normal', toolId: 'T-104', tagOut: true })).join() === 'equipment', 'no duplicate tag');
ok(fe(() => T.createLoto(r, { machine: 'T-104 Band saw, portable', toolId: 'T-104', energy: ['x'] })).join() === 'machine', 'no duplicate loto');
// release LOTO while ticket still open: tool stays tagged by the ticket
T.releaseLock(r, 'LOTO-7', 'Lou (maintenance)'); ok(T.tool(r, 'T-104').status === 'repair' && T.tool(r, 'T-104').ticket === 1046, 'ticket tag holds after release');
T.setStatus(r, 1046, 'Done', 'Lou (maintenance)', 'fixed'); ok(T.tool(r, 'T-104').status === 'in' && T.tool(r, 'T-104').ticket === null, 'tag cleared on close');
// re-tag after release + close
const rt = T.createTicket(r, { title: 'Saw again', requester: 'Tess (welding)', area: 'Crib', priority: 'High', toolId: 'T-104', tagOut: true });
ok(T.tool(r, 'T-104').status === 'repair' && T.tool(r, 'T-104').ticket === rt.id, 're-tag after release');
// re-lock a released LOTO record
T.applyLock(r, 'LOTO-7', 'Lou (maintenance)'); ok(!T.rec(r.lotos, 'LOTO-7').released && T.tool(r, 'T-104').loto === 'LOTO-7', 're-lock released record');
ok(T.rec(r.lotos, 'LOTO-7').verified === false, 'new lock needs fresh verify');
// LOTO on a tool with no ticket: tool tagged, no dangling ticket, back in after release
const lk = T.createLoto(r, { machine: 'T-107 Plasma cutter, hand', toolId: 'T-107', energy: ['Electrical'] });
T.applyLock(r, lk.id, 'Kim (paint)'); ok(T.tool(r, 'T-107').status === 'repair' && T.tool(r, 'T-107').ticket === null, 'loto only tag');
thr(() => T.checkout(r, 'T-107', 'Marco (fab)', 1), 'loto blocks checkout (no ticket)');
T.releaseLock(r, lk.id, 'Kim (paint)'); ok(T.tool(r, 'T-107').status === 'in', 'back in after release');
// locking an out tool pulls it back
const lk2 = T.createLoto(r, { machine: 'T-101 Mag drill', toolId: 'T-101', energy: ['Electrical'] }); T.applyLock(r, lk2.id, 'Lou (maintenance)');
ok(T.tool(r, 'T-101').status === 'repair' && !T.tool(r, 'T-101').holder, 'out tool locked');
// closing a ticket keeps the tool tagged if a LOTO with no ticket is still on it
const t2 = T.createTicket(r, { title: 'Drill cord', requester: 'Marco (fab)', area: 'Fab', priority: 'Normal', toolId: 'T-101', tagOut: true });
T.setStatus(r, t2.id, 'Done', 'Lou (maintenance)', 'new cord'); ok(T.tool(r, 'T-101').status === 'repair', 'loto still holds after ticket close');
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
