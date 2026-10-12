(function () {
  var E = window.GMAEstimate, $ = function (id) { return document.getElementById(id); };
  var last = null;
  var sel = $("sample");
  window.GMASamples.forEach(function (s) { var o = document.createElement("option"); o.value = s.id; o.textContent = s.name + ". Sample data, fictional"; sel.appendChild(o); });

  function rates() { return { material: $("r-mat").value, labor: $("r-lab").value, waste: $("r-waste").value }; }
  function f(n, d) { return n == null ? "" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function money(n) { return n == null ? "" : "$" + f(n, 2); }
  function td(t, cls) { var e = document.createElement("td"); e.textContent = t; if (cls) e.className = cls; return e; }
  function jobName() { var s = window.GMASamples.filter(function (x) { return x.id === sel.value; })[0]; return s ? s.name : "Your member list"; }

  function run() {
    var p = E.parseList($("list").value);
    if (!p.rows.length) { $("out").hidden = true; alert("I couldn't find any members in that list. Try one per line: mark, shape, qty, length."); return; }
    var c = E.compute(p.rows, rates());
    c.skipped = p.skipped; c.job = jobName(); c.created = new Date().toISOString();
    last = c;
    var tb = $("tbl").querySelector("tbody"); tb.innerHTML = "";
    c.rows.forEach(function (r) {
      var tr = document.createElement("tr"); if (r.flags.length) tr.className = "flag";
      [r.n, r.mark, r.shape].forEach(function (v) { tr.appendChild(td(v)); });
      tr.appendChild(td(r.qty, "n")); tr.appendChild(td(E.fmtLength(r.length_ft), "n"));
      tr.appendChild(td(f(r.plf, 2), "n")); tr.appendChild(td(f(r.lbs_each, 1), "n")); tr.appendChild(td(f(r.lbs_total, 1), "n"));
      tr.appendChild(td(f(r.tons, 3), "n")); tr.appendChild(td(money(r.material_cost), "n")); tr.appendChild(td(money(r.labor_cost), "n"));
      tr.appendChild(td(money(r.line_total), "n")); tr.appendChild(td(r.flags.join(". ")));
      tb.appendChild(tr);
    });
    var t = c.totals;
    $("tbl").querySelector("tfoot").innerHTML = "";
    var fr = document.createElement("tr");
    ["", "Total", "", f(t.pieces, 0), "", "", "", f(t.lbs, 1), f(t.tons, 3), money(t.material), money(t.labor), money(t.total), ""].forEach(function (v, i) { fr.appendChild(td(v, i > 2 && i < 12 ? "n" : "")); });
    $("tbl").querySelector("tfoot").appendChild(fr);
    $("totals").innerHTML = "";
    [["Job", c.job], ["Pieces", f(t.pieces, 0)], ["Total weight", f(t.lbs, 0) + " lb"], ["Tons", f(t.tons, 2)], ["Rate per lb", money(t.per_lb)], ["Sample total", money(t.total)]].forEach(function (x) {
      var d = document.createElement("div"), s = document.createElement("span"), b = document.createElement("b");
      s.textContent = x[0]; b.textContent = x[1]; d.appendChild(s); d.appendChild(b); $("totals").appendChild(d);
    });
    var w = [];
    if (t.flagged) w.push(t.flagged + " line(s) have no weight. Check the flags column. On a real job I'd look those up by hand.");
    if (p.skipped.length) w.push("Skipped " + p.skipped.length + " line(s) with no shape: " + p.skipped.map(function (s) { return "line " + s.line; }).join(", ") + ".");
    $("warn").textContent = w.join(" "); $("warn").hidden = !w.length;
    $("out").hidden = false;
  }

  function header() { return ["#", "Mark", "Shape", "Qty", "Length", "Length ft", "lb/ft", "lb each", "lb total", "Tons", "Material $", "Labor $", "Line $", "Flags"]; }
  function r2(n, d) { return n == null ? "" : Math.round(n * Math.pow(10, d)) / Math.pow(10, d); }
  function rowsOut() {
    return last.rows.map(function (r) { return [r.n, r.mark, r.shape, r.qty, E.fmtLength(r.length_ft), r2(r.length_ft, 4), r.plf == null ? "" : r.plf, r2(r.lbs_each, 2), r2(r.lbs_total, 2), r2(r.tons, 4), r2(r.material_cost, 2), r2(r.labor_cost, 2), r2(r.line_total, 2), r.flags.join(". ")]; });
  }
  function save(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  var NOTE = "Demo, sample pricing. A person reviews every real packet. Granite Models Automations, granitemodels@gmail.com";

  $("dl-csv").onclick = function () {
    if (!last) return;
    var q = function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [[NOTE], ["Job", last.job], header()].concat(rowsOut(), [["", "Total", "", last.totals.pieces, "", "", "", "", r2(last.totals.lbs, 2), r2(last.totals.tons, 4), r2(last.totals.material, 2), r2(last.totals.labor, 2), r2(last.totals.total, 2)]]);
    save(new Blob([lines.map(function (l) { return l.map(q).join(","); }).join("\r\n")], { type: "text/csv" }), "gma-steel-estimate-demo.csv");
  };
  $("dl-xlsx").onclick = function () {
    if (!last) return;
    var t = last.totals, rt = last.rates;
    var sum = [["Granite Models Automations, steel estimate (demo)"], [NOTE], [], ["Job", last.job], ["Created", last.created], ["Pieces", t.pieces], ["Total lb", r2(t.lbs, 2)], ["Tons", r2(t.tons, 4)], ["Material $/lb", rt.material], ["Waste %", rt.waste], ["Labor $/lb", rt.labor], ["Material $", r2(t.material, 2)], ["Labor $", r2(t.labor, 2)], ["Total $", r2(t.total, 2)], ["Lines with no weight", t.flagged]];
    save(window.GMAXlsx.build([{ name: "Summary", rows: sum }, { name: "Members", rows: [header()].concat(rowsOut()) }]), "gma-steel-estimate-demo.xlsx");
  };
  $("dl-json").onclick = function () {
    if (!last) return;
    var o = { note: NOTE, job: last.job, created: last.created, rates: last.rates, totals: last.totals, members: last.rows, skipped_lines: last.skipped, weight_source: "Built-in AISC shape table (v16 values), plate at 490 lb/cu ft" };
    save(new Blob([JSON.stringify(o, null, 2)], { type: "application/json" }), "gma-steel-estimate-demo.json");
  };
  $("dl-pdf").onclick = function () { if (!last) return; $("pdate").textContent = new Date().toLocaleString(); window.print(); };
  $("run").onclick = run;
  ["r-mat", "r-lab", "r-waste"].forEach(function (id) { $(id).addEventListener("input", function () { if (last) run(); }); });
  sel.onchange = function () { var s = window.GMASamples.filter(function (x) { return x.id === sel.value; })[0]; if (s) { $("list").value = s.text; run(); } };
  $("file").onchange = function (e) {
    var file = e.target.files[0]; if (!file) return;
    if (file.size > 1000000) { alert("That file is over 1 MB. Send it to me instead and I'll take a look."); return; }
    var rd = new FileReader(); rd.onload = function () { sel.value = ""; $("list").value = rd.result; run(); }; rd.readAsText(file);
    e.target.value = "";
  };
  $("reset").onclick = function () { sel.value = ""; $("list").value = ""; $("r-mat").value = "1.10"; $("r-lab").value = "1.60"; $("r-waste").value = "5"; $("out").hidden = true; last = null; };
  if (location.hash === "#sample") { sel.value = window.GMASamples[0].id; sel.onchange(); }
})();
