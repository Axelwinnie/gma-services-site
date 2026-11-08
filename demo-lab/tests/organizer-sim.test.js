// node demo-lab/tests/organizer-sim.test.js
const O = require("../public/demos/organizer/organizer.js");
global.window = {};
require("../public/demos/organizer/samples.js");
const S = window.GMAOrganizerSamples;
const sim = require("../public/demos/organizer/sim.js").build(O, S);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } };
const T = Date.UTC(2026, 10, 8, 1, 48, 0);

function scanned() {
  let s = sim.signIn(sim.fresh(T), "demo");
  const r = sim.scan(s, { now: T });
  ok(r.ok, r.error);
  return r.state;
}

const shop = scanned();
const plan = shop.plans[0];
const direct = O.plan(S, O.DEFAULT_RULES, { useFileDate: true, dateSep: "-" });
ok(plan.rows.length === 17, "17 planned, got " + plan.rows.length);
ok(plan.skipped.length === 2, "2 skipped");
ok(plan.skipped.map((x) => x.why).sort().join("|") === "hidden or system file|link or junction, not followed", "skip reasons " + JSON.stringify(plan.skipped));
plan.rows.forEach((r, i) => {
  ["newName", "folder", "status", "job", "type", "vendor", "date", "dateSource"].forEach((k) => {
    ok(r[k] === direct[i][k], k + " " + r.original + " " + r[k] + " vs " + direct[i][k]);
  });
});
ok(plan.rows[0].newName === "2026-09-18_J2041-PineHollow_Invoice_NorthfieldSteel.pdf", plan.rows[0].newName);

const keys = plan.rows.map((r) => r.key);
const moved = sim.apply(shop, { planId: plan.id, keys, intent: "move", backup: true, dest: sim.ORGANISED, now: T, rand: () => "abc123" });
ok(moved.ok, moved.error);
ok(moved.message === "Moved 17 files, 0 skipped.", moved.message);
const run = moved.state.runs[0];
ok(run.state === "applied", run.state);
ok(run.files.every((f) => f.result === "done"), "all done");
ok(!moved.state.files[run.files[0].from], "inbox original gone");
ok(moved.state.files[run.files[0].to], "dest written");
ok(moved.state.files[run.files[0].to].size === plan.rows[0].size, "size kept");
const backupPath = Object.keys(moved.state.files).find((p) => p.indexOf("\\backups\\" + run.id + "\\") > 0);
ok(!!backupPath, "backup copy written");
ok(sim.fileCount(moved.state) === sim.fileCount(shop) + 17, "move keeps the file and adds a backup, count " + sim.fileCount(moved.state));

const undone = sim.undo(moved.state, run.id, T + 1000);
ok(undone.ok && undone.state.runs[0].state === "undone", undone.error || undone.state.runs[0].state);
ok(undone.message === "Undo finished: 17 restored, 0 left in place.", undone.message);
ok(undone.state.files[run.files[0].from], "restored to inbox");
ok(!undone.state.files[run.files[0].to], "dest cleared by undo");
ok(undone.state.files[backupPath], "undo does not delete the backup");
ok(sim.kpis(undone.state).organised === 0, "organised kpi clears");

const again = sim.undo(undone.state, run.id, T + 2000);
ok(!again.ok && again.state.log[0].action === "undo refused", again.error);

let partial = sim.apply(scanned(), { planId: 1, keys, intent: "move", backup: false, dest: sim.ORGANISED, now: T, rand: () => "zzzzzz" });
partial = sim.setBlocker(partial.state, true, T + 50);
ok(partial.ok, partial.error);
partial = sim.undo(partial.state, partial.state.runs[0].id, T + 100);
ok(partial.state.runs[0].state === "partially_undone", partial.state.runs[0].state);
ok(partial.state.runs[0].files.filter((f) => f.result === "left").length === 1, "one left");
ok(partial.state.log[0].action === "undo partial", partial.state.log[0].action);
partial = sim.setBlocker(partial.state, false, T + 150);
partial = sim.undo(partial.state, partial.state.runs[0].id, T + 200);
ok(partial.state.runs[0].state === "undone", "retry -> " + partial.state.runs[0].state);
ok(partial.state.runs[0].files.every((f) => f.result === "restored"), "retry restored all");

let skip = scanned();
skip = sim.setDemoSkip(skip, true);
skip = sim.apply(skip, { planId: 1, keys, intent: "move", backup: false, dest: sim.ORGANISED, now: T, rand: () => "skipme" });
ok(skip.state.runs[0].skipped === 1 && skip.state.runs[0].done === 16, "scripted skip " + skip.state.runs[0].done + "/" + skip.state.runs[0].skipped);
ok(skip.state.runs[0].files[0].note === "changed since the preview", skip.state.runs[0].files[0].note);
ok(skip.state.files[keys[0]], "skipped file stayed in the inbox");

let copied = sim.apply(scanned(), { planId: 1, keys, intent: "copy", backup: true, dest: sim.ORGANISED, now: T, rand: () => "copy01" });
ok(copied.state.runs[0].backup === false, "copy turns backup off");
ok(copied.state.files[keys[0]], "copy leaves the inbox file");
ok(!Object.keys(copied.state.files).some((p) => p.indexOf("\\backups\\") > 0 && p.indexOf("copy01") > 0), "copy writes no backup");
const firstTo = copied.state.runs[0].files[0].to;
let copied2 = sim.apply(copied.state, { planId: 1, keys: [keys[0]], intent: "copy", backup: false, dest: sim.ORGANISED, now: T + 5, rand: () => "copy02" });
const secondTo = copied2.state.runs[0].files[0].to;
ok(firstTo !== secondTo && /_2\.pdf$/i.test(secondTo), "no overwrite " + secondTo);
ok(copied2.state.files[firstTo] && copied2.state.files[secondTo], "both copies kept");
const aside = sim.undo(copied.state, copied.state.runs[0].id, T + 9);
ok(aside.state.runs[0].state === "undone", aside.error);
ok(aside.state.files[keys[0]], "original still in inbox after copy undo");
ok(aside.state.runs[0].files.every((f) => f.to.indexOf("\\_Undone ") > 0), "copies set aside");
ok(!aside.state.files[firstTo], "organised copy removed to the aside folder");

const ro = sim.setReadonly(scanned(), true);
const refused = sim.apply(ro, { planId: 1, keys, intent: "move", backup: true, dest: sim.ORGANISED, now: T });
ok(!refused.ok && refused.state.log[0].action === "apply refused", refused.error);
ok(sim.fileCount(refused.state) === sim.fileCount(ro), "read-only apply writes nothing");

const bad = sim.scan(sim.fresh(T), { folder: "C:\\Other", now: T });
ok(!bad.ok && bad.error.indexOf("not in this demo") > 0, bad.error);
const root = sim.scan(sim.fresh(T), { folder: "C:\\", now: T });
ok(!root.ok && root.error.indexOf("cannot be used") > 0, root.error);

let rules = sim.fresh(T);
const badRules = sim.saveRules(rules, { jobs: "Nope", types: "Invoice = inv", vendors: "A = a", useFileDate: true, dateSep: "-" }, T);
ok(!badRules.ok && /needs a name/.test(badRules.error), badRules.error);
rules = sim.saveRules(rules, Object.assign({}, rules.rules, { dateSep: "" }), T).state;
rules = sim.scan(rules, { now: T }).state;
ok(rules.plans[0].rows[0].newName.indexOf("20260918_") === 0, rules.plans[0].rows[0].newName);
rules = sim.saveRules(rules, Object.assign({}, rules.rules, { useFileDate: false, dateSep: "-" }), T).state;
rules = sim.scan(rules, { now: T }).state;
const po = rules.plans[0].rows.find((r) => r.original === "PO 5521 pinehollow Northfield.pdf");
ok(po.status === "review", "file date off -> " + po.status);

let nested = sim.plant(sim.fresh(T), "C:\\Jobs\\Inbox\\extra\\note.pdf", { size: 20, lastModified: T });
ok(sim.scan(nested, { subfolders: false, now: T }).state.plans[0].rows.length === 17, "subfolders off ignores nested");
ok(sim.scan(nested, { subfolders: true, now: T }).state.plans[0].rows.length === 18, "subfolders on includes nested");

const csv = sim.planCsv({ id: 7, rows: [{ original: "=cmd", newName: "+x", folder: "-f", path: "@p", status: "ok", job: "", type: "", vendor: "", date: "", dateSource: "", flags: ["a", "b"] }] });
ok(csv.filename === "file-organizer-plan-7.csv", csv.filename);
ok(csv.text.charCodeAt(0) === 0xFEFF, "bom");
ok(csv.text.indexOf("original_name,new_name,folder,new_path,status,job,type,vendor,date,date_source,flags") > 0, "header");
ok(csv.text.indexOf("'=cmd") > 0 && csv.text.indexOf("'+x") > 0 && csv.text.indexOf("'-f") > 0 && csv.text.indexOf("'@p") > 0, "formula safe");
ok(csv.text.indexOf("a; b") > 0, "flags");

const added = sim.addNames(sim.fresh(T), [{ name: "C:\\secret\\quote.pdf", size: 4, lastModified: T }], T);
ok(added.added === 1 && added.state.files["C:\\Jobs\\Inbox\\quote.pdf"], "names only, basename");
ok(!added.state.files["C:\\secret\\quote.pdf"], "does not create the typed path");

const wiped = sim.reset(moved.state, T + 5);
ok(wiped.signedIn && wiped.runs.length === 0 && wiped.plans.length === 0, "reset restores the shop and keeps the sign-in");
ok(sim.fileCount(wiped) === 19, "sample pile restored " + sim.fileCount(wiped));
ok(sim.isExampleJobs(wiped.rules), "example jobs");

const log = sim.undoDownload(moved.state.runs[0]);
const parsed = JSON.parse(log.text);
ok(parsed.run === moved.state.runs[0].id && parsed.records[0].op === "run" && Array.isArray(parsed.damaged_lines), "undo log shape");

console.log(fail ? fail + " FAILED" : "ALL PASS");
process.exit(fail ? 1 : 0);
