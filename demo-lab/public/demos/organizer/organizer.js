/* Rename and sort rules for the File Organizer sandbox. Works on file names and
   basic metadata only. Rule: if a piece (job, type, vendor, date) isn't clear
   from the name, it is flagged for review instead of guessed. */
(function (root) {
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  var DEFAULT_RULES = {
    jobs: "J2041 PineHollow = pine hollow, pinehollow, ph mezz, 2041\nJ2047 CedarRun = cedar run, cedarrun, cr stair, 2047\nJ2052 MillPond = mill pond, millpond, canopy, 2052",
    types: "Invoice = inv, invoice, bill\nDrawing = dwg, drawing, shop dwg, rev, sheet, .dwg, .dxf\nPO = po, purchase order, p.o\nDelivery = delivery, dt, ticket, packing, pack slip, bol\nPhoto = img, photo, pic, dsc, .jpg, .jpeg, .heic, .png",
    vendors: "NorthfieldSteel = northfield, nss\nKettleBrook = kettle brook, kettlebrook, kbc\nBlueLedge = blue ledge, blueledge, bl supply"
  };
  var NO_VENDOR_TYPES = { Photo: 1, Drawing: 1 };

  function parseRules(text) {
    return String(text || "").split(/\n/).map(function (l) {
      var i = l.indexOf("="); if (i < 0) return null;
      var key = l.slice(0, i).trim(), words = l.slice(i + 1).split(",").map(function (w) { return w.trim().toLowerCase(); }).filter(Boolean);
      return key && words.length ? { key: key, words: words } : null;
    }).filter(Boolean);
  }
  function tokens(name) { return " " + name.toLowerCase().replace(/[_\-.()\[\]]+/g, " ").replace(/\s+/g, " ") + " "; }
  function ext(name) { var m = /\.([a-z0-9]{1,5})$/i.exec(name); return m ? "." + m[1].toLowerCase() : ""; }
  function match(rules, name) {
    var t = tokens(name), e = ext(name), hits = [];
    rules.forEach(function (r) {
      if (r.words.some(function (w) { return w.charAt(0) === "." ? w === e : t.indexOf(" " + w.replace(/[_\-.]+/g, " ").trim() + " ") >= 0; })) hits.push(r.key);
    });
    return hits;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function valid(y, m, d) { return y >= 2000 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? y + "-" + pad(m) + "-" + pad(d) : null; }
  function findDate(name) {
    var s = name.toLowerCase(), m, v, pats = [
      [/(20\d\d)[-_. ]?(\d\d)[-_. ]?(\d\d)(?!\d)/g, function (m) { return valid(+m[1], +m[2], +m[3]); }],
      [/(?:^|[^\d])(\d{1,2})[-_.](\d{1,2})[-_.](\d{2,4})(?!\d)/g, function (m) { var y = +m[3]; if (y < 100) y += 2000; return valid(y, +m[1], +m[2]); }],
      [/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_. ]*(\d{1,2})(?:st|nd|rd|th)?[-_., ]*(20\d\d|\d\d)(?!\d)/g, function (m) { var y = +m[3]; if (y < 100) y += 2000; return valid(y, MONTHS[m[1]], +m[2]); }],
      [/(?:^|[^\d])(\d\d)(\d\d)(\d\d)(?!\d)/g, function (m) { return valid(2000 + +m[3], +m[1], +m[2]); }]
    ];
    for (var i = 0; i < pats.length; i++) { pats[i][0].lastIndex = 0; while ((m = pats[i][0].exec(s))) { if ((v = pats[i][1](m))) return v; pats[i][0].lastIndex = m.index + 1; } }
    return null;
  }
  function dupKey(name) {
    return name.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/\s*\(\d+\)|[-_ ]?copy( of)?|^copy of /g, "").replace(/[^a-z0-9]/g, "");
  }
  function fileDate(ms) { if (!ms) return null; var d = new Date(ms); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function plan(files, ruleText, opts) {
    opts = opts || {};
    var R = { jobs: parseRules(ruleText.jobs), types: parseRules(ruleText.types), vendors: parseRules(ruleText.vendors) };
    var seen = {}, used = {};
    return files.map(function (f, i) {
      var flags = [], status = "ok";
      var jobs = match(R.jobs, f.name), types = match(R.types, f.name), vendors = match(R.vendors, f.name);
      var e = ext(f.name);
      // a photo extension only counts as a type if nothing more specific matched
      if (types.length > 1 && types.indexOf("Photo") >= 0) types = types.filter(function (t) { return t !== "Photo"; });
      var job = jobs.length === 1 ? jobs[0] : "", type = types.length === 1 ? types[0] : "", vendor = vendors.length === 1 ? vendors[0] : "";
      if (jobs.length > 1) flags.push("matches more than one job (" + jobs.join(", ") + ")"); else if (!job) flags.push("no job found in name");
      if (types.length > 1) flags.push("matches more than one type (" + types.join(", ") + ")"); else if (!type) flags.push("no doc type found in name");
      if (vendors.length > 1) flags.push("matches more than one vendor");
      else if (!vendor && type && !NO_VENDOR_TYPES[type]) flags.push("no vendor found in name");
      var date = findDate(f.name), dateSrc = "name";
      if (!date && opts.useFileDate !== false && f.lastModified) { date = fileDate(f.lastModified); dateSrc = "file date"; flags.push("date taken from file timestamp, check it"); }
      if (!date) { date = ""; flags.push("no date found"); }
      var k = dupKey(f.name) + "|" + (f.size || 0);
      if (seen[k] != null) { status = "duplicate"; flags.unshift("looks like a copy of " + files[seen[k]].name); } else seen[k] = i;
      var hardMissing = !job || !type || (!vendor && !NO_VENDOR_TYPES[type]) || !date;
      if (status !== "duplicate" && hardMissing) status = "review";
      var jobName = job.replace(/\s+/g, "-");
      var parts = [date.replace(/-/g, opts.dateSep == null ? "-" : opts.dateSep), jobName, type, NO_VENDOR_TYPES[type] && !vendor ? "" : vendor].filter(Boolean);
      var newName = f.name, folder;
      if (status === "duplicate") folder = "_Duplicates";
      else if (status === "review") folder = "_Needs review";
      else {
        newName = parts.join("_") + e; folder = jobName + "/" + type;
        var full = (folder + "/" + newName).toLowerCase();
        if (used[full]) { used[full]++; newName = parts.join("_") + "_" + used[full] + e; flags.push("same name as another file, added _" + used[full]); } else used[full] = 1;
      }
      if (status === "ok" && flags.length) status = "check";
      return { original: f.name, size: f.size || 0, newName: newName, folder: folder, path: folder + "/" + newName, status: status, job: job, type: type, vendor: vendor, date: date, dateSource: date ? dateSrc : "", flags: flags };
    });
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCsv(rows) {
    var head = ["original_name", "new_name", "folder", "new_path", "status", "job", "type", "vendor", "date", "date_source", "flags"];
    return [head.join(",")].concat(rows.map(function (r) { return [r.original, r.newName, r.folder, r.path, r.status, r.job, r.type, r.vendor, r.date, r.dateSource, r.flags.join("; ")].map(csvCell).join(","); })).join("\r\n") + "\r\n";
  }
  var api = { plan: plan, toCsv: toCsv, findDate: findDate, parseRules: parseRules, DEFAULT_RULES: DEFAULT_RULES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GMAOrganizer = api;
})(this);
