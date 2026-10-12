/* In-memory model for the Tool Ticket System sandbox. Fictional data only.
   Nothing is stored. A new visit starts from the same sample state. */
(function (root) {
  var STATUSES = ["New", "Assigned", "In progress", "Waiting on parts", "Done"];
  var PRIORITIES = ["Low", "Normal", "High", "Down (stops work)"];
  var DAY = 86400000;

  function seed(now) {
    now = now || Date.now();
    var t = function (days) { return now - days * DAY; };
    return {
      now: now, nextTicket: 1049,
      people: ["Dana (office)", "Marco (fab)", "Tess (welding)", "Lou (maintenance)", "Ray (shipping)", "Kim (paint)"],
      tools: [
        { id: "T-101", name: "Magnetic drill press 1-3/8\"", area: "Fab bay 1", status: "out", holder: "Marco (fab)", outAt: t(1), dueAt: t(-2), job: "J2041 PineHollow" },
        { id: "T-102", name: "Cordless 1/2\" impact", area: "Tool crib", status: "out", holder: "Ray (shipping)", outAt: t(6), dueAt: t(2), job: "J2052 MillPond" },
        { id: "T-103", name: "4-1/2\" angle grinder", area: "Tool crib", status: "in", holder: "", outAt: 0, dueAt: 0, job: "" },
        { id: "T-104", name: "Band saw, portable", area: "Tool crib", status: "repair", holder: "", outAt: 0, dueAt: 0, job: "", ticket: 1046 },
        { id: "T-105", name: "Torque wrench 50-250 ft-lb", area: "Tool crib", status: "out", holder: "Tess (welding)", outAt: t(3), dueAt: t(1), job: "J2047 CedarRun" },
        { id: "T-106", name: "Laser level", area: "Office", status: "in", holder: "", outAt: 0, dueAt: 0, job: "" },
        { id: "T-107", name: "Plasma cutter, hand", area: "Fab bay 2", status: "in", holder: "", outAt: 0, dueAt: 0, job: "" },
        { id: "T-108", name: "Chain hoist 2 ton", area: "Yard", status: "out", holder: "Marco (fab)", outAt: t(9), dueAt: t(4), job: "J2047 CedarRun" }
      ],
      depts: { "Dana (office)": "Office", "Marco (fab)": "Fab", "Tess (welding)": "Welding", "Lou (maintenance)": "Maintenance", "Ray (shipping)": "Shipping", "Kim (paint)": "Paint" },
      tickets: [
        { id: 1046, title: "Portable band saw blade keeps walking off", equipment: "T-104 Band saw, portable", area: "Tool crib", priority: "High", status: "Waiting on parts", requester: "Tess (welding)", assignee: "Lou (maintenance)", job: "", createdAt: t(4),
          log: [{ at: t(4), who: "Tess (welding)", text: "Blade tracks off after a few cuts. Tagged out." }, { at: t(3), who: "Lou (maintenance)", text: "Guide bearings worn. Ordered a pair from Northfield Steel Supply, PO 6131." }] },
        { id: 1047, title: "Overhead door in bay 2 sticks halfway", equipment: "Bay 2 overhead door", area: "Fab bay 2", priority: "Normal", status: "Assigned", requester: "Ray (shipping)", assignee: "Lou (maintenance)", job: "", jhaRequired: true, jha: "JHA-13", createdAt: t(2),
          log: [{ at: t(2), who: "Ray (shipping)", text: "Have to push it the rest of the way. Slows down loading." }] },
        { id: 1048, title: "Welder 3 ground clamp cracked", equipment: "Welder 3", area: "Weld bay", priority: "Down (stops work)", status: "New", requester: "Tess (welding)", assignee: "", job: "J2047 CedarRun", jhaRequired: true, jha: "JHA-12", createdAt: t(0.2),
          log: [{ at: t(0.2), who: "Tess (welding)", text: "Clamp split, can't get a good ground. Using welder 2 for now." }] },
        { id: 1043, title: "Paint booth filter change", equipment: "Paint booth", area: "Paint", priority: "Low", status: "Done", requester: "Kim (paint)", assignee: "Lou (maintenance)", job: "", createdAt: t(8),
          log: [{ at: t(8), who: "Kim (paint)", text: "Filters loaded up." }, { at: t(7), who: "Lou (maintenance)", text: "Swapped intake and exhaust filters. Closed." }] }
      ],
      qa: [
        { id: "QA-301", job: "J2041 PineHollow", part: "Mezz beam B4", inspector: "", signedBy: "", signedAt: 0, ncr: "",
          checks: [{ item: "Fit-up", result: "pass", note: "" }, { item: "Weld visual", result: "pass", note: "" }, { item: "Dimensions", result: "pass", note: "" }, { item: "Coating", result: "", note: "" }] },
        { id: "QA-302", job: "J2047 CedarRun", part: "Stair stringer S2", inspector: "", signedBy: "", signedAt: 0, ncr: "",
          checks: [{ item: "Fit-up", result: "pass", note: "" }, { item: "Weld visual", result: "hold", note: "Undercut at top landing, check with welder" }, { item: "Dimensions", result: "", note: "" }, { item: "Coating", result: "", note: "" }] },
        { id: "QA-299", job: "J2052 MillPond", part: "Canopy post C1", inspector: "Dana (office)", signedBy: "Dana (office)", signedAt: t(5), ncr: "",
          checks: [{ item: "Fit-up", result: "pass", note: "" }, { item: "Weld visual", result: "pass", note: "" }, { item: "Dimensions", result: "pass", note: "" }, { item: "Coating", result: "pass", note: "" }] }
      ],
      ncrs: [],
      jhas: [
        { id: "JHA-12", task: "Swap welder ground clamp and lead", job: "", steps: [{ step: "Shut off and lock out welder 3", hazards: "Shock", controls: "LOTO at disconnect, verify zero energy" }, { step: "Replace clamp and lead", hazards: "Cuts, pinch points", controls: "Cut-resistant gloves" }], ppe: ["Safety glasses", "Leather gloves"], crew: [] },
        { id: "JHA-13", task: "Overhead door spring and track work", job: "", steps: [{ step: "Lock out door operator", hazards: "Unexpected start", controls: "LOTO, tag at operator" }, { step: "Release spring tension", hazards: "Stored energy, struck by", controls: "Winding bars only, stand clear" }, { step: "Work from lift", hazards: "Falls", controls: "Harness tied off in basket" }], ppe: ["Hard hat", "Safety glasses", "Harness"], crew: [{ who: "Lou (maintenance)", at: t(1) }] }
      ],
      reqs: [
        { id: "RQ-87", job: "", item: "Band saw guide bearings (pair)", qty: 1, vendor: "Northfield Steel Supply", by: "Lou (maintenance)", status: "Ordered", po: "6131", ticket: 1046, note: "" },
        { id: "RQ-88", job: "J2047 CedarRun", item: "HSS4x4x1/4 x 20 ft", qty: 6, vendor: "Northfield Steel Supply", by: "Marco (fab)", status: "Requested", po: "", ticket: null, note: "" },
        { id: "RQ-89", job: "J2052 MillPond", item: "Gray primer, 5 gal", qty: 2, vendor: "Kettle Brook Coatings", by: "Kim (paint)", status: "Requested", po: "", ticket: null, note: "" },
        { id: "RQ-86", job: "J2041 PineHollow", item: "3/4 in A325 bolt kits", qty: 4, vendor: "Blue Ledge Building Supply", by: "Ray (shipping)", status: "Received", po: "6122", ticket: null, note: "" }
      ],
      rentals: [
        { id: "RN-5", item: "19 ft scissor lift", vendor: "Blue Ledge Building Supply", job: "J2052 MillPond", onRent: t(12), dueBack: t(1), rate: 145, offAt: 0 },
        { id: "RN-6", item: "Engine-drive welder", vendor: "Northfield Steel Supply", job: "J2047 CedarRun", onRent: t(4), dueBack: t(-0.5), rate: 95, offAt: 0 },
        { id: "RN-7", item: "Carry deck crane, 8 ton", vendor: "Blue Ledge Building Supply", job: "J2041 PineHollow", onRent: t(2), dueBack: t(-5), rate: 610, offAt: 0 }
      ],
      lotos: [
        { id: "LOTO-7", machine: "T-104 Band saw, portable", toolId: "T-104", ticket: 1046, energy: ["Electrical, 120V plug"], locks: [{ owner: "Lou (maintenance)", at: t(4) }], verified: true, released: false },
        { id: "LOTO-8", machine: "Welder 3", toolId: "", ticket: 1048, energy: ["Electrical, 480V disconnect", "Shielding gas cylinder"], locks: [], verified: false, released: false }
      ],
      nextQa: 303, nextNcr: 1, nextJha: 14, nextReq: 90, nextRental: 8, nextLoto: 9, nextPo: 6140
    };
  }
  function find(s, id) { return s.tickets.filter(function (t) { return t.id === +id; })[0]; }
  function tool(s, id) { return s.tools.filter(function (t) { return t.id === id; })[0]; }
  function createTicket(s, f) {
    if (!f.title || !f.requester) throw new Error("A ticket needs a short title and who it's from.");
    var t = { id: s.nextTicket++, title: f.title, equipment: f.equipment || "", area: f.area || "", priority: PRIORITIES.indexOf(f.priority) >= 0 ? f.priority : "Normal", status: "New", requester: f.requester, assignee: "", job: f.job || "", createdAt: s.now, log: [{ at: s.now, who: f.requester, text: f.notes || "Opened." }], photos: [] };
    s.tickets.unshift(t);
    if (f.toolId && f.tagOut) { var tl = tool(s, f.toolId); if (tl) { tl.status = "repair"; tl.holder = ""; tl.ticket = t.id; } }
    return t;
  }
  function setStatus(s, id, status, who, note) {
    var t = find(s, id); if (STATUSES.indexOf(status) < 0) throw new Error("Unknown status");
    if (status === "Done" && !note) throw new Error("Add a close-out note before marking it done.");
    if (status === "In progress" && t.jhaRequired) {
      var j = t.jha && jha(s, t.jha);
      if (!j) throw new Error("This ticket needs a JHA before work starts. Build one on the JHA tab and link it.");
      if (!j.crew.length) throw new Error(j.id + " has nobody signed on yet. The crew signs on before work starts.");
    }
    if (status === "Done") { var lk = activeLoto(s, { ticket: t.id }); if (lk) throw new Error(lk.id + " on " + lk.machine + " is still locked out. Release it before closing."); }
    t.status = status; t.log.push({ at: s.now, who: who, text: "Status: " + status + (note ? ". " + note : "") });
    if (status === "Done") s.tools.forEach(function (tl) { if (tl.ticket === t.id && tl.status === "repair") { tl.status = "in"; tl.ticket = null; } });
    return t;
  }
  function assign(s, id, person, who) { var t = find(s, id); t.assignee = person; if (t.status === "New") t.status = "Assigned"; t.log.push({ at: s.now, who: who, text: "Assigned to " + person }); return t; }
  function addNote(s, id, who, text) { var t = find(s, id); if (!text) throw new Error("Note is empty."); t.log.push({ at: s.now, who: who, text: text }); return t; }
  function checkout(s, id, person, days, job) {
    var tl = tool(s, id);
    var lk = activeLoto(s, { toolId: id }); if (lk) throw new Error(tl.name + " is locked out under " + lk.id + ".");
    if (tl.status === "repair") throw new Error(tl.name + " is tagged out for repair.");
    if (tl.status === "out") throw new Error(tl.name + " is already out with " + tl.holder + ".");
    tl.status = "out"; tl.holder = person; tl.outAt = s.now; tl.dueAt = s.now + (days || 1) * DAY; tl.job = job || ""; return tl;
  }
  function checkin(s, id) { var tl = tool(s, id); tl.status = "in"; tl.holder = ""; tl.outAt = 0; tl.dueAt = 0; tl.job = ""; return tl; }
  function jha(s, id) { return s.jhas.filter(function (j) { return j.id === id; })[0]; }
  function rec(list, id) { return list.filter(function (r) { return r.id === id; })[0]; }
  function activeLoto(s, q) { return s.lotos.filter(function (l) { return !l.released && (q.ticket ? l.ticket === q.ticket : l.toolId === q.toolId); })[0]; }
  // QA/QC
  var RESULTS = ["pass", "fail", "hold"];
  function setCheck(s, id, i, result, note) { var q = rec(s.qa, id); if (q.signedBy) throw new Error(id + " is signed off."); if (result && RESULTS.indexOf(result) < 0) throw new Error("Unknown result"); q.checks[i].result = result; if (note != null) q.checks[i].note = note; return q; }
  function qaState(q) { var r = q.checks.map(function (c) { return c.result; }); return q.signedBy ? "signed off" : r.indexOf("fail") >= 0 ? "fail" : r.indexOf("hold") >= 0 ? "hold" : r.indexOf("") >= 0 ? "open" : "ready to sign"; }
  function signOff(s, id, who) { var q = rec(s.qa, id), st = qaState(q); if (st !== "ready to sign") throw new Error("Every check has to pass before " + id + " can be signed off."); q.signedBy = who; q.signedAt = s.now; return q; }
  function createQa(s, f) { if (!f.job || !f.part) throw new Error("Pick a job and name the part."); var q = { id: "QA-" + s.nextQa++, job: f.job, part: f.part, signedBy: "", signedAt: 0, ncr: "", checks: ["Fit-up", "Weld visual", "Dimensions", "Coating"].map(function (c) { return { item: c, result: "", note: "" }; }) }; s.qa.unshift(q); return q; }
  function raiseNcr(s, id, who, desc) {
    var q = rec(s.qa, id); if (q.ncr) throw new Error(id + " already has " + q.ncr + ".");
    var bad = q.checks.filter(function (c) { return c.result === "fail" || c.result === "hold"; });
    if (!bad.length) throw new Error("An NCR needs a failed or held check.");
    var n = { id: "NCR-" + String(s.nextNcr++).padStart(3, "0"), qa: q.id, job: q.job, part: q.part, desc: desc || bad.map(function (c) { return c.item + ": " + (c.note || c.result); }).join("; "), by: who, at: s.now, status: "Open" };
    var t = createTicket(s, { title: n.id + " " + q.part + " rework", equipment: q.part, area: "QA", priority: "High", job: q.job, notes: n.desc, requester: who });
    n.ticket = t.id; t.ncr = n.id; q.ncr = n.id; s.ncrs.unshift(n); return n;
  }
  // JHA
  function createJha(s, f) { if (!f.task) throw new Error("Name the task."); var j = { id: "JHA-" + s.nextJha++, task: f.task, job: f.job || "", steps: [], ppe: f.ppe || [], crew: [] }; s.jhas.unshift(j); return j; }
  function addStep(s, id, st) { if (!st.step || !st.hazards || !st.controls) throw new Error("Each step needs the step, the hazards and the controls."); var j = jha(s, id); j.steps.push(st); j.crew = []; return j; }
  function signOn(s, id, who) { var j = jha(s, id); if (!j.steps.length) throw new Error("Add at least one step before the crew signs on."); if (j.crew.some(function (c) { return c.who === who; })) throw new Error(who + " already signed on."); j.crew.push({ who: who, at: s.now }); return j; }
  function linkJha(s, ticketId, jhaId, who) { var t = find(s, ticketId); t.jha = jhaId; t.log.push({ at: s.now, who: who, text: "Linked " + jhaId }); return t; }
  // Requisitions
  var REQ_STATUSES = ["Requested", "Approved", "Rejected", "Ordered", "Received"];
  function createReq(s, f) { if (!f.item || !(+f.qty > 0) || !f.vendor) throw new Error("A requisition needs an item, a quantity and a vendor."); var r = { id: "RQ-" + s.nextReq++, job: f.job || "", item: f.item, qty: +f.qty, vendor: f.vendor, by: f.by, status: "Requested", po: "", ticket: f.ticket || null, note: "" }; s.reqs.unshift(r); return r; }
  function approveReq(s, id, who) { var r = rec(s.reqs, id); if (r.status !== "Requested") throw new Error(id + " is already " + r.status + "."); r.status = "Approved"; r.po = String(s.nextPo++); r.note = "Approved by " + who; return r; }
  function rejectReq(s, id, who, why) { var r = rec(s.reqs, id); if (r.status !== "Requested") throw new Error(id + " is already " + r.status + "."); if (!why) throw new Error("Say why it's rejected."); r.status = "Rejected"; r.note = who + ": " + why; return r; }
  function orderReq(s, id) { var r = rec(s.reqs, id); if (r.status !== "Approved") throw new Error("Approve it first."); r.status = "Ordered"; return r; }
  function receiveReq(s, id, who) { var r = rec(s.reqs, id); if (r.status !== "Ordered" && r.status !== "Approved") throw new Error(id + " isn't on order."); r.status = "Received"; if (r.ticket) addNote(s, r.ticket, who, "Parts in: " + r.item + " (PO " + r.po + ")"); return r; }
  // Rentals
  function rentalDays(r, now) { return Math.max(1, Math.ceil(((r.offAt || now) - r.onRent) / DAY)); }
  function rentalCost(r, now) { return rentalDays(r, now) * r.rate; }
  function rentalAlert(r, now) { if (r.offAt) return "off rent"; if (r.dueBack < now) return "overdue"; if (r.dueBack - now < DAY) return "call off-rent"; return ""; }
  function offRent(s, id) { var r = rec(s.rentals, id); r.offAt = s.now; return r; }
  function createRental(s, f) { if (!f.item || !f.vendor || !(+f.days > 0) || !(+f.rate > 0)) throw new Error("Rental needs item, vendor, days and a daily rate."); var r = { id: "RN-" + s.nextRental++, item: f.item, vendor: f.vendor, job: f.job || "", onRent: s.now, dueBack: s.now + f.days * DAY, rate: +f.rate, offAt: 0 }; s.rentals.unshift(r); return r; }
  // LOTO
  function createLoto(s, f) {
    if (!f.machine || !f.energy || !f.energy.length) throw new Error("LOTO needs the machine and at least one energy source.");
    var l = { id: "LOTO-" + s.nextLoto++, machine: f.machine, toolId: f.toolId || "", ticket: f.ticket || null, energy: f.energy, locks: [], verified: false, released: false }; s.lotos.unshift(l); return l;
  }
  function applyLock(s, id, who) { var l = rec(s.lotos, id); if (l.released) throw new Error(id + " is released."); if (l.locks.some(function (k) { return k.owner === who; })) throw new Error(who + " already has a lock on."); l.locks.push({ owner: who, at: s.now }); var tl = l.toolId && tool(s, l.toolId); if (tl) { if (tl.status === "out") checkin(s, tl.id); tl.status = "repair"; tl.ticket = l.ticket || tl.ticket; } return l; }
  function verifyLoto(s, id) { var l = rec(s.lotos, id); if (!l.locks.length) throw new Error("Put a lock on before verifying."); l.verified = true; return l; }
  function releaseLock(s, id, who) {
    var l = rec(s.lotos, id), k = l.locks.filter(function (x) { return x.owner === who; })[0];
    if (!k) throw new Error("Only the person who hung a lock can take it off. " + who + " has no lock here.");
    l.locks.splice(l.locks.indexOf(k), 1);
    if (!l.locks.length && l.verified) { l.released = true; var tl = l.toolId && tool(s, l.toolId), t = l.ticket && find(s, l.ticket); if (tl && (!t || t.status === "Done")) { tl.status = "in"; tl.ticket = null; } }
    return l;
  }
  function lotoState(l) { return l.released ? "released" : !l.locks.length ? "not applied" : l.verified ? "locked, verified" : "locked, verify zero energy"; }
  // Analytics: dept of a record from its person
  function dept(s, who) { return s.depts[who] || "Other"; }
  function analytics(s, d) {
    var inD = function (who) { return !d || dept(s, who) === d; }, now = s.now;
    var tk = s.tickets.filter(function (t) { return inD(t.requester) || inD(t.assignee); });
    var open = tk.filter(function (t) { return t.status !== "Done"; });
    var tools = s.tools.filter(function (t) { return t.status !== "out" ? !d : inD(t.holder); });
    var qa = s.qa.filter(function (q) { return !d || d === "Office" || d === "Fab" || d === "Welding" || d === "Paint"; });
    var reqs = s.reqs.filter(function (r) { return inD(r.by); });
    var rentals = s.rentals.filter(function () { return !d || d === "Fab" || d === "Welding" || d === "Office"; });
    var lotos = s.lotos.filter(function (l) { return !d || l.locks.some(function (k) { return inD(k.owner); }) || (l.ticket && tk.some(function (t) { return t.id === l.ticket; })); });
    var jhaNeed = open.filter(function (t) { return t.jhaRequired; }), jhaOk = jhaNeed.filter(function (t) { var j = t.jha && jha(s, t.jha); return j && j.crew.length; });
    var byStatus = {}; STATUSES.forEach(function (x) { byStatus[x] = tk.filter(function (t) { return t.status === x; }).length; });
    var qaBy = { "open": 0, "hold": 0, "fail": 0, "ready to sign": 0, "signed off": 0 }; qa.forEach(function (q) { qaBy[qaState(q)]++; });
    var reqBy = {}; REQ_STATUSES.forEach(function (x) { reqBy[x] = reqs.filter(function (r) { return r.status === x; }).length; });
    var rent = rentals.map(function (r) { return { id: r.id, item: r.item, cost: rentalCost(r, now), alert: rentalAlert(r, now), daysOver: r.offAt ? 0 : Math.max(0, Math.ceil((now - r.dueBack) / DAY)), rate: r.rate }; });
    var tips = [];
    rent.filter(function (r) { return r.alert === "overdue"; }).forEach(function (r) { tips.push("Call off " + r.item + " (" + r.id + "). It's " + r.daysOver + " day(s) past due back, about $" + (r.daysOver * r.rate) + " so far at the sample daily rate, and $" + r.rate + " more each day it sits."); });
    rent.filter(function (r) { return r.alert === "call off-rent"; }).forEach(function (r) { tips.push(r.item + " (" + r.id + ") is due back within a day. Call the off-rent in now so the next day isn't billed."); });
    var late = overdue(s).filter(function (t) { return inD(t.holder); });
    if (late.length) tips.push(late.length + " crib tool(s) are late coming back. Chasing them down beats buying or renting a second one.");
    var wop = tk.filter(function (t) { return t.status === "Waiting on parts"; }); if (wop.length) tips.push(wop.length + " ticket(s) waiting on parts. Check the linked requisitions so equipment isn't down longer than it has to be.");
    var pend = reqBy.Requested; if (pend > 1) tips.push(pend + " requisitions are waiting on approval. Approving them together means fewer orders and fewer delivery charges from the same vendor.");
    if (qaBy.hold + qaBy.fail) tips.push((qaBy.hold + qaBy.fail) + " inspection(s) on hold or failed. Catching rework before coating and shipping is cheaper than fixing it in the field.");
    var down = open.filter(function (t) { return t.priority.indexOf("Down") === 0; }); if (down.length) tips.push(down.length + " ticket(s) are stopping work. Those are worth clearing before anything Normal or Low.");
    return {
      kpis: { open: open.length, down: down.length, toolsOut: tools.filter(function (t) { return t.status === "out"; }).length, overdueTools: late.length, qaOpen: qaBy.open + qaBy.hold + qaBy.fail + qaBy["ready to sign"], ncrOpen: s.ncrs.filter(function (n) { return n.status === "Open"; }).length, jhaPct: jhaNeed.length ? Math.round(100 * jhaOk.length / jhaNeed.length) : 100, reqsPending: reqBy.Requested, rentalsAlert: rent.filter(function (r) { return r.alert === "overdue" || r.alert === "call off-rent"; }).length, rentalCost: rent.filter(function (r) { return r.alert !== "off rent"; }).reduce(function (a, r) { return a + r.cost; }, 0), lotoActive: lotos.filter(function (l) { return !l.released && l.locks.length; }).length },
      byStatus: byStatus, qaBy: qaBy, reqBy: reqBy, rentals: rent, jha: { need: jhaNeed.length, ok: jhaOk.length }, tips: tips
    };
  }
  function overdue(s) { return s.tools.filter(function (t) { return t.status === "out" && t.dueAt < s.now; }); }
  function byPerson(s) { var m = {}; s.tools.forEach(function (t) { if (t.status === "out") (m[t.holder] = m[t.holder] || []).push(t); }); return m; }
  var api = { setCheck: setCheck, qaState: qaState, signOff: signOff, createQa: createQa, raiseNcr: raiseNcr, createJha: createJha, addStep: addStep, signOn: signOn, linkJha: linkJha, jha: jha, rec: rec, createReq: createReq, approveReq: approveReq, rejectReq: rejectReq, orderReq: orderReq, receiveReq: receiveReq, REQ_STATUSES: REQ_STATUSES, rentalCost: rentalCost, rentalDays: rentalDays, rentalAlert: rentalAlert, offRent: offRent, createRental: createRental, createLoto: createLoto, applyLock: applyLock, verifyLoto: verifyLoto, releaseLock: releaseLock, lotoState: lotoState, activeLoto: activeLoto, analytics: analytics, dept: dept, DEPTS: ["Office", "Fab", "Welding", "Maintenance", "Shipping", "Paint"], seed: seed, STATUSES: STATUSES, PRIORITIES: PRIORITIES, createTicket: createTicket, setStatus: setStatus, assign: assign, addNote: addNote, checkout: checkout, checkin: checkin, overdue: overdue, byPerson: byPerson, find: find, tool: tool, DAY: DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMATickets = api;
})(typeof window !== "undefined" ? window : this);
