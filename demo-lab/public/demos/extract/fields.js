/* Field parser for invoices, estimates and delivery tickets. Works on plain
   text from pdf.js or OCR. Rule: if a field isn't clearly in the text it stays
   blank and gets flagged. Nothing is made up. */
(function (root) {
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  var DATE_RE = /\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b|\b(\d{4})-(\d{2})-(\d{2})\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/i;
  var MONEY = "\\$?\\s*(-?[\\d,]+\\.\\d{2})";
  var DOC_WORDS = /^(invoice|estimate|proposal|quote|quotation|delivery ticket|delivery receipt|packing slip|bill of lading|statement|page \d)/i;

  function money(s) { return s == null ? null : Math.round(parseFloat(String(s).replace(/[,$\s]/g, "")) * 100) / 100; }
  function f(value, confidence, note) { return { value: value == null ? "" : value, confidence: value == null || value === "" ? "missing" : confidence, note: note || "" }; }
  function isoDate(m) {
    var y, mo, d;
    if (m[1]) { mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; }
    else if (m[4]) { y = +m[4]; mo = +m[5]; d = +m[6]; }
    else { mo = MONTHS[m[7].toLowerCase().slice(0, 4).replace(/t$/, "")] || MONTHS[m[7].toLowerCase().slice(0, 3)]; d = +m[8]; y = +m[9]; }
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    return y + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function clean(t) { return String(t || "").replace(/\r/g, "").replace(/[|]/g, " ").replace(/[ \t]+/g, " "); }

  function labeled(lines, re) {
    for (var i = 0; i < lines.length; i++) { var m = re.exec(lines[i]); if (m && m[1] && m[1].trim()) return { v: m[1].trim(), i: i }; }
    return null;
  }

  function parse(text) {
    var t = clean(text), lines = t.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var out = {}, low = t.toLowerCase();

    var type = /delivery (ticket|receipt)|packing slip|bill of lading/.test(low) ? "Delivery ticket" : /\b(estimate|proposal|quot(e|ation))\b/.test(low) ? "Estimate / quote" : /\binvoice\b/.test(low) ? "Invoice" : null;
    out.doc_type = f(type, "high");

    var v = null;
    for (var i = 0; i < Math.min(lines.length, 5); i++) { var L = lines[i]; if (!DOC_WORDS.test(L) && /[a-z]{3}/i.test(L) && !DATE_RE.test(L) && !/\d{3}.*\d{4}/.test(L)) { v = L.replace(/\s+(invoice|estimate|proposal|quote|delivery ticket|packing slip)\s*$/i, "").trim(); break; } }
    out.vendor = f(v, "medium", v ? "Top line of the doc. Check it." : "");

    var num = labeled(lines, /\b(?:invoice|inv|estimate|est|quote|ticket|delivery ticket|proposal)\s*(?:no\.?|number|#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-\/]{2,})/i);
    out.doc_number = f(num && num.v, "high");

    var dl = labeled(lines, /\b(?:invoice |estimate |ticket |delivery |ship )?date\s*[:#]?\s*(.+)$/i), date = null, dconf = "high";
    if (dl) { var m = DATE_RE.exec(dl.v); if (m) date = isoDate(m); }
    if (!date) { var m2 = DATE_RE.exec(t); if (m2) { date = isoDate(m2); dconf = "low"; } }
    out.date = f(date, dconf, dconf === "low" && date ? "No date label, took the first date found." : "");

    var po = labeled(lines, /\b(?:P\.?O\.?|purchase order)\s*(?:no\.?|number|#)?\s*[:#]\s*([A-Z0-9][A-Z0-9-]{1,})/i) || labeled(lines, /\bP\.?O\.?\s*#\s*([A-Z0-9-]{2,})/i);
    out.po_number = f(po && po.v, "high");

    var job = labeled(lines, /\b(?:job(?: name| site)?|project)\s*[:#]\s*(.+)$/i);
    out.job = f(job && job.v.replace(/\s+P\.?O\.?.*$/i, ""), "high");

    var cust = labeled(lines, /\b(?:bill to|sold to|customer|ship to|to)\s*:\s*(.+)$/i), cc = "high";
    if (!cust) { for (var k = 0; k < lines.length - 1; k++) if (/^(bill to|sold to|customer|ship to)\s*:?$/i.test(lines[k])) { cust = { v: lines[k + 1] }; cc = "medium"; break; } }
    out.customer = f(cust && cust.v, cc);

    function amount(re) { var a = labeled(lines, re); return a ? money(a.v) : null; }
    var sub = amount(new RegExp("\\bsub-?\\s?total\\b[^\\d$-]*" + MONEY, "i"));
    var tax = amount(new RegExp("\\b(?:sales )?tax\\b[^$\\n]*?" + MONEY + "\\s*$", "i"));
    var tot = amount(new RegExp("\\b(?:grand total|total due|amount due|balance due|invoice total|estimate total|total)\\b(?!.*sub)[^\\d$-]*" + MONEY, "i"));

    // Line items: qty [unit] description [unit price] amount
    var items = [];
    var IT = /^(\d+(?:\.\d+)?)\s+(?:(EA|FT|LF|PC|PCS|HR|HRS|LS|TON|TONS|CY|SF|BDL|BOX|GAL|LB|LBS|SET)\s+)?(.+?)(?:\s+\$?([\d,]+\.\d{2,4}))?(?:\s+\$?([\d,]+\.\d{2}))?$/i;
    var started = false;
    lines.forEach(function (ln) {
      if (/\b(qty|quantity)\b/i.test(ln) && /\b(desc|description|item)\b/i.test(ln)) { started = true; return; }
      if (/sub-?\s?total|^total|amount due|balance due|\btax\b/i.test(ln)) { started = false; return; }
      if (!started) return;
      var m = IT.exec(ln);
      if (!m) return;
      var it = { qty: parseFloat(m[1]), unit: (m[2] || "").toUpperCase(), description: m[3].trim(), unit_price: null, amount: null, confidence: "high" };
      if (m[4] && m[5]) { it.unit_price = money(m[4]); it.amount = money(m[5]); }
      else if (m[4]) { it.amount = money(m[4]); }
      var up = it.unit_price, am = it.amount;
      if (it.unit_price != null && it.amount != null && Math.abs(it.qty * up - am) > 0.02) { it.confidence = "low"; it.note = "Qty x price doesn't match the amount."; }
      if (it.unit_price != null) it.unit_price = String(m[4]).replace(/,/g, "");
      if (it.amount != null) it.amount = am.toFixed(2);
      items.push(it);
    });

    var lineSum = items.reduce(function (a, b) { return a + (b.amount ? parseFloat(b.amount) : 0); }, 0);
    var subConf = "high", totConf = "high", checks = [];
    if (sub != null && items.some(function (x) { return x.amount != null; })) {
      if (Math.abs(lineSum - sub) > 0.02) { subConf = "low"; checks.push("Line items add up to " + lineSum.toFixed(2) + ", subtotal says " + sub.toFixed(2) + "."); }
      else checks.push("Line items add up to the subtotal.");
    }
    if (tot != null && sub != null) {
      var exp = sub + (tax || 0);
      if (Math.abs(exp - tot) > 0.02) { totConf = "low"; checks.push("Subtotal plus tax is " + exp.toFixed(2) + ", total says " + tot.toFixed(2) + "."); }
      else checks.push("Subtotal plus tax matches the total.");
    }
    function fix2(n) { return n == null ? null : n.toFixed(2); }
    out.subtotal = f(fix2(sub), subConf);
    out.tax = f(fix2(tax), "high");
    out.total = f(fix2(tot), totConf);
    return { fields: out, line_items: items, checks: checks };
  }

  var LABELS = { doc_type: "Doc type", vendor: "Vendor / from", doc_number: "Doc number", date: "Date", customer: "Customer / bill to", job: "Job", po_number: "PO number", subtotal: "Subtotal", tax: "Tax", total: "Total" };
  var api = { parse: parse, LABELS: LABELS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMAFields = api;
})(this);
