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
      tickets: [
        { id: 1046, title: "Portable band saw blade keeps walking off", equipment: "T-104 Band saw, portable", area: "Tool crib", priority: "High", status: "Waiting on parts", requester: "Tess (welding)", assignee: "Lou (maintenance)", job: "", createdAt: t(4),
          log: [{ at: t(4), who: "Tess (welding)", text: "Blade tracks off after a few cuts. Tagged out." }, { at: t(3), who: "Lou (maintenance)", text: "Guide bearings worn. Ordered a pair from Northfield Steel Supply, PO 6131." }] },
        { id: 1047, title: "Overhead door in bay 2 sticks halfway", equipment: "Bay 2 overhead door", area: "Fab bay 2", priority: "Normal", status: "Assigned", requester: "Ray (shipping)", assignee: "Lou (maintenance)", job: "", createdAt: t(2),
          log: [{ at: t(2), who: "Ray (shipping)", text: "Have to push it the rest of the way. Slows down loading." }] },
        { id: 1048, title: "Welder 3 ground clamp cracked", equipment: "Welder 3", area: "Weld bay", priority: "Down (stops work)", status: "New", requester: "Tess (welding)", assignee: "", job: "J2047 CedarRun", createdAt: t(0.2),
          log: [{ at: t(0.2), who: "Tess (welding)", text: "Clamp split, can't get a good ground. Using welder 2 for now." }] },
        { id: 1043, title: "Paint booth filter change", equipment: "Paint booth", area: "Paint", priority: "Low", status: "Done", requester: "Kim (paint)", assignee: "Lou (maintenance)", job: "", createdAt: t(8),
          log: [{ at: t(8), who: "Kim (paint)", text: "Filters loaded up." }, { at: t(7), who: "Lou (maintenance)", text: "Swapped intake and exhaust filters. Closed." }] }
      ]
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
    t.status = status; t.log.push({ at: s.now, who: who, text: "Status: " + status + (note ? ". " + note : "") });
    if (status === "Done") s.tools.forEach(function (tl) { if (tl.ticket === t.id && tl.status === "repair") { tl.status = "in"; tl.ticket = null; } });
    return t;
  }
  function assign(s, id, person, who) { var t = find(s, id); t.assignee = person; if (t.status === "New") t.status = "Assigned"; t.log.push({ at: s.now, who: who, text: "Assigned to " + person }); return t; }
  function addNote(s, id, who, text) { var t = find(s, id); if (!text) throw new Error("Note is empty."); t.log.push({ at: s.now, who: who, text: text }); return t; }
  function checkout(s, id, person, days, job) {
    var tl = tool(s, id);
    if (tl.status === "repair") throw new Error(tl.name + " is tagged out for repair.");
    if (tl.status === "out") throw new Error(tl.name + " is already out with " + tl.holder + ".");
    tl.status = "out"; tl.holder = person; tl.outAt = s.now; tl.dueAt = s.now + (days || 1) * DAY; tl.job = job || ""; return tl;
  }
  function checkin(s, id) { var tl = tool(s, id); tl.status = "in"; tl.holder = ""; tl.outAt = 0; tl.dueAt = 0; tl.job = ""; return tl; }
  function overdue(s) { return s.tools.filter(function (t) { return t.status === "out" && t.dueAt < s.now; }); }
  function byPerson(s) { var m = {}; s.tools.forEach(function (t) { if (t.status === "out") (m[t.holder] = m[t.holder] || []).push(t); }); return m; }
  var api = { seed: seed, STATUSES: STATUSES, PRIORITIES: PRIORITIES, createTicket: createTicket, setStatus: setStatus, assign: assign, addNote: addNote, checkout: checkout, checkin: checkin, overdue: overdue, byPerson: byPerson, find: find, tool: tool, DAY: DAY };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMATickets = api;
})(typeof window !== "undefined" ? window : this);
