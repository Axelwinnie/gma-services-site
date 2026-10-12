(function () {
  var $ = function (id) { return document.getElementById(id); }, O = window.GMAOrganizer;
  var files = [], rows = [], edits = {}; // edits keyed by original name + index
  var LABEL = { ok: "ready", check: "check", review: "needs review", duplicate: "copy?", edited: "edited" };

  function setRules(r) { $("r-jobs").value = r.jobs; $("r-types").value = r.types; $("r-vendors").value = r.vendors; }
  function status(t) { $("status").textContent = t || ""; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function run() {
    if (!files.length) { $("out").hidden = true; return; }
    rows = O.plan(files, { jobs: $("r-jobs").value, types: $("r-types").value, vendors: $("r-vendors").value }, { useFileDate: $("use-fdate").checked });
    rows.forEach(function (r, i) {
      var e = edits[i + "|" + r.original];
      if (e) { r.newName = e.newName; r.folder = e.folder; r.path = r.folder + "/" + r.newName; r.status = "edited"; }
    });
    render();
  }
  function render() {
    var c = { ok: 0, check: 0, review: 0, duplicate: 0, edited: 0 };
    rows.forEach(function (r) { c[r.status]++; });
    var sum = $("sum"); sum.innerHTML = "";
    [["Files", rows.length], ["Ready", c.ok + c.edited], ["Check", c.check], ["Needs review", c.review], ["Copies", c.duplicate]].forEach(function (p) {
      var d = el("div"); d.appendChild(el("b", null, p[1])); d.appendChild(el("span", null, p[0])); sum.appendChild(d);
    });
    var only = $("show").value === "flagged", tb = $("ptbl").querySelector("tbody"); tb.innerHTML = "";
    rows.forEach(function (r, i) {
      if (only && (r.status === "ok" || r.status === "edited")) return;
      var tr = el("tr"), a = el("td", "old", r.original), b = el("td"), f = el("td"), s = el("td");
      function inp(key) {
        var x = el("input"); x.value = r[key]; x.setAttribute("aria-label", (key === "newName" ? "New name for " : "Folder for ") + r.original);
        x.addEventListener("change", function () {
          r[key] = x.value.trim() || r[key]; r.status = "edited"; r.path = r.folder + "/" + r.newName;
          edits[i + "|" + r.original] = { newName: r.newName, folder: r.folder }; render();
        });
        return x;
      }
      b.appendChild(inp("newName")); f.appendChild(inp("folder"));
      s.appendChild(el("span", "st st-" + r.status, LABEL[r.status]));
      if (r.flags.length) s.appendChild(el("div", "why", r.flags.join(". ") + "."));
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(f); tr.appendChild(s); tb.appendChild(tr);
    });
    renderTree();
    $("out").hidden = false;
  }
  function renderTree() {
    var root = {};
    rows.forEach(function (r) {
      var node = root; r.folder.split("/").filter(Boolean).forEach(function (p) { node[p] = node[p] || {}; node = node[p]; });
      (node["\u0000files"] = node["\u0000files"] || []).push(r);
    });
    function build(node) {
      var ul = el("ul");
      Object.keys(node).filter(function (k) { return k !== "\u0000files"; }).sort(function (x, y) { return (x[0] === "_") - (y[0] === "_") || x.localeCompare(y); }).forEach(function (k) {
        var li = el("li"); li.appendChild(el("span", "dir", k + "/")); li.appendChild(build(node[k])); ul.appendChild(li);
      });
      (node["\u0000files"] || []).forEach(function (r) { ul.appendChild(el("li", "file" + (r.status === "duplicate" ? " dup" : r.status === "review" ? " rev" : ""), r.newName)); });
      return ul;
    }
    var t = $("tree"); t.innerHTML = ""; t.appendChild(build(root));
  }
  function save(blob, name) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function setFiles(list, label) {
    files = list.map(function (f) { return { name: f.name, size: f.size, lastModified: f.lastModified }; });
    edits = {}; status(label); run();
  }

  setRules(O.DEFAULT_RULES);
  $("load-sample").addEventListener("click", function () { setFiles(window.GMAOrganizerSamples, "Loaded " + window.GMAOrganizerSamples.length + " fictional sample files."); });
  $("file").addEventListener("change", function () { var l = Array.prototype.slice.call(this.files); if (l.length) setFiles(l, "Read the names of " + l.length + " of your files. Nothing was opened or sent."); this.value = ""; });
  var drop = $("drop");
  drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
  drop.addEventListener("drop", function (e) {
    e.preventDefault(); drop.classList.remove("over");
    var l = Array.prototype.slice.call(e.dataTransfer.files || []);
    if (l.length) setFiles(l, "Read the names of " + l.length + " dropped files. Nothing was opened or sent."); else status("No files came through. Folders don't work here, drop the files themselves.");
  });
  $("reset").addEventListener("click", function () { files = []; rows = []; edits = {}; status("Cleared."); $("out").hidden = true; });
  $("apply").addEventListener("click", function () { if (!files.length) { status("Load the sample pile or pick some files first."); return; } run(); status("Rules applied. Your manual edits were kept."); });
  $("defaults").addEventListener("click", function () { setRules(O.DEFAULT_RULES); run(); });
  $("use-fdate").addEventListener("change", run);
  $("show").addEventListener("change", render);
  $("dl-csv").addEventListener("click", function () { save(new Blob([O.toCsv(rows)], { type: "text/csv" }), "rename-plan.csv"); });
  $("dl-zip").addEventListener("click", function () {
    var z = [{ name: "rename-plan.csv", data: O.toCsv(rows) }, { name: "README.txt", data: "Folder layout from the GMA Demo Lab File Organizer sandbox.\r\nEach file in here is an empty placeholder. Your real files were never read or included.\r\nUse rename-plan.csv to see which original file goes where.\r\n" }];
    rows.forEach(function (r) { z.push({ name: "organized/" + r.path, data: "" }); });
    save(window.GMAZip.zip(z), "folder-layout.zip");
  });
})();
