/* Browser stand-in for the installed File Organizer's folder scan, apply and undo.
   The rename plan itself stays in organizer.js (the parity port of engine.py).
   Nothing here reads or writes the visitor's disk. Paths that look like
   C:\Jobs\... are keys in an in-memory sample tree. */
(function (root) {
  var VERSION = "0.1.1";
  var INBOX = "C:\\Jobs\\Inbox";
  var ORGANISED = "C:\\Jobs\\Organised";
  var DATA = "C:\\ProgramData\\GMA\\FileOrganizer";
  var BACKUPS = DATA + "\\backups";
  var DATE_SEPS = ["-", "", ".", "_", " "];

  function build(O, samples) {
    if (!O || !O.plan || !O.DEFAULT_RULES) throw new Error("organizer.js must load before the File Organizer demo.");

    function clone(v) { return JSON.parse(JSON.stringify(v)); }
    function norm(p) {
      var s = String(p || "").trim().replace(/\//g, "\\").replace(/\\+/g, "\\");
      if (/^[a-z]:/i.test(s)) s = s.charAt(0).toUpperCase() + s.slice(1);
      if (s === "C:") s = "C:\\";
      if (s.length > 3 && s.charAt(s.length - 1) === "\\") s = s.slice(0, -1);
      return s;
    }
    function parent(p) {
      var n = norm(p);
      if (!n || n === "C:\\") return "";
      var i = n.lastIndexOf("\\");
      if (i < 0) return "";
      var par = n.slice(0, i);
      return par === "C:" ? "C:\\" : par;
    }
    function base(p) {
      var n = norm(p);
      if (n === "C:\\") return "C:\\";
      var i = n.lastIndexOf("\\");
      return i < 0 ? n : n.slice(i + 1);
    }
    function unusable(path) {
      var p = norm(path);
      return p === "C:\\" || p === "C:\\ProgramData" || p.indexOf("C:\\ProgramData\\") === 0;
    }
    function ensureDir(state, dir) {
      var p = norm(dir);
      if (!p) return;
      var bits = p.split("\\").filter(Boolean);
      var acc = "";
      bits.forEach(function (bit, i) {
        if (i === 0) acc = bit === "C:" ? "C:\\" : bit;
        else acc = (acc === "C:\\" ? "C:\\" : acc + "\\") + bit;
        if (state.dirs.indexOf(acc) < 0) state.dirs.push(acc);
      });
    }
    function splitName(name) {
      var m = /^(.*?)(\.[^.]+)$/.exec(name);
      return m ? { stem: m[1], ext: m[2] } : { stem: name, ext: "" };
    }
    function uniqueDest(files, destPath) {
      if (!files[destPath]) return destPath;
      var dir = parent(destPath);
      var parts = splitName(base(destPath));
      var stem = parts.stem.replace(/_\d+$/, "");
      var n = 2;
      var p = dir + "\\" + stem + "_" + n + parts.ext;
      while (files[p]) { n++; p = dir + "\\" + stem + "_" + n + parts.ext; }
      return p;
    }
    function pad(n) { return String(n).padStart(2, "0"); }
    function utc(ms) {
      var d = new Date(ms);
      return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds()) + " UTC";
    }
    function runId(now, rand) {
      var d = new Date(now);
      var stamp = d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "-" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds());
      var raw = String(rand ? rand() : Math.random().toString(36).slice(2));
      var x = raw.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6);
      while (x.length < 6) x += "0";
      return stamp + "-" + x;
    }
    function pushLog(state, now, action, detail) {
      state.log.unshift({ at: now, who: state.user || "demo", action: action, detail: detail });
    }
    function skipWhy(name, meta) {
      meta = meta || {};
      if (meta.system || String(name).toLowerCase() === "desktop.ini") return "hidden or system file";
      if (meta.shortcut || /\.lnk$/i.test(name)) return "link or junction, not followed";
      return "";
    }
    function scanError(state, folder) {
      var path = norm(folder);
      if (!path) return "Type a folder path.";
      if (state.dirs.indexOf(path) < 0) return "Cannot scan: " + path + " is not in this demo (sample folder only).";
      if (unusable(path)) return "This folder cannot be used (system or program folder or drive root).";
      return "";
    }
    function checkList(text, label) {
      var errors = [];
      var seen = {};
      String(text || "").split(/\n/).forEach(function (line, i) {
        var raw = line.trim();
        if (!raw || raw.charAt(0) === "#") return;
        var eq = raw.indexOf("=");
        var at = label + " line " + (i + 1);
        if (eq < 0) { errors.push(at + " needs a name, then =, then words."); return; }
        var name = raw.slice(0, eq).trim();
        var words = raw.slice(eq + 1).split(",").map(function (w) { return w.trim(); }).filter(Boolean);
        if (!name) errors.push(at + " is missing a name.");
        else if (/[\\/:]/.test(name)) errors.push(at + " name \"" + name + "\" cannot contain \\ / or :.");
        if (!words.length) errors.push(at + " needs at least one word after =.");
        var k = name.toLowerCase();
        if (name && seen[k]) errors.push(label + " has \"" + name + "\" more than once.");
        if (name) seen[k] = 1;
      });
      return errors;
    }
    function validateRules(rules) {
      rules = rules || {};
      var errors = checkList(rules.jobs, "Jobs").concat(checkList(rules.types, "Doc types"), checkList(rules.vendors, "Vendors"));
      if (rules.dateSep != null && DATE_SEPS.indexOf(String(rules.dateSep)) < 0) errors.push("Pick a date separator from the list.");
      return errors;
    }
    function fresh(now) {
      now = now || Date.now();
      var files = {};
      (samples || []).forEach(function (f) {
        files[INBOX + "\\" + f.name] = { size: f.size, lastModified: f.lastModified };
      });
      files[INBOX + "\\desktop.ini"] = { size: 174, lastModified: now, system: true };
      files[INBOX + "\\Old Jobs (shortcut)"] = { size: 512, lastModified: now, shortcut: true };
      return {
        version: 2,
        user: "demo",
        signedIn: false,
        readonly: false,
        demoSkip: false,
        blockerPath: "",
        source: INBOX,
        dest: ORGANISED,
        subfolders: true,
        backupFolder: "",
        rules: {
          jobs: O.DEFAULT_RULES.jobs,
          types: O.DEFAULT_RULES.types,
          vendors: O.DEFAULT_RULES.vendors,
          useFileDate: true,
          dateSep: "-"
        },
        savedRulesAt: now,
        lastScanAt: 0,
        dirs: ["C:\\", "C:\\Jobs", "C:\\Jobs\\Inbox", "C:\\Jobs\\Organised", "C:\\ProgramData", "C:\\ProgramData\\GMA", "C:\\ProgramData\\GMA\\FileOrganizer", BACKUPS],
        files: files,
        plans: [],
        runs: [],
        log: [],
        nextPlan: 1
      };
    }
    function reset(state, now) {
      var n = fresh(now);
      n.signedIn = !!(state && state.signedIn);
      n.user = (state && state.user) || "demo";
      return n;
    }
    function signIn(state, user) {
      var n = clone(state);
      n.signedIn = true;
      n.user = String(user || "demo").trim() || "demo";
      return n;
    }
    function signOut(state) {
      var n = clone(state);
      n.signedIn = false;
      return n;
    }
    function setSource(state, path) { var n = clone(state); n.source = norm(path); return n; }
    function setDest(state, path) { var n = clone(state); n.dest = norm(path); return n; }
    function setSubfolders(state, on) { var n = clone(state); n.subfolders = !!on; return n; }
    function setReadonly(state, on) { var n = clone(state); n.readonly = !!on; return n; }
    function setDemoSkip(state, on) { var n = clone(state); n.demoSkip = !!on; return n; }
    function collect(state, folder, sub) {
      var list = [];
      Object.keys(state.files).forEach(function (path) {
        var direct = parent(path) === folder;
        var nested = !!sub && path.indexOf(folder + "\\") === 0 && !direct;
        if (!direct && !nested) return;
        var meta = state.files[path];
        list.push({ path: path, name: base(path), size: meta.size, lastModified: meta.lastModified, meta: meta });
      });
      return list;
    }
    function scan(state, opts) {
      opts = opts || {};
      var now = opts.now || Date.now();
      var folder = norm(opts.folder != null ? opts.folder : state.source);
      var sub = opts.subfolders != null ? !!opts.subfolders : !!state.subfolders;
      var err = scanError(state, folder);
      if (err) return { ok: false, state: state, error: err };
      var n = clone(state);
      n.source = folder;
      n.subfolders = sub;
      var skipped = [];
      var planned = [];
      collect(n, folder, sub).forEach(function (f) {
        var why = skipWhy(f.name, f.meta);
        if (why) skipped.push({ item: f.name, why: why });
        else planned.push(f);
      });
      var rules = n.rules;
      var rows = O.plan(planned.map(function (f) { return { name: f.name, size: f.size, lastModified: f.lastModified }; }), {
        jobs: rules.jobs, types: rules.types, vendors: rules.vendors
      }, { useFileDate: rules.useFileDate !== false, dateSep: rules.dateSep == null ? "-" : rules.dateSep });
      rows.forEach(function (r, i) {
        r.key = planned[i].path;
        r.lastModified = planned[i].lastModified;
        r.ticked = true;
      });
      var id = n.nextPlan || 1;
      n.nextPlan = id + 1;
      var again = n.plans.length > 0;
      n.plans.unshift({ id: id, source: folder, subfolders: sub, rows: rows, skipped: skipped, when: now, who: n.user || "demo" });
      n.lastScanAt = now;
      pushLog(n, now, again ? "rescan" : "scan", folder + ": " + rows.length + " files planned, " + skipped.length + " skipped.");
      return { ok: true, state: n, planId: id, message: "Planned " + rows.length + " files, " + skipped.length + " skipped." };
    }
    function saveRules(state, rules, now) {
      now = now || Date.now();
      var errors = validateRules(rules);
      if (errors.length) return { ok: false, state: state, error: errors.join(" "), errors: errors };
      var n = clone(state);
      n.rules = {
        jobs: String(rules.jobs || ""),
        types: String(rules.types || ""),
        vendors: String(rules.vendors || ""),
        useFileDate: !!rules.useFileDate,
        dateSep: rules.dateSep == null ? "-" : String(rules.dateSep)
      };
      n.savedRulesAt = now;
      return { ok: true, state: n, message: "Rules saved." };
    }
    function restoreExamples(state, now) {
      var n = clone(state);
      n.rules = { jobs: O.DEFAULT_RULES.jobs, types: O.DEFAULT_RULES.types, vendors: O.DEFAULT_RULES.vendors, useFileDate: true, dateSep: "-" };
      n.savedRulesAt = now || Date.now();
      return { ok: true, state: n, message: "Example rules restored." };
    }
    function checkJob(folder, words, jobsText) {
      var name = String(folder || "").trim();
      var list = String(words || "").split(",").map(function (w) { return w.trim(); }).filter(Boolean);
      if (!name) return { error: "Type a job folder name." };
      if (/[\\/:]/.test(name)) return { error: "A job folder name cannot contain \\ / or :." };
      if (!list.length) return { error: "Type the words found in its file names, separated by commas." };
      var seen = false;
      String(jobsText || "").split(/\n/).forEach(function (line) {
        var eq = line.indexOf("=");
        if (eq >= 0 && line.slice(0, eq).trim().toLowerCase() === name.toLowerCase()) seen = true;
      });
      if (seen) return { error: "Jobs has \"" + name + "\" more than once." };
      return { line: name + " = " + list.join(", ") };
    }
    function setTicks(state, planId, keys, on) {
      var n = clone(state);
      var plan = n.plans.filter(function (p) { return p.id === planId; })[0];
      if (!plan) return n;
      var flip = {};
      (keys || []).forEach(function (k) { flip[k] = 1; });
      plan.rows.forEach(function (r) { if (flip[r.key]) r.ticked = !!on; });
      return n;
    }
    function apply(state, opts) {
      opts = opts || {};
      var now = opts.now || Date.now();
      if (state.readonly) {
        var refused = clone(state);
        pushLog(refused, now, "apply refused", "Apply is turned off: read-only licence.");
        return { ok: false, state: refused, error: "Apply is turned off: read-only licence. Preview and export still work." };
      }
      var plan = state.plans.filter(function (p) { return p.id === opts.planId; })[0];
      if (!plan) return { ok: false, state: state, error: "Scan a folder before you apply." };
      var want = {};
      (opts.keys || []).forEach(function (k) { want[k] = 1; });
      var chosen = plan.rows.filter(function (r) { return want[r.key]; });
      if (!chosen.length) return { ok: false, state: state, error: "Tick at least one file to apply." };
      var intent = opts.intent === "copy" ? "copy" : "move";
      var backup = intent === "move" && opts.backup !== false;
      var dest = norm(opts.dest || state.dest || ORGANISED);
      var destErr = scanError(state, dest);
      if (destErr) return { ok: false, state: state, error: destErr };
      if (dest === norm(plan.source)) return { ok: false, state: state, error: "Pick a destination folder that is not the folder you scanned." };
      var n = clone(state);
      var id = runId(now, opts.rand);
      var backupRoot = n.backupFolder || BACKUPS;
      var filesOut = [];
      var records = [{ op: "run", id: id, at: new Date(now).toISOString(), intent: intent, from: plan.source, to: dest, backup: backup, who: n.user || "demo" }];
      var forced = !!n.demoSkip;
      var forcedUsed = false;
      var done = 0;
      var skippedN = 0;
      chosen.forEach(function (row) {
        var step = filesOut.length + 1;
        var planned = dest + "\\" + String(row.folder || "").replace(/\//g, "\\") + "\\" + row.newName;
        var src = n.files[row.key];
        function skip(reason) {
          skippedN++;
          records.push({ op: "intent", from: row.key, to: planned, name: row.original });
          records.push({ op: "skip", from: row.key, to: planned, reason: reason });
          filesOut.push({ step: step, result: "skipped", from: row.key, to: planned, note: reason, name: row.original, size: row.size, lastModified: row.lastModified });
        }
        if (forced && !forcedUsed) { forcedUsed = true; skip("changed since the preview"); return; }
        if (!src || src.size !== row.size || src.lastModified !== row.lastModified) { skip("changed since the preview"); return; }
        var destPath = uniqueDest(n.files, planned);
        var note = destPath === planned ? "" : "That name was taken. A numbered suffix was added so nothing was overwritten.";
        if (intent === "move") delete n.files[row.key];
        n.files[destPath] = { size: src.size, lastModified: src.lastModified };
        ensureDir(n, parent(destPath));
        var bpath = "";
        if (backup) {
          bpath = uniqueDest(n.files, backupRoot + "\\" + id + "\\" + row.original);
          n.files[bpath] = { size: src.size, lastModified: src.lastModified, backup: true };
          ensureDir(n, parent(bpath));
        }
        records.push({ op: "intent", from: row.key, to: destPath, name: row.original });
        records.push({ op: "done", from: row.key, to: destPath, backup: bpath });
        done++;
        filesOut.push({ step: step, result: "done", from: row.key, to: destPath, note: note, name: row.original, size: row.size, lastModified: row.lastModified });
      });
      records.push({ op: "end", state: "applied" });
      n.runs.unshift({
        id: id, intent: intent, from: plan.source, to: dest, backup: backup, backupRoot: backup ? backupRoot : "",
        when: now, who: n.user || "demo", state: "applied", records: records, damaged: [], files: filesOut, done: done, skipped: skippedN
      });
      var verb = intent === "copy" ? "Copied" : "Moved";
      pushLog(n, now, "apply", "Run " + id + ": " + verb.toLowerCase() + " " + done + ", skipped " + skippedN + ".");
      return { ok: true, state: n, runId: id, message: verb + " " + done + " files, " + skippedN + " skipped." };
    }
    function undo(state, runIdWanted, now) {
      now = now || Date.now();
      var n = clone(state);
      var run = n.runs.filter(function (r) { return r.id === runIdWanted; })[0];
      if (!run) return { ok: false, state: state, error: "That run is not in this demo." };
      if (run.state === "undone") {
        pushLog(n, now, "undo refused", "Run " + run.id + " was already undone.");
        return { ok: false, state: n, error: "This run was undone." };
      }
      var retry = run.state === "partially_undone";
      var targets = run.files.filter(function (f) { return f.result === (retry ? "left" : "done"); });
      targets.forEach(function (file) {
        if (run.intent === "copy") {
          if (!n.files[file.to]) { file.result = "left"; file.note = "organised file is no longer there"; return; }
          var rel = file.to.indexOf(run.to + "\\") === 0 ? file.to.slice(run.to.length + 1) : base(file.to);
          var aside = uniqueDest(n.files, run.to + "\\_Undone " + run.id + "\\" + rel);
          var meta = n.files[file.to];
          delete n.files[file.to];
          n.files[aside] = meta;
          ensureDir(n, parent(aside));
          file.result = "restored";
          file.note = "Set aside in _Undone " + run.id;
          file.to = aside;
          return;
        }
        if (n.files[file.from]) { file.result = "left"; file.note = "original path already has a file"; return; }
        if (!n.files[file.to]) { file.result = "left"; file.note = "organised file is no longer there"; return; }
        delete n.files[file.to];
        n.files[file.from] = { size: file.size, lastModified: file.lastModified };
        ensureDir(n, parent(file.from));
        file.result = "restored";
        file.note = "";
      });
      var left = run.files.filter(function (f) { return f.result === "left"; }).length;
      var restored = run.files.filter(function (f) { return f.result === "restored"; }).length;
      run.state = left ? "partially_undone" : "undone";
      run.records.push({ op: "undo", at: new Date(now).toISOString(), state: run.state, restored: restored, left: left });
      run.records.push({ op: "end", state: run.state });
      pushLog(n, now, left ? "undo partial" : "undo", "Run " + run.id + ": " + restored + " restored, " + left + " left.");
      return { ok: true, state: n, message: "Undo finished: " + restored + " restored, " + left + " left in place." };
    }
    function saveBackup(state, folder, now) {
      now = now || Date.now();
      var raw = String(folder || "").trim();
      if (!raw) {
        var cleared = clone(state);
        cleared.backupFolder = "";
        pushLog(cleared, now, "settings", "Backup folder set to the default.");
        return { ok: true, state: cleared, message: "Backup folder saved." };
      }
      var p = norm(raw);
      if (!/^C:\\/.test(p) || unusable(p) || p === INBOX) {
        return { ok: false, state: state, error: "Type a folder on C:\\ that is not a system folder, or leave it empty for the default." };
      }
      var n = clone(state);
      n.backupFolder = p;
      ensureDir(n, p);
      pushLog(n, now, "settings", "Backup folder set to " + p + ".");
      return { ok: true, state: n, message: "Backup folder saved." };
    }
    function addNames(state, list, now) {
      now = now || Date.now();
      var n = clone(state);
      var added = 0;
      (list || []).forEach(function (f) {
        var name = String((f && f.name) || "").split(/[/\\]/).pop().trim();
        if (!name || name === "." || name === "..") return;
        var path = uniqueDest(n.files, INBOX + "\\" + name);
        n.files[path] = { size: Number(f.size) || 0, lastModified: Number(f.lastModified) || now, added: true };
        ensureDir(n, parent(path));
        added++;
      });
      return { ok: true, state: n, added: added, message: added ? "Added " + added + " file name(s) to the sample inbox. Contents were not read." : "No file names to add." };
    }
    function setBlocker(state, on, now) {
      now = now || Date.now();
      var n = clone(state);
      if (!on) {
        if (n.blockerPath && n.files[n.blockerPath] && n.files[n.blockerPath].planted) delete n.files[n.blockerPath];
        n.blockerPath = "";
        return { ok: true, state: n, message: "Removed the sample file that was sitting on the original name." };
      }
      if (n.blockerPath && n.files[n.blockerPath] && n.files[n.blockerPath].planted) {
        return { ok: true, state: n, message: "A sample file is already sitting on an original name." };
      }
      var run = n.runs.filter(function (r) { return r.intent === "move" && r.files.some(function (f) { return f.result === "done" && !n.files[f.from]; }); })[0];
      if (!run) return { ok: false, state: state, error: "Move a plan first. This puts a sample file on an original name so Undo has to leave one behind." };
      var file = run.files.filter(function (f) { return f.result === "done" && !n.files[f.from]; })[0];
      n.files[file.from] = { size: 1, lastModified: now, planted: true };
      ensureDir(n, parent(file.from));
      n.blockerPath = file.from;
      return { ok: true, state: n, message: "A sample file now sits at the original name. Undo will leave that one behind until you remove it and retry." };
    }
    function logExport(state, planId, now) {
      var n = clone(state);
      pushLog(n, now || Date.now(), "export", "Plan " + planId + " CSV.");
      return n;
    }
    function cell(v) {
      v = String(v == null ? "" : v);
      if (/^[=+\-@]/.test(v)) v = "'" + v;
      return /[",\r\n]/.test(v) ? "\"" + v.replace(/"/g, "\"\"") + "\"" : v;
    }
    function planCsv(plan) {
      var head = ["original_name", "new_name", "folder", "new_path", "status", "job", "type", "vendor", "date", "date_source", "flags"];
      var lines = [head.join(",")];
      (plan.rows || []).forEach(function (r) {
        lines.push([r.original, r.newName, r.folder, r.path, r.status, r.job, r.type, r.vendor, r.date, r.dateSource, (r.flags || []).join("; ")].map(cell).join(","));
      });
      return { filename: "file-organizer-plan-" + plan.id + ".csv", text: "\uFEFF" + lines.join("\r\n") + "\r\n" };
    }
    function undoDownload(run) {
      return {
        filename: "file-organizer-undo-" + run.id + ".json",
        text: JSON.stringify({ run: run.id, records: run.records, damaged_lines: run.damaged || [] }, null, 2)
      };
    }
    function kpis(state) {
      var organised = 0;
      state.runs.forEach(function (run) {
        if (run.state === "undone") return;
        run.files.forEach(function (f) { if (f.result === "done" || f.result === "left") organised++; });
      });
      var plan = state.plans[0];
      if (!plan) return { scanned: null, ok: null, check: null, review: null, duplicate: null, organised: organised };
      var c = { ok: 0, check: 0, review: 0, duplicate: 0 };
      plan.rows.forEach(function (r) { if (c[r.status] != null) c[r.status]++; });
      return { scanned: plan.rows.length + plan.skipped.length, ok: c.ok, check: c.check, review: c.review, duplicate: c.duplicate, organised: organised };
    }
    function ruleCounts(rules) {
      return { jobs: O.parseRules(rules.jobs).length, types: O.parseRules(rules.types).length, vendors: O.parseRules(rules.vendors).length };
    }
    function isExampleJobs(rules) {
      return String((rules && rules.jobs) || "").trim() === String(O.DEFAULT_RULES.jobs).trim();
    }
    function listDir(state, raw) {
      var path = norm(raw || "C:\\");
      if (state.dirs.indexOf(path) < 0) {
        return { path: path, missing: true, dirs: [], fileCount: 0, usable: false, reason: "Cannot scan: " + path + " is not in this demo (sample folder only)." };
      }
      var dirs = state.dirs.filter(function (d) { return parent(d) === path; }).sort();
      var fileCount = Object.keys(state.files).filter(function (f) { return parent(f) === path; }).length;
      var okPath = !unusable(path);
      return {
        path: path, missing: false, dirs: dirs, fileCount: fileCount, usable: okPath,
        reason: okPath ? "" : "This folder cannot be used (system or program folder or drive root)."
      };
    }
    function plant(state, path, meta) {
      var n = clone(state);
      var p = norm(path);
      n.files[p] = meta || { size: 1, lastModified: 1 };
      ensureDir(n, parent(p));
      return n;
    }
    function fileCount(state) { return Object.keys(state.files).length; }

    return {
      VERSION: VERSION, INBOX: INBOX, ORGANISED: ORGANISED, DATA: DATA, BACKUPS: BACKUPS, DATE_SEPS: DATE_SEPS,
      fresh: fresh, reset: reset, signIn: signIn, signOut: signOut,
      setSource: setSource, setDest: setDest, setSubfolders: setSubfolders, setReadonly: setReadonly, setDemoSkip: setDemoSkip,
      scan: scan, saveRules: saveRules, restoreExamples: restoreExamples, validateRules: validateRules, checkJob: checkJob,
      setTicks: setTicks, apply: apply, undo: undo, saveBackup: saveBackup, addNames: addNames, setBlocker: setBlocker,
      logExport: logExport, planCsv: planCsv, undoDownload: undoDownload, kpis: kpis, ruleCounts: ruleCounts,
      isExampleJobs: isExampleJobs, listDir: listDir, parent: parent, base: base, norm: norm, utc: utc,
      plant: plant, fileCount: fileCount
    };
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { build: build };
  else if (root && root.GMAOrganizer && root.GMAOrganizerSamples) root.GMAOrganizerSim = build(root.GMAOrganizer, root.GMAOrganizerSamples);
  else if (root) root.GMAOrganizerSimError = "Load organizer.js and samples.js before sim.js.";
})(typeof window !== "undefined" ? window : this);
