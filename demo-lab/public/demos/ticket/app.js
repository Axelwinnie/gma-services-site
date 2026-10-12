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

  function start() {
    s = T.seed(); cur = null; opt($("who"), s.people, "Dana (office)"); opt($("nprio"), T.PRIORITIES, "Normal");
    say("Fresh sample shop loaded. Change who you are to see it from the floor or the office."); show("board");
  }
  function show(t) {
    tab = t; ["board", "crib", "new", "detail"].forEach(function (k) { $("tab-" + k).hidden = k !== t; });
    document.querySelectorAll(".tab").forEach(function (b) { b.setAttribute("aria-selected", b.dataset.tab === (t === "detail" ? "board" : t)); });
    render();
  }
  function render() {
    s.now = Date.now();
    var open = s.tickets.filter(function (t) { return t.status !== "Done"; }), late = T.overdue(s);
    var sum = $("sum"); sum.innerHTML = "";
    [["Open tickets", open.length], ["Stopping work", open.filter(function (t) { return t.priority.indexOf("Down") === 0; }).length], ["Tools out", s.tools.filter(function (t) { return t.status === "out"; }).length], ["Overdue", late.length], ["Tagged out", s.tools.filter(function (t) { return t.status === "repair"; }).length]].forEach(function (p) {
      var d = el("div"); d.appendChild(el("b", null, p[1])); d.appendChild(el("span", null, p[0])); sum.appendChild(d);
    });
    if (tab === "board") board(); else if (tab === "crib") crib(); else if (tab === "detail") detail(); else newForm();
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
  function crib() {
    var tb = $("ttbl").querySelector("tbody"); tb.innerHTML = "";
    s.tools.forEach(function (tl) {
      var tr = el("tr"), late = tl.status === "out" && tl.dueAt < s.now;
      tr.appendChild(el("td", null, tl.id)); tr.appendChild(el("td", null, tl.name));
      var sc = el("td"); sc.appendChild(el("span", "pill " + (late ? "late" : tl.status), late ? "overdue" : { in: "in crib", out: "checked out", repair: "tagged out" }[tl.status])); tr.appendChild(sc);
      tr.appendChild(el("td", null, tl.holder || (tl.status === "repair" ? "Repair, ticket #" + tl.ticket : tl.area)));
      tr.appendChild(el("td", null, tl.job || ""));
      tr.appendChild(el("td", null, tl.status === "out" ? day(tl.dueAt) : ""));
      var a = el("td"), b;
      if (tl.status === "out") { b = el("button", "btn btn-ghost", "Check in"); b.addEventListener("click", function () { act(function () { T.checkin(s, tl.id); say(tl.name + " is back in the crib."); }); }); }
      else if (tl.status === "in") { b = el("button", "btn", "Check out to me"); b.addEventListener("click", function () { act(function () { T.checkout(s, tl.id, me(), 2, ""); say(tl.name + " checked out to " + me() + ", due back in 2 days."); }); }); }
      else { b = el("button", "btn btn-ghost", "Open ticket"); b.addEventListener("click", function () { cur = tl.ticket; show("detail"); }); }
      b.type = "button"; a.appendChild(b); tr.appendChild(a); if (late) tr.className = "flag"; tb.appendChild(tr);
    });
  }
  function newForm() { opt($("nequip"), ["Other / not a crib tool"].concat(s.tools.map(function (t) { return t.id + " " + t.name; })), ""); }

  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.tab); }); });
  $("filter").addEventListener("change", render);
  $("who").addEventListener("change", function () { say("You're now " + me() + "."); render(); });
  $("back").addEventListener("click", function () { show("board"); });
  $("reset").addEventListener("click", start);
  $("nform").addEventListener("submit", function (e) {
    e.preventDefault(); var f = e.target, eq = f.equipment.value, isTool = /^T-\d+/.test(eq);
    act(function () {
      var t = T.createTicket(s, { title: f.title.value.trim(), equipment: isTool ? eq : "", area: f.area.value.trim(), priority: f.priority.value, job: f.job.value, notes: f.notes.value.trim(), requester: me(), toolId: isTool ? eq.split(" ")[0] : "", tagOut: f.tagOut.checked });
      f.reset(); cur = t.id; tab = "detail"; show("detail"); say("Ticket #" + t.id + " is in. It shows up as New until somebody takes it.");
    });
  });
  start();
})();
