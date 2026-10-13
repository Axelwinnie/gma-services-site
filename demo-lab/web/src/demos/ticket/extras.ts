/* eslint-disable @typescript-eslint/no-explicit-any */
/* Demo-only additions on top of the shared ticket model: punchlist, templates,
   notifications, automation log and sample history for trends. Fictional data. */
const DAY = 86400000;
export const PUNCH_STATUSES = ["Open", "In progress", "Ready to verify", "Verified"];

export function seedExtras(s: any) {
  const t = (d: number) => s.now - d * DAY;
  s.punch = [
    { id: "PL-21", job: "J2041 PineHollow", location: "Mezz grid C/4", item: "Touch up primer at field bolts", assignee: "Kim (paint)", status: "Open", due: t(-3), createdAt: t(2) },
    { id: "PL-22", job: "J2041 PineHollow", location: "Mezz stair top", item: "Missing kick plate on landing", assignee: "Marco (fab)", status: "In progress", due: t(-1), createdAt: t(3) },
    { id: "PL-23", job: "J2047 CedarRun", location: "Stringer S2", item: "Grind weld spatter at bottom bracket", assignee: "Tess (welding)", status: "Ready to verify", due: t(1), createdAt: t(5) },
    { id: "PL-24", job: "J2052 MillPond", location: "Canopy post C3", item: "Anchor nut washers not installed", assignee: "Ray (shipping)", status: "Open", due: t(-4), createdAt: t(1) },
    { id: "PL-20", job: "J2047 CedarRun", location: "Rail R-1", item: "Cap open pipe end", assignee: "Marco (fab)", status: "Verified", due: t(4), createdAt: t(9), verifiedBy: "Dana (office)" },
  ];
  s.nextPunch = 25;
  s.templates = [
    { id: "TPL-1", kind: "Ticket", name: "Welder lead or clamp damaged", body: { title: "Welder lead or ground clamp damaged", area: "Weld bay", priority: "High", notes: "Tag out the welder until the lead is replaced." } },
    { id: "TPL-2", kind: "Ticket", name: "Overhead door not closing", body: { title: "Overhead door not closing all the way", area: "Fab bay 2", priority: "Normal", notes: "Check track, rollers and limit switch." } },
    { id: "TPL-3", kind: "QA", name: "Beam fit-up and weld check", body: { part: "Beam", checks: ["Fit-up", "Weld visual", "Dimensions", "Coating"] } },
    { id: "TPL-4", kind: "QA", name: "Stair and rail final", body: { part: "Stair", checks: ["Fit-up", "Weld visual", "Dimensions", "Coating"] } },
    { id: "TPL-5", kind: "JHA", name: "Grinding and cutting", body: { task: "Grind and cut with angle grinder", ppe: ["Safety glasses", "Face shield", "Leather gloves", "Hearing protection"], steps: [{ step: "Inspect guard and wheel", hazards: "Wheel burst", controls: "Right wheel for the RPM, guard on" }, { step: "Grind", hazards: "Sparks, flying debris", controls: "Face shield, clear the area of combustibles" }] } },
    { id: "TPL-6", kind: "JHA", name: "Work from a scissor lift", body: { task: "Work from a scissor lift", ppe: ["Hard hat", "Harness"], steps: [{ step: "Pre-use inspection", hazards: "Equipment failure", controls: "Walk-around checklist, test controls" }, { step: "Raise and work", hazards: "Falls, tip over", controls: "Firm level ground, rails closed, tie off" }] } },
  ];
  s.nextTpl = 7;
  s.readNotes = {};
  s.channels = { inApp: true, email: false, sms: false, digest: true };
  s.autoLog = [{ at: s.now, kind: "info", text: "Sandbox started with sample shop data." }];
  s.health = { lastRun: 0, started: s.now };
  // Sample history for QA/QC and ticket trends, last 8 weeks. Same numbers every visit.
  const seq = [[6, 5, 1, 0, 4, 3], [7, 6, 0, 1, 5, 5], [5, 4, 1, 0, 6, 4], [8, 7, 1, 0, 3, 5], [6, 4, 1, 1, 7, 6], [9, 8, 1, 0, 5, 4], [7, 6, 1, 0, 4, 6], [0, 0, 0, 0, 0, 0]];
  s.history = seq.map((r, i) => ({ week: t((7 - i) * 7), inspections: r[0], passed: r[1], held: r[2], failed: r[3], opened: r[4], closed: r[5] }));
  return s;
}

export function blank(v: unknown) { return v == null || String(v).trim() === ""; }
function err(msg: string, fields: string[] = []) { const e: any = new Error(msg); e.fields = fields; return e; }

export function createPunch(s: any, f: any) {
  const miss = [["job", "job"], ["location", "location"], ["item", "what needs doing"], ["assignee", "who's on it"], ["days", "due in days"]].filter(([k]) => blank(f[k]));
  if (miss.length) throw err("Fill in " + miss.map((m) => m[1]).join(", ") + ".", miss.map((m) => m[0]));
  if (!(+f.days >= 0) || +f.days !== Math.floor(+f.days)) throw err("Due in days has to be a whole number, zero or more.", ["days"]);
  const p = { id: "PL-" + s.nextPunch++, job: f.job, location: f.location.trim(), item: f.item.trim(), assignee: f.assignee, status: "Open", due: s.now + +f.days * DAY, createdAt: s.now };
  s.punch.unshift(p); return p;
}
export function movePunch(s: any, id: string, status: string, who: string) {
  const p = s.punch.find((x: any) => x.id === id);
  if (status === "Verified" && p.status !== "Ready to verify") throw err("Mark it ready to verify first, then someone checks it.");
  if (status === "Verified" && who === p.assignee) throw err("Someone other than " + p.assignee + " has to verify their own punch item.");
  p.status = status; if (status === "Verified") p.verifiedBy = who; return p;
}

export function notifications(s: any, T: any) {
  const out: { id: string; tone: string; title: string; text: string; view: string; ticket?: number }[] = [];
  s.tickets.filter((t: any) => t.status !== "Done" && t.priority.indexOf("Down") === 0).forEach((t: any) => out.push({ id: "down-" + t.id, tone: "red", title: "Work stopped", text: `#${t.id} ${t.title}`, view: "dashboard", ticket: t.id }));
  s.tickets.filter((t: any) => t.status === "New" && !t.assignee).forEach((t: any) => out.push({ id: "new-" + t.id, tone: "orange", title: "Needs an assignee", text: `#${t.id} ${t.title}`, view: "dashboard", ticket: t.id }));
  T.overdue(s).forEach((tl: any) => out.push({ id: "late-" + tl.id, tone: "orange", title: "Tool late back to the crib", text: `${tl.id} ${tl.name}, out with ${tl.holder}`, view: "records" }));
  s.rentals.forEach((r: any) => { const a = T.rentalAlert(r, s.now); if (a === "overdue" || a === "call off-rent") out.push({ id: "rent-" + r.id + a, tone: a === "overdue" ? "red" : "yellow", title: a === "overdue" ? "Rental past due back" : "Call off-rent today", text: `${r.id} ${r.item}`, view: "rent" }); });
  s.reqs.filter((r: any) => r.status === "Requested").forEach((r: any) => out.push({ id: "req-" + r.id, tone: "blue", title: "Requisition waiting on approval", text: `${r.id} ${r.item} x${r.qty}`, view: "req" }));
  s.qa.forEach((q: any) => { const st = T.qaState(q); if (st === "hold" || st === "fail") out.push({ id: "qa-" + q.id + st, tone: "yellow", title: "Inspection " + st, text: `${q.id} ${q.part}`, view: "qa" }); });
  s.punch.filter((p: any) => p.status !== "Verified" && p.due < s.now).forEach((p: any) => out.push({ id: "pl-" + p.id, tone: "orange", title: "Punch item past due", text: `${p.id} ${p.item}`, view: "punch" }));
  s.lotos.filter((l: any) => !l.released && l.locks.length && !l.verified).forEach((l: any) => out.push({ id: "loto-" + l.id, tone: "red", title: "Lockout not verified", text: `${l.id} ${l.machine}`, view: "records" }));
  return out;
}

export function healthChecks(s: any, T: any) {
  const before = JSON.stringify(s.tools.map((t: any) => [t.id, t.status]));
  const copy = JSON.parse(JSON.stringify(s)); T.syncAll(copy);
  const after = JSON.stringify(copy.tools.map((t: any) => [t.id, t.status]));
  const jhaMiss = s.tickets.filter((t: any) => t.status === "In progress" && t.jhaRequired && !(t.jha && T.jha(s, t.jha)?.crew.length));
  const doneLocked = s.tickets.filter((t: any) => t.status === "Done" && T.activeLoto(s, { ticket: t.id }));
  const orphanReq = s.reqs.filter((r: any) => r.ticket && !T.find(s, r.ticket));
  return [
    { name: "Sandbox data store", ok: true, text: "In memory in this tab. Nothing is saved or sent." },
    { name: "Tool tag state matches tickets and LOTO", ok: before === after, text: before === after ? "All " + s.tools.length + " crib tools agree." : "Tag state drifted, run Reset Demo." },
    { name: "JHA signed before work starts", ok: !jhaMiss.length, text: jhaMiss.length ? jhaMiss.length + " ticket(s) in progress without a signed JHA." : "Every in-progress ticket that needs a JHA has one." },
    { name: "No closed ticket with an active lockout", ok: !doneLocked.length, text: doneLocked.length ? doneLocked.length + " found." : "None found." },
    { name: "Requisitions link to real tickets", ok: !orphanReq.length, text: orphanReq.length ? orphanReq.length + " broken link(s)." : "All links resolve." },
    { name: "Notifications", ok: true, text: "Demo only. Email and text are switched off and never sent." },
  ];
}
