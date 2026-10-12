(function () {
  var T = window.GMATickets, $ = function (id) { return document.getElementById(id); }, s, cur = null, tab = "board";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function me() { return $("who").value; }
  function say(t) { $("status").textContent = t || ""; }
  function when(ms) { var d = new Date(ms); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  function day(ms) { return new Date(ms).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
  function prioCls(p) { return p.indexOf("Down") === 0 ? "down" : p.toLowerCase(); }
  function opt(sel, list, val) { sel.innerHTML = ""; list.forEach(function (v) { var o = el("option", null, v); o.value = v; if (v === val) o.selected = true; sel.appendChild(o); }); }
  function act(fn) { try { fn(); render(); } catch (e) { say(e.message); } }
  // inline validation: map is { fieldName: inputElement }. Bad fields get a red outline and the message shows under the form.
  function clearErr(box) { box.querySelectorAll(".bad").forEach(function (x) { x.classList.remove("bad"); x.removeAttribute("aria-invalid"); }); var o = box.querySelector(".err"); if (o) o.remove(); }
  function guard(box, map, fn) {
    clearErr(box);
    try { fn(); render(); }
    catch (e) {
      (e.fields || []).forEach(function (k) { var x = map[k]; if (x) { x.classList.add("bad"); x.setAttribute("aria-invalid", "true"); } });
      var p = el("p", "err", e.message); p.setAttribute("role", "alert"); box.appendChild(p);
      var first = (e.fields || []).map(function (k) { return map[k]; }).filter(Boolean)[0]; if (first) first.focus();
    }
  }

  function start() {
    s = T.seed(); cur = null; if (cf.id) cancelEdit(); opt($("who"), s.people, "Dana (office)"); opt($("nprio"), T.PRIORITIES, "Normal");
    say("Fresh sample shop loaded. Change who you are to see it from the floor or the office."); show("board");
  }
  function show(t) {
    tab = t; ["board", "crib", "new", "detail", "qa", "jha", "req", "rent", "loto", "analytics"].forEach(function (k) { $("tab-" + k).hidden = k !== t; });
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === (t === "detail" ? "board" : t)); });
    render();
  }
  function render() {
    s.now = Date.now();
    var open = s.tickets.filter(function (t) { return t.status !== "Done"; }), late = T.overdue(s);
    var A = T.analytics(s).kpis, sum = $("sum"); sum.innerHTML = "";
    [["Open tickets", open.length], ["Stopping work", open.filter(function (t) { return t.priority.indexOf("Down") === 0; }).length], ["Tools out", s.tools.filter(function (t) { return t.status === "out"; }).length], ["Overdue", late.length], ["Tagged out", s.tools.filter(function (t) { return t.status === "repair"; }).length], ["QA open or held", A.qaOpen], ["Open NCRs", A.ncrOpen], ["Reqs to approve", A.reqsPending], ["Rental alerts", A.rentalsAlert], ["Active LOTO", A.lotoActive]].forEach(function (p) {
      var d = el("div"); d.appendChild(el("b", null, p[1])); d.appendChild(el("span", null, p[0])); sum.appendChild(d);
    });
    if (tab === "board") board(); else if (tab === "crib") crib(); else if (tab === "detail") detail(); else if (tab === "new") newForm(); else ({ qa: qaTab, jha: jhaTab, req: reqTab, rent: rentTab, loto: lotoTab, analytics: anTab })[tab]();
  }
  function board() {
    var f = $("filter").value, b = $("board"); b.innerHTML = "";
    T.STATUSES.forEach(function (st) {
      if (f === "open" && st === "Done") return;
      var col = el("div", "col"); col.appendChild(el("h3", null, st));
      s.tickets.filter(function (t) { return t.status === st && (f !== "mine" || t.assignee === me()); }).forEach(function (t) {
        var c = el("button", "card p-" + t.priority.split(" ")[0]); c.type = "button";
        c.appendChild(el("b", null, "#" + t.id + " " + t.title));
        c.appendChild(el("small", null, t.priority + " · " + (t.assignee || "Unassigned")));
        c.appendChild(el("small", null, t.equipment + (t.job ? " · " + t.job : "")));
        c.addEventListener("click", function () { cur = t.id; show("detail"); });
        col.appendChild(c);
      });
      b.appendChild(col);
    });
  }
  function detail() {
    var t = T.find(s, cur), d = $("detail"); d.innerHTML = "";
    d.appendChild(el("h2", null, "#" + t.id + " " + t.title));
    var m = el("div", "meta");
    [["Status", t.status], ["Priority", t.priority], ["Equipment", t.equipment || "Not given"], ["Where", t.area || "Not given"], ["From", t.requester], ["Assigned", t.assignee || "Nobody yet"], ["Job", t.job || "None"], ["Opened", when(t.createdAt)]].forEach(function (p) { var x = el("div", null, p[0] + ": "); x.appendChild(el("b", null, p[1])); m.appendChild(x); });
    d.appendChild(m);
    var lk = el("p", "links");
    if (t.ncr) { lk.appendChild(document.createTextNode("From " + t.ncr + ". ")); }
    if (t.jhaRequired) {
      var j = t.jha && T.jha(s, t.jha);
      lk.appendChild(document.createTextNode("JHA required before work starts: " + (j ? j.id + " (" + (j.crew.length ? j.crew.length + " signed on" : "nobody signed on yet") + "). " : "none linked. ")));
      var js = el("select", "mini"); js.setAttribute("aria-label", "Link a JHA"); opt(js, ["Link a JHA..."].concat(s.jhas.map(function (x) { return x.id + " " + x.task; })), "");
      js.addEventListener("change", function () { if (js.selectedIndex) act(function () { T.linkJha(s, t.id, js.value.split(" ")[0], me()); say("Linked " + js.value.split(" ")[0] + "."); }); });
      lk.appendChild(js);
    }
    s.lotos.filter(function (l) { return l.ticket === t.id; }).forEach(function (l) { lk.appendChild(el("span", "pill " + (l.released ? "released" : "locked"), l.id + " " + T.lotoState(l))); lk.appendChild(document.createTextNode(" ")); });
    s.reqs.filter(function (r) { return r.ticket === t.id; }).forEach(function (r) { lk.appendChild(document.createTextNode(" " + r.id + " " + r.item + ", " + r.status + (r.po ? ", PO " + r.po : "") + ".")); });
    var tg = el("div", "row"); tg.appendChild(el("span", "hint", (t.tags && t.tags.length) ? "Tagged out on this ticket:" : "No tools tagged out on this ticket."));
    (t.tags || []).forEach(function (id) { var x = T.tool(s, id); tg.appendChild(el("span", "pill repair", id + " " + x.name)); if (t.status !== "Done") tg.appendChild(btn("Remove tag", function () { T.untagTool(s, t.id, id); say(id + " untagged. It's back in the crib unless a lockout is still on it."); }, true)); });
    if (t.status !== "Done") { var ts = sel("Tag out a tool", ["Tag out a tool..."].concat(s.tools.map(function (x) { return x.id + " " + x.name; }))); tg.appendChild(ts); tg.appendChild(btn("Tag out", function () { T.tagTool(s, t.id, ts.selectedIndex ? ts.value.split(" ")[0] : ""); say(ts.value.split(" ")[0] + " tagged out on #" + t.id + "."); }, true, tg, { toolId: ts })); }
    d.appendChild(tg);
    if (lk.childNodes.length) d.appendChild(lk);
    var row = el("div", "row"), as = el("select", "detail-in"); as.setAttribute("aria-label", "Assign to");
    opt(as, ["Assign to..."].concat(s.people), "");
    as.addEventListener("change", function () { if (as.selectedIndex) act(function () { T.assign(s, t.id, as.value, me()); say("Assigned to " + as.value + "."); }); });
    var st = el("select", "detail-in"); st.setAttribute("aria-label", "Move to status"); opt(st, T.STATUSES, t.status);
    var mv = el("button", "btn", "Update status"); mv.type = "button";
    row.appendChild(as); row.appendChild(st); row.appendChild(mv); d.appendChild(row);
    var note = el("textarea", "detail-in"); note.rows = 2; note.placeholder = "Add a note. Required when you mark it Done."; note.setAttribute("aria-label", "Note"); d.appendChild(note);
    mv.addEventListener("click", function () { act(function () { T.setStatus(s, t.id, st.value, me(), note.value.trim()); say("#" + t.id + " is now " + st.value + "."); }); });
    var r2 = el("div", "row"), nb = el("button", "btn btn-ghost", "Add note"); nb.type = "button";
    nb.addEventListener("click", function () { act(function () { T.addNote(s, t.id, me(), note.value.trim()); say("Note added."); }); });
    var ph = el("label", "btn btn-ghost", "Attach a photo"), pi = el("input"); pi.type = "file"; pi.accept = "image/*"; pi.className = "sr-only"; ph.appendChild(pi);
    pi.addEventListener("change", function () { var f = pi.files[0]; if (!f) return; (t.photos = t.photos || []).push(URL.createObjectURL(f)); T.addNote(s, t.id, me(), "Photo attached: " + f.name); say("Photo shown here only. It isn't uploaded."); render(); });
    r2.appendChild(nb); r2.appendChild(ph); d.appendChild(r2);
    if (t.photos && t.photos.length) { var th = el("div", "thumbs"); t.photos.forEach(function (u) { var i = el("img"); i.src = u; i.alt = "Attached photo"; th.appendChild(i); }); d.appendChild(th); }
    d.appendChild(el("h3", "hint", "History"));
    var ul = el("ul", "log"); t.log.slice().reverse().forEach(function (l) { var li = el("li", null, l.text); li.appendChild(el("small", null, l.who + " · " + when(l.at))); ul.appendChild(li); }); d.appendChild(ul);
  }
  var editing = null, cf = {};
  function cribForm() {
    once("crib-form", function (box) {
      cf.id = inp("Tool ID, like T-109", "9rem"); cf.name = inp("Name", "16rem"); cf.type = sel("Type", ["Type..."].concat(T.TOOL_TYPES)); cf.area = inp("Home location", "10rem");
      [cf.id, cf.name, cf.type, cf.area].forEach(function (x) { box.appendChild(x); });
      cf.save = btn("Add tool", function () {
        var f = { id: cf.id.value, name: cf.name.value, type: cf.type.selectedIndex ? cf.type.value : "", area: cf.area.value };
        if (editing) { T.editTool(s, editing, f); say(editing + " saved."); } else { var t = T.addTool(s, f); say(t.id + " added to the crib."); }
        cancelEdit();
      }, false, box, cf);
      cf.cancel = btn("Cancel", function () { cancelEdit(); }, true); cf.cancel.hidden = true;
      box.appendChild(cf.save); box.appendChild(cf.cancel);
    });
  }
  function cancelEdit() { editing = null; cf.id.disabled = false; ["id", "name", "area"].forEach(function (k) { cf[k].value = ""; }); cf.type.selectedIndex = 0; cf.save.textContent = "Add tool"; cf.cancel.hidden = true; clearErr($("crib-form")); }
  function startEdit(tl) { editing = tl.id; cf.id.value = tl.id; cf.id.disabled = true; cf.name.value = tl.name; cf.type.value = tl.type || "Other"; cf.area.value = tl.area; cf.save.textContent = "Save changes"; cf.cancel.hidden = false; clearErr($("crib-form")); cf.name.focus(); }
  function crib() {
    cribForm();
    var tb = $("ttbl").querySelector("tbody"); tb.innerHTML = "";
    s.tools.forEach(function (tl) {
      var tr = el("tr"), late = tl.status === "out" && tl.dueAt < s.now;
      tr.appendChild(el("td", null, tl.id)); tr.appendChild(el("td", null, tl.name)); tr.appendChild(el("td", null, tl.type || ""));
      var sc = el("td"); sc.appendChild(el("span", "pill " + (late ? "late" : tl.status), late ? "overdue" : tl.status === "repair" && tl.loto ? "locked out" : { in: "in crib", out: "checked out", repair: "tagged out" }[tl.status])); tr.appendChild(sc);
      tr.appendChild(el("td", null, tl.holder || (tl.status === "repair" ? [tl.ticket ? "Ticket #" + tl.ticket : "", tl.loto ? tl.loto : ""].filter(Boolean).join(", ") : tl.area)));
      tr.appendChild(el("td", null, tl.job || ""));
      tr.appendChild(el("td", null, tl.status === "out" ? day(tl.dueAt) : ""));
      var a = el("td"), b;
      if (tl.status === "out") { b = el("button", "btn btn-ghost", "Check in"); b.addEventListener("click", function () { act(function () { T.checkin(s, tl.id); say(tl.name + " is back in the crib."); }); }); }
      else if (tl.status === "in") { b = el("button", "btn", "Check out to me"); b.addEventListener("click", function () { act(function () { T.checkout(s, tl.id, me(), 2, ""); say(tl.name + " checked out to " + me() + ", due back in 2 days."); }); }); }
      else if (tl.ticket) { b = el("button", "btn btn-ghost", "Open ticket"); b.addEventListener("click", function () { cur = tl.ticket; show("detail"); }); }
      else { b = el("button", "btn btn-ghost", "Open LOTO"); b.addEventListener("click", function () { show("loto"); }); }
      b.type = "button"; a.appendChild(b);
      var ed = el("button", "btn btn-ghost", "Edit"); ed.type = "button"; ed.addEventListener("click", function () { startEdit(tl); }); a.appendChild(document.createTextNode(" ")); a.appendChild(ed); tr.appendChild(a); if (late) tr.className = "flag"; tb.appendChild(tr);
    });
  }
  function newForm() { opt($("nequip"), ["Other / not a crib tool"].concat(s.tools.map(function (t) { return t.id + " " + t.name; })), ""); }

  // ---- shared small builders
  function inp(ph, w) { var x = el("input", "mini"); x.placeholder = ph; x.setAttribute("aria-label", ph); if (w) x.style.width = w; return x; }
  function sel(label, list) { var x = el("select", "mini"); x.setAttribute("aria-label", label); opt(x, list, ""); return x; }
  function btn(text, fn, ghost, box, map) { var b = el("button", "btn sm" + (ghost ? " btn-ghost" : ""), text); b.type = "button"; b.addEventListener("click", function () { if (box) guard(box, map || {}, fn); else act(fn); }); return b; }
  var JOBS = ["J2041 PineHollow", "J2047 CedarRun", "J2052 MillPond"], VENDORS = ["Northfield Steel Supply", "Kettle Brook Coatings", "Blue Ledge Building Supply"];
  function money(n) { return "$" + n.toLocaleString(); }
  function goTicket(id) { cur = id; show("detail"); }
  function tlink(id) { var a = el("a", null, "ticket #" + id); a.tabIndex = 0; a.addEventListener("click", function () { goTicket(id); }); return a; }
  function once(id, build) { var box = $(id); if (!box.dataset.built) { box.dataset.built = "1"; build(box); } }

  function qaTab() {
    once("qa-new", function (box) {
      var j = sel("Job", ["Job..."].concat(JOBS)), part = inp("Part, like Beam B7");
      box.appendChild(j); box.appendChild(part);
      box.appendChild(btn("New inspection", function () { var q = T.createQa(s, { job: j.selectedIndex ? j.value : "", part: part.value.trim() }); part.value = ""; say(q.id + " started."); }, false, box, { job: j, part: part }));
    });
    var list = $("qa-list"); list.innerHTML = "";
    s.qa.forEach(function (q) {
      var st = T.qaState(q), r = el("div", "rec"), h = el("h3", null, q.id + " " + q.part + " · " + q.job + " ");
      h.appendChild(el("span", "pill " + st.split(" ")[0], st)); r.appendChild(h);
      var tb = el("table"); q.checks.forEach(function (c, i) {
        var tr = el("tr"); tr.appendChild(el("td", null, c.item));
        var td = el("td"); if (q.signedBy) td.appendChild(el("span", "pill " + c.result, c.result)); else {
          var x = sel(c.item + " result", ["Not checked", "pass", "fail", "hold"]); x.value = c.result || "Not checked";
          x.addEventListener("change", function () { act(function () { T.setCheck(s, q.id, i, x.value === "Not checked" ? "" : x.value); }); }); td.appendChild(x);
        }
        tr.appendChild(td); var nt = el("td"); if (q.signedBy) nt.textContent = c.note; else { var n = inp("Note", "100%"); n.value = c.note; n.addEventListener("change", function () { c.note = n.value; }); nt.appendChild(n); }
        tr.appendChild(nt); tb.appendChild(tr);
      }); r.appendChild(tb);
      var row = el("div", "row");
      if (q.signedBy) row.appendChild(el("span", "hint", "Signed off by " + q.signedBy + " " + when(q.signedAt) + "."));
      else row.appendChild(btn("Sign off", function () { T.signOff(s, q.id, me()); say(q.id + " signed off by " + me() + "."); }));
      if (q.ncr) { var n = s.ncrs.filter(function (x) { return x.id === q.ncr; })[0], p = el("span", "links", q.ncr + " opened, rework on "); p.appendChild(tlink(n.ticket)); row.appendChild(p); }
      else if (st === "fail" || st === "hold") row.appendChild(btn("Write up NCR", function () { var n = T.raiseNcr(s, q.id, me()); say(n.id + " written up. Rework ticket #" + n.ticket + " is on the board."); }, true));
      r.appendChild(row); list.appendChild(r);
    });
  }
  function jhaTab() {
    once("jha-new", function (box) {
      var task = inp("Task, like Grind out cracked weld", "18rem"), j = sel("Job", ["No job"].concat(JOBS)), pp = sel("Main PPE", ["Main PPE...", "Safety glasses", "Hard hat", "Leather gloves", "Face shield", "Harness"]);
      box.appendChild(task); box.appendChild(j); box.appendChild(pp);
      box.appendChild(btn("New JHA", function () { var x = T.createJha(s, { task: task.value.trim(), job: j.selectedIndex ? j.value : "", ppe: pp.selectedIndex ? [pp.value] : [] }); task.value = ""; pp.selectedIndex = 0; say(x.id + " started. Add the steps next."); }, false, box, { task: task, ppe: pp }));
    });
    var list = $("jha-list"); list.innerHTML = "";
    s.jhas.forEach(function (j) {
      var r = el("div", "rec"); r.appendChild(el("h3", null, j.id + " " + j.task + (j.job ? " · " + j.job : "")));
      var tb = el("table"); var hd = el("tr"); ["Step", "Hazards", "Controls"].forEach(function (x) { hd.appendChild(el("th", null, x)); }); tb.appendChild(hd);
      j.steps.forEach(function (st) { var tr = el("tr"); [st.step, st.hazards, st.controls].forEach(function (x) { tr.appendChild(el("td", null, x)); }); tb.appendChild(tr); });
      r.appendChild(tb);
      var add = el("div", "row"), a = inp("Step"), b = inp("Hazards"), c = inp("Controls");
      add.appendChild(a); add.appendChild(b); add.appendChild(c);
      add.appendChild(btn("Add step", function () { T.addStep(s, j.id, { step: a.value.trim(), hazards: b.value.trim(), controls: c.value.trim() }); say("Step added. Crew sign-ons were cleared since the JHA changed."); }, true, add, { step: a, hazards: b, controls: c }));
      r.appendChild(add);
      var pp = el("div", "row"); pp.appendChild(el("span", "hint", "PPE:"));
      ["Safety glasses", "Hard hat", "Leather gloves", "Cut-resistant gloves", "Hearing protection", "Face shield", "Harness"].forEach(function (x) {
        var l = el("label", "hint"), cb = el("input"); cb.type = "checkbox"; cb.checked = j.ppe.indexOf(x) >= 0;
        cb.addEventListener("change", function () { if (cb.checked) j.ppe.push(x); else j.ppe.splice(j.ppe.indexOf(x), 1); }); l.appendChild(cb); l.appendChild(document.createTextNode(" " + x)); pp.appendChild(l);
      }); r.appendChild(pp);
      var cr = el("div", "row"); cr.appendChild(el("span", "hint", j.crew.length ? "Signed on: " + j.crew.map(function (c) { return c.who + " " + when(c.at); }).join(", ") : "Nobody signed on yet."));
      cr.appendChild(btn("Sign on as " + me(), function () { T.signOn(s, j.id, me()); say(me() + " signed on to " + j.id + "."); }));
      var used = s.tickets.filter(function (t) { return t.jha === j.id; }); if (used.length) { var p = el("span", "links", "Required by "); used.forEach(function (t) { p.appendChild(tlink(t.id)); p.appendChild(document.createTextNode(" ")); }); cr.appendChild(p); }
      r.appendChild(cr); list.appendChild(r);
    });
  }
  function reqTab() {
    once("req-new", function (box) {
      var item = inp("Item", "14rem"), q = inp("Qty", "4rem"), j = sel("Job", ["No job"].concat(JOBS)), v = sel("Vendor", ["Vendor..."].concat(VENDORS));
      [item, q, j, v].forEach(function (x) { box.appendChild(x); });
      box.appendChild(btn("Request it", function () { var r = T.createReq(s, { item: item.value.trim(), qty: q.value, job: j.selectedIndex ? j.value : "", vendor: v.selectedIndex ? v.value : "", by: me() }); item.value = ""; q.value = ""; say(r.id + " sent for approval."); }, false, box, { item: item, qty: q, vendor: v }));
    });
    var tb = $("rqtbl").querySelector("tbody"); tb.innerHTML = "";
    s.reqs.forEach(function (r) {
      var tr = el("tr");
      [r.id, r.item, r.qty, r.job, r.vendor, r.by, r.po].forEach(function (x, i) { tr.appendChild(el("td", i === 2 ? "n" : null, x)); });
      var st = el("td"); st.appendChild(el("span", "pill " + r.status.toLowerCase(), r.status)); if (r.note) st.appendChild(el("div", "hint", r.note)); tr.appendChild(st);
      var a = el("td");
      if (r.status === "Requested") { var why = inp("Reason if rejecting", "10rem"); a.appendChild(btn("Approve", function () { T.approveReq(s, r.id, me()); say(r.id + " approved, PO " + r.po + "."); })); a.appendChild(why); a.appendChild(btn("Reject", function () { T.rejectReq(s, r.id, me(), why.value.trim()); say(r.id + " rejected."); }, true, a, { why: why })); }
      else if (r.status === "Approved") a.appendChild(btn("Mark ordered", function () { T.orderReq(s, r.id); say(r.id + " ordered from " + r.vendor + "."); }));
      else if (r.status === "Ordered") a.appendChild(btn("Mark received", function () { T.receiveReq(s, r.id, me()); say(r.id + " received." + (r.ticket ? " Note added to ticket #" + r.ticket + "." : "")); }));
      if (r.ticket) { a.appendChild(document.createTextNode(" ")); a.appendChild(tlink(r.ticket)); }
      tr.appendChild(a); tb.appendChild(tr);
    });
  }
  function rentTab() {
    once("rent-new", function (box) {
      var item = inp("What's rented", "12rem"), v = sel("Vendor", ["Vendor..."].concat(VENDORS)), j = sel("Job", ["No job"].concat(JOBS)), d = inp("Days", "4rem"), rt = inp("Sample $/day", "7rem");
      [item, v, j, d, rt].forEach(function (x) { box.appendChild(x); });
      box.appendChild(btn("Put on rent", function () { var r = T.createRental(s, { item: item.value.trim(), vendor: v.selectedIndex ? v.value : "", job: j.selectedIndex ? j.value : "", days: d.value.trim(), rate: rt.value.trim() }); item.value = ""; d.value = ""; rt.value = ""; say(r.id + " on rent."); }, false, box, { item: item, vendor: v, days: d, rate: rt }));
    });
    var tb = $("rntbl").querySelector("tbody"); tb.innerHTML = "";
    s.rentals.forEach(function (r) {
      var tr = el("tr"), al = T.rentalAlert(r, s.now);
      [r.id, r.item, r.vendor, r.job, day(r.onRent), day(r.dueBack)].forEach(function (x) { tr.appendChild(el("td", null, x)); });
      tr.appendChild(el("td", "n", T.rentalDays(r, s.now))); tr.appendChild(el("td", "n", money(r.rate))); tr.appendChild(el("td", "n", money(T.rentalCost(r, s.now))));
      var a = el("td"); if (al) a.appendChild(el("span", "pill " + al.split(" ")[0].replace("off", "released"), al)); tr.appendChild(a);
      var b = el("td"); if (!r.offAt) b.appendChild(btn("Called off-rent", function () { T.offRent(s, r.id); say(r.item + " is off rent. The total stops here."); }, true)); tr.appendChild(b);
      if (al === "overdue") tr.className = "flag"; tb.appendChild(tr);
    });
  }
  function lotoTab() {
    once("loto-new", function (box) {
      var m = sel("Machine", ["Machine..."].concat(s.tools.map(function (t) { return t.id + " " + t.name; }), ["Welder 3", "Bay 2 overhead door", "Paint booth"])), e = inp("Energy sources, comma separated", "18rem"), tk = sel("Ticket", ["No ticket"].concat(s.tickets.map(function (t) { return "#" + t.id + " " + t.title; })));
      [m, e, tk].forEach(function (x) { box.appendChild(x); });
      box.appendChild(btn("New LOTO record", function () { var mv = m.selectedIndex ? m.value : ""; var l = T.createLoto(s, { machine: mv, toolId: /^T-\d+/.test(mv) ? mv.split(" ")[0] : "", ticket: tk.selectedIndex ? +tk.value.slice(1).split(" ")[0] : null, energy: e.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean) }); e.value = ""; say(l.id + " created. Apply locks next."); }, false, box, { machine: m, energy: e }));
    });
    var list = $("loto-list"); list.innerHTML = "";
    s.lotos.forEach(function (l) {
      var r = el("div", "rec"), st = T.lotoState(l), h = el("h3", null, l.id + " " + l.machine + " ");
      h.appendChild(el("span", "pill " + (l.released ? "released" : "locked"), st)); r.appendChild(h);
      r.appendChild(el("p", "hint", "Energy sources: " + l.energy.join(", ")));
      r.appendChild(el("p", "hint", "Locks on: " + (l.locks.length ? l.locks.map(function (k) { return k.owner + " " + when(k.at); }).join(", ") : "none")));
      var row = el("div", "row");
      if (!l.released) {
        row.appendChild(btn("1. Apply my lock", function () { T.applyLock(s, l.id, me()); say(me() + " locked out " + l.machine + "."); }));
        row.appendChild(btn("2. Verify zero energy", function () { T.verifyLoto(s, l.id); say(l.id + " verified."); }, true));
        row.appendChild(btn("3. Release my lock", function () { T.releaseLock(s, l.id, me()); say(l.released ? l.id + " fully released." : me() + "'s lock is off."); }, true));
      }
      if (l.ticket) { var p = el("span", "links", "Blocks closing "); p.appendChild(tlink(l.ticket)); row.appendChild(p); }
      if (l.toolId) row.appendChild(el("span", "links", " Blocks checkout of " + l.toolId));
      r.appendChild(row); list.appendChild(r);
    });
  }
  function chart(title, obj) {
    var c = el("div", "chart"), max = Math.max.apply(null, Object.keys(obj).map(function (k) { return obj[k]; }).concat([1])); c.appendChild(el("h4", null, title));
    Object.keys(obj).forEach(function (k) { var b = el("div", "bar"), i = el("i"); i.style.width = (100 * obj[k] / max) + "%"; b.appendChild(el("span", null, k)); var w = el("div"); w.appendChild(i); b.appendChild(w); b.appendChild(el("b", null, typeof obj[k] === "number" && title.indexOf("$") >= 0 ? money(obj[k]) : obj[k])); c.appendChild(b); });
    return c;
  }
  function anTab() {
    once("dept", function (x) { opt(x, ["All departments"].concat(T.DEPTS), ""); x.addEventListener("change", render); });
    var d = $("dept").selectedIndex ? $("dept").value : "", A = T.analytics(s, d), k = A.kpis, box = $("kpis"); box.innerHTML = "";
    [["Open tickets", k.open], ["Stopping work", k.down], ["Tools out", k.toolsOut], ["Tools overdue", k.overdueTools], ["QA open or held", k.qaOpen], ["Open NCRs", k.ncrOpen], ["JHA compliance", k.jhaPct + "%"], ["Reqs to approve", k.reqsPending], ["Rental alerts", k.rentalsAlert], ["On-rent total (sample)", money(k.rentalCost)], ["Active LOTO", k.lotoActive]].forEach(function (p) { var x = el("div"); x.appendChild(el("b", null, p[1])); x.appendChild(el("span", null, p[0])); box.appendChild(x); });
    var ch = $("charts"); ch.innerHTML = "";
    var crib = { "In crib": 0, "Checked out": 0, "Of those, overdue": k.overdueTools, "Tagged out": 0 }; s.tools.forEach(function (t) { if (t.status === "in") crib["In crib"]++; else if (t.status === "repair") crib["Tagged out"]++; else crib["Checked out"]++; });
    var rc = {}; A.rentals.forEach(function (r) { rc[r.item] = r.cost; });
    var lo = { "Not applied": 0, "Locked": 0, "Released": 0 }; s.lotos.forEach(function (l) { lo[l.released ? "Released" : l.locks.length ? "Locked" : "Not applied"]++; });
    [["Tickets by status", A.byStatus], ["Tool crib", crib], ["QA/QC inspections", A.qaBy], ["JHA before work", { "Required": A.jha.need, "Signed and ready": A.jha.ok, "Missing": A.jha.need - A.jha.ok }], ["Requisitions", A.reqBy], ["Rental running total ($, sample)", rc], ["Lockout/tagout", lo]].forEach(function (c) { ch.appendChild(chart(c[0], c[1])); });
    var tips = $("tips"); tips.innerHTML = ""; (A.tips.length ? A.tips : ["Nothing stands out right now."]).forEach(function (t) { tips.appendChild(el("li", null, t)); });
  }

  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
  $("filter").addEventListener("change", render);
  $("who").addEventListener("change", function () { say("You're now " + me() + "."); render(); });
  $("back").addEventListener("click", function () { show("board"); });
  $("reset").addEventListener("click", start);
  $("nform").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, eq = f.equipment.value, isTool = /^T-\d+/.test(eq);
    guard(f, { title: f.title, area: f.area, priority: f.priority, equipment: f.equipment }, function () {
      var t = T.createTicket(s, { title: f.title.value.trim(), equipment: isTool ? eq : "", area: f.area.value.trim(), priority: f.priority.value, job: f.job.value, notes: f.notes.value.trim(), requester: me(), toolId: isTool ? eq.split(" ")[0] : "", tagOut: f.tagOut.checked });
      f.reset(); cur = t.id; tab = "detail"; show("detail"); say("Ticket #" + t.id + " is in. It shows up as New until somebody takes it.");
    });
  });
  start();
})();
