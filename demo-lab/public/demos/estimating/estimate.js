/* Member list parser and estimate math. Runs in the browser, nothing leaves the page. */
(function (root) {
  var Shapes = (typeof module !== "undefined" && module.exports) ? require("./shapes.js") : root.GMAShapes;

  // Length to decimal feet. 20'-6", 20'-6 1/2", 20' 6", 20', 6", 20.5
  function parseLength(text) {
    if (text == null) return null;
    var s = String(text).trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/''/g, '"');
    if (!s) return null;
    var m = /^(\d+(?:\.\d+)?)\s*'\s*(?:-?\s*(\d+(?:\.\d+)?)?(?:[\s-]+(\d+)\s*\/\s*(\d+))?\s*"?)?$/.exec(s);
    if (m) {
      var inch = (m[2] ? parseFloat(m[2]) : 0) + (m[3] ? m[3] / m[4] : 0);
      if (inch >= 12) return null;
      return parseFloat(m[1]) + inch / 12;
    }
    m = /^(\d+)\s*'\s*-?\s*(\d+)\s*\/\s*(\d+)\s*"?$/.exec(s);
    if (m) return parseFloat(m[1]) + (m[2] / m[3]) / 12;
    m = /^(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\s*\/\s*(\d+))?\s*"$/.exec(s);
    if (m) return (parseFloat(m[1]) + (m[2] ? m[2] / m[3] : 0)) / 12;
    m = /^(\d+)\s*(?:ft)?\s*-\s*(\d+(?:\.\d+)?)\s*(?:in)?$/i.exec(s);
    if (m && parseFloat(m[2]) < 12) return parseFloat(m[1]) + parseFloat(m[2]) / 12;
    m = /^(\d+(?:\.\d+)?)\s*(?:ft)?$/i.exec(s);
    if (m) return parseFloat(m[1]);
    return null;
  }

  function fmtLength(ft) {
    if (ft == null) return "";
    var whole = Math.floor(ft + 1e-9), inch = (ft - whole) * 12;
    var sixteenths = Math.round(inch * 16);
    if (sixteenths >= 192) { whole += 1; sixteenths = 0; }
    var wi = Math.floor(sixteenths / 16), f = sixteenths % 16, fs = "";
    if (f) { var d = 16; while (f % 2 === 0) { f /= 2; d /= 2; } fs = " " + f + "/" + d; }
    return whole + "'-" + wi + fs + '"';
  }

  var SHAPE_RE = /^(?:(?:W|S|M|HP|C|MC|WT|ST|MT|HSS|L|PL)[\d.\/-]+(?:"|IN)?[X×*]|PIPE\d)/i;
  var HEADER_RE = /^(mark|piece|item|#)\b/i;

  function splitLine(line) {
    if (line.indexOf("\t") >= 0) return line.split("\t");
    if (line.indexOf(",") >= 0) return csvSplit(line);
    // free text: B1  W8x31  4 @ 20'-6"
    var out = [], re = /"[^"]*"|\S+/g, m;
    var t = line.replace(/\s*@\s*/g, " ").replace(/\b(qty|pcs?|ea)\b[:.]?/ig, " ");
    // keep 20'-6 1/2" together
    t = t.replace(/(\d+'\s*-?\s*\d*)\s+(\d+\/\d+"?)/g, "$1_$2");
    while ((m = re.exec(t))) out.push(m[0].replace(/_/g, " "));
    return out;
  }

  function csvSplit(line) {
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"' && cur.trim() === "") q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out;
  }

  // Returns {rows:[...], skipped:[...]}
  function parseList(text) {
    var rows = [], skipped = [], n = 0;
    String(text || "").split(/\r?\n/).forEach(function (raw, idx) {
      var line = raw.trim();
      if (!line || /^(\/\/|;)/.test(line) || line[0] === "#" && !/^#\d/.test(line)) return;
      var cells = splitLine(line).map(function (c) { return c.trim(); }).filter(function (c) { return c !== ""; });
      if (!cells.length) return;
      if (HEADER_RE.test(cells[0]) && !cells.some(function (c) { return Shapes.lookup(c); })) return;
      var si = -1;
      for (var i = 0; i < cells.length; i++) if (SHAPE_RE.test(cells[i].replace(/\s+/g, ""))) { si = i; break; }
      if (si < 0) { skipped.push({ line: idx + 1, text: line, why: "No shape found" }); return; }
      var mark = si > 0 ? cells.slice(0, si).join(" ") : "";
      var rest = cells.slice(si + 1), qty = null, len = null, notes = [];
      rest.forEach(function (c) {
        if (qty == null && /^\d+$/.test(c) && len == null) { qty = parseInt(c, 10); return; }
        if (len == null) { var L = parseLength(c); if (L != null) { len = L; return; } }
        if (qty == null && /^\d+$/.test(c)) { qty = parseInt(c, 10); return; }
        notes.push(c);
      });
      n++;
      var hit = Shapes.lookup(cells[si]);
      var row = {
        n: n, line: idx + 1, mark: mark || ("Line " + (idx + 1)),
        shape: hit ? hit.shape : Shapes.normalize(cells[si]), input: cells[si],
        qty: qty == null ? 1 : qty, length_ft: len, plf: hit ? hit.plf : null,
        source: hit ? hit.how : null, notes: notes.join(" "), flags: []
      };
      if (!hit) row.flags.push("Shape not in table, weight left blank");
      if (len == null) row.flags.push("No length found");
      if (qty == null) row.flags.push("No qty, used 1");
      rows.push(row);
    });
    return { rows: rows, skipped: skipped };
  }

  // Pricing follows the shop app: per lb = material x (1 + waste%) + labor.
  function compute(rows, rates) {
    var r = { material: +rates.material || 0, labor: +rates.labor || 0, waste: +rates.waste || 0 };
    var perLb = r.material * (1 + r.waste / 100) + r.labor;
    var tot = { pieces: 0, lbs: 0, material: 0, labor: 0, total: 0, flagged: 0 };
    var out = rows.map(function (row) {
      var each = (row.plf != null && row.length_ft != null) ? row.plf * row.length_ft : null;
      var lbs = each == null ? null : each * row.qty;
      var mat = lbs == null ? null : lbs * r.material * (1 + r.waste / 100);
      var lab = lbs == null ? null : lbs * r.labor;
      tot.pieces += row.qty;
      if (lbs != null) { tot.lbs += lbs; tot.material += mat; tot.labor += lab; } else tot.flagged++;
      return Object.assign({}, row, { lbs_each: each, lbs_total: lbs, tons: lbs == null ? null : lbs / 2000, material_cost: mat, labor_cost: lab, line_total: lbs == null ? null : mat + lab });
    });
    tot.total = tot.material + tot.labor;
    tot.tons = tot.lbs / 2000;
    tot.per_lb = perLb;
    return { rows: out, totals: tot, rates: r };
  }

  var api = { parseLength: parseLength, fmtLength: fmtLength, parseList: parseList, compute: compute };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMAEstimate = api;
})(this);
