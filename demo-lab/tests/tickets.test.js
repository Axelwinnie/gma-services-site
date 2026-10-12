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
const t = T.createTicket(s, { title: 'Grinder guard loose', requester: 'Marco (fab)', toolId: 'T-107', tagOut: true, priority: 'High' });
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
const j = T.createJha(m, { task: 'Test' }); thr(() => T.signOn(m, j.id, 'Marco (fab)'), 'sign on needs steps');
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
console.log(fail ? fail + ' FAILED' : 'ALL PASS'); process.exit(fail ? 1 : 0);
