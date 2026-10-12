(function () {
  var $ = function (id) { return document.getElementById(id); }, P = window.GMAFields, S = window.GMAExtractSamples;
  var cur = null; // {name, source, text, fields, line_items, checks}
  var PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
  var TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

  S.forEach(function (s) { var o = document.createElement("option"); o.value = s.id; o.textContent = s.name + ". Sample data, fictional"; $("sample").appendChild(o); });
  function status(t) { $("status").textContent = t || ""; }
  function load(src) { return new Promise(function (ok, bad) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("Couldn't load " + src)); }; document.head.appendChild(s); }); }

  function confBadge(c) { var s = document.createElement("span"); s.className = "conf conf-" + c; s.textContent = { high: "found", medium: "check", low: "not sure", missing: "not on doc", edited: "edited" }[c] || c; return s; }
  function input(val, onchange) { var i = document.createElement("input"); i.value = val == null ? "" : val; i.addEventListener("input", function () { onchange(i.value, i); }); return i; }

  function render() {
    var tb = $("ftbl").querySelector("tbody"); tb.innerHTML = "";
    Object.keys(P.LABELS).forEach(function (k) {
      var fld = cur.fields[k], tr = document.createElement("tr"), a = document.createElement("td"), b = document.createElement("td"), c = document.createElement("td");
      a.textContent = P.LABELS[k];
      b.appendChild(input(fld.value, function (v) { fld.value = v; fld.confidence = "edited"; c.innerHTML = ""; c.appendChild(confBadge("edited")); }));
      c.appendChild(confBadge(fld.confidence)); if (fld.note) c.title = fld.note;
      tr.appendChild(a); tr.appendChild(b); tr.appendChild(c); tb.appendChild(tr);
    });
    var it = $("itbl").querySelector("tbody"); it.innerHTML = "";
    if (!cur.line_items.length) { var r = document.createElement("tr"), d = document.createElement("td"); d.colSpan = 6; d.textContent = "No line items found. Nothing filled in."; r.appendChild(d); it.appendChild(r); }
    cur.line_items.forEach(function (li) {
      var tr = document.createElement("tr"), c = document.createElement("td");
      ["qty", "unit", "description", "unit_price", "amount"].forEach(function (k) {
        var td = document.createElement("td"); td.appendChild(input(li[k], function (v) { li[k] = v; li.confidence = "edited"; c.innerHTML = ""; c.appendChild(confBadge("edited")); })); tr.appendChild(td);
      });
      c.appendChild(confBadge(li.confidence)); if (li.note) c.title = li.note; tr.appendChild(c); it.appendChild(tr);
    });
    $("checks").innerHTML = "";
    (cur.checks.length ? cur.checks : ["No totals to cross-check."]).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; $("checks").appendChild(li); });
    $("raw").textContent = cur.text;
    $("out").hidden = false;
  }
  function setResult(name, source, text, res) {
    res = JSON.parse(JSON.stringify(res));
    cur = { name: name, source: source, text: text, fields: res.fields, line_items: res.line_items, checks: res.checks };
    render();
  }
  function previewImg(src) { $("preview").innerHTML = ""; var i = new Image(); i.src = src; i.alt = "Uploaded document"; $("preview").appendChild(i); }
  function previewMsg(t) { $("preview").innerHTML = ""; var p = document.createElement("p"); p.textContent = t; $("preview").appendChild(p); }

  $("sample").onchange = function () {
    var s = S.filter(function (x) { return x.id === $("sample").value; })[0]; if (!s) return;
    previewImg(s.image); setResult(s.name, "sample (precomputed)", s.text, s.result); status("Sample loaded. These results are saved with the page so they always come out the same.");
  };

  function ocr(img) {
    return load(TESS).then(function () {
      return window.Tesseract.recognize(img, "eng", { logger: function (m) { if (m.status === "recognizing text") status("Reading the image... " + Math.round(m.progress * 100) + "%"); } });
    }).then(function (r) { return r.data.text; });
  }
  function pdfLines(page) {
    return page.getTextContent().then(function (tc) {
      var rows = {};
      tc.items.forEach(function (it) { var y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push(it); });
      return Object.keys(rows).sort(function (a, b) { return b - a; }).map(function (y) { return rows[y].sort(function (a, b) { return a.transform[4] - b.transform[4]; }).map(function (i) { return i.str; }).join(" ").replace(/\s+/g, " ").trim(); }).filter(Boolean).join("\n");
    });
  }
  function readPdf(file) {
    return load(PDFJS + "pdf.min.js").then(function () {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      return file.arrayBuffer();
    }).then(function (buf) { return window.pdfjsLib.getDocument({ data: buf }).promise; }).then(function (pdf) {
      return pdf.getPage(1).then(function (page) {
        var vp = page.getViewport({ scale: 1.6 }), cv = document.createElement("canvas");
        cv.width = vp.width; cv.height = vp.height;
        return page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(function () {
          $("preview").innerHTML = ""; $("preview").appendChild(cv);
          var jobs = []; for (var i = 1; i <= Math.min(pdf.numPages, 5); i++) jobs.push(pdf.getPage(i).then(pdfLines));
          return Promise.all(jobs).then(function (t) {
            var text = t.join("\n");
            if (text.replace(/\s/g, "").length > 40) return { text: text, how: "PDF text layer" };
            status("No text in this PDF, looks like a scan. Running OCR on page 1...");
            return ocr(cv).then(function (tx) { return { text: tx, how: "OCR of scanned PDF page 1" }; });
          });
        });
      });
    });
  }
  function handle(file) {
    if (!file) return;
    if (file.size > 15e6) { status("That file is over 15 MB. Send it to me instead and I'll take a look."); return; }
    $("sample").value = ""; status("Reading " + file.name + "...");
    var isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name), isTif = /tiff?$/i.test(file.type) || /\.tiff?$/i.test(file.name);
    var job;
    if (isPdf) job = readPdf(file);
    else {
      if (isTif) previewMsg("Most browsers can't show a TIFF, so there's no preview. It still gets read."); else previewImg(URL.createObjectURL(file));
      job = ocr(file).then(function (t) { return { text: t, how: "OCR" }; });
    }
    job.then(function (r) {
      var res = P.parse(r.text);
      // OCR guesses never get rated higher than "check"
      if (/OCR/.test(r.how)) { Object.keys(res.fields).forEach(function (k) { if (res.fields[k].confidence === "high") res.fields[k].confidence = "medium"; }); res.line_items.forEach(function (l) { if (l.confidence === "high") l.confidence = "medium"; }); }
      setResult(file.name, r.how, r.text, res);
      status("Done. Read with " + r.how + ". Check every field before you use it.");
    }).catch(function (e) { status("Couldn't read that file. " + (e && e.message ? e.message : "")); });
  }
  $("file").onchange = function (e) { handle(e.target.files[0]); e.target.value = ""; };
  var dz = $("drop");
  dz.addEventListener("dragover", function (e) { e.preventDefault(); dz.classList.add("over"); });
  dz.addEventListener("dragleave", function () { dz.classList.remove("over"); });
  dz.addEventListener("drop", function (e) { e.preventDefault(); dz.classList.remove("over"); handle(e.dataTransfer.files[0]); });

  function flat() {
    var rows = [["Field", "Value", "Check"]];
    Object.keys(P.LABELS).forEach(function (k) { rows.push([P.LABELS[k], cur.fields[k].value, cur.fields[k].confidence]); });
    return rows;
  }
  function itemRows() { return [["Qty", "Unit", "Description", "Unit price", "Amount", "Check"]].concat(cur.line_items.map(function (l) { return [num(l.qty), l.unit, l.description, num(l.unit_price), num(l.amount), l.confidence]; })); }
  function num(v) { if (v === "" || v == null) return ""; var n = parseFloat(String(v).replace(/[,$]/g, "")); return isFinite(n) && /^\s*\$?[\d,.]+\s*$/.test(String(v)) ? n : v; }
  function save(blob, name) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  var NOTE = "Demo extraction. Check every field. A person reviews real jobs. Granite Models Automations, granitemodels@gmail.com";
  $("dl-csv").onclick = function () {
    if (!cur) return;
    var q = function (v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var all = [[NOTE], ["Source", cur.name]].concat(flat(), [[]], itemRows());
    save(new Blob([all.map(function (r) { return r.map(q).join(","); }).join("\r\n")], { type: "text/csv" }), "gma-doc-extract-demo.csv");
  };
  $("dl-xlsx").onclick = function () {
    if (!cur) return;
    save(window.GMAXlsx.build([{ name: "Fields", rows: [[NOTE], ["Source", cur.name], []].concat(flat().map(function (r) { return [r[0], num(r[1]), r[2]]; })) }, { name: "Line items", rows: itemRows() }]), "gma-doc-extract-demo.xlsx");
  };
  $("dl-json").onclick = function () {
    if (!cur) return;
    var o = { note: NOTE, source: cur.name, read_with: cur.source, fields: cur.fields, line_items: cur.line_items, checks: cur.checks, raw_text: cur.text };
    save(new Blob([JSON.stringify(o, null, 2)], { type: "application/json" }), "gma-doc-extract-demo.json");
  };
  $("reset").onclick = function () { cur = null; $("sample").value = ""; $("out").hidden = true; $("preview").innerHTML = ""; status(""); };

  if (location.hash === "#sample") { $("sample").value = S[0].id; $("sample").onchange(); }
  // Self-test hook: runs the real OCR path on a sample image
  var ot = /^#ocrtest-?(\w*)$/.exec(location.hash);
  if (ot) {
    var smp = S.filter(function (x) { return x.id === ot[1]; })[0] || S[0], im = new Image();
    im.onload = function () { var c = document.createElement("canvas"); c.width = im.width * 2; c.height = im.height * 2; var g = c.getContext("2d"); g.drawImage(im, 0, 0, c.width, c.height); c.toBlob(function (b) { handle(new File([b], "ocrtest-" + smp.id + ".png", { type: "image/png" })); }); };
    im.src = smp.image;
  }
})();
