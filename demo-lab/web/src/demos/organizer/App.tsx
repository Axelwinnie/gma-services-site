/* GMA File Organizer demo: the real program's screens (v0.1.1 templates) driven by a pretend C:\ drive that lives
   only in this browser. The sorting engine is the shared organizer.js (the same algorithm as the real engine.py).
   Nothing on the visitor's computer is read, moved or changed. Sources of every label: file_organizer/templates/*. */
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Rules = { jobs: string; types: string; vendors: string; useFileDate: boolean; dateSep: string };
type VFile = { size: number; lastModified: number };
type Row = any;
type Plan = { id: number; created_utc: string; username: string; source: string; recursive: boolean; rows: Row[]; skipped: { rel: string; reason: string }[] };
type Rec = Record<string, any>;
type Run = { id: string; plan_id: number; created_utc: string; username: string; mode: "move" | "copy"; source: string; dest: string; backup: string | null; done: number; skipped: number; state: string; journal: string; records: Rec[] };
type Line = { ts_utc: string; username: string; action: string; detail: string };
type Flash = [string, string];
type CtxT = { s: State; setS: (f: (x: State) => State) => void; route: { path: string; q: URLSearchParams }; go: (to: string, flashes?: Flash[], mut?: (x: State) => State) => void;
  log: (x: State, action: string, detail: string) => State; scan: (src: string, rec: boolean, from?: number) => void;
  apply: (plan: Plan, accepted: number[], dest: string, mode: string, backup: boolean) => void; undo: (run: Run) => void };
const Ctx = createContext<CtxT>(null!);
type State = { rules: Rules; fs: Record<string, VFile>; dirs: string[]; plans: Plan[]; runs: Run[]; activity: Line[]; backupDir: string; flashes: Flash[] };

const O = window.GMAOrganizer, SAMPLES = window.GMAOrganizerSamples as { name: string; size: number; lastModified: number }[];
const VERSION = "0.1.1", USER = "demo", KEY = "gma-demo:organizer-v2";
const INBOX = "C:\\Jobs\\Inbox", OUT = "C:\\Jobs\\Organised";
const DATA_DIR = "C:\\ProgramData\\GMA\\FileOrganizer", DEFAULT_BACKUP = DATA_DIR + "\\backups";
const STATUS_LABELS: Record<string, string> = { ok: "ok", check: "check", review: "needs review", duplicate: "duplicate" };
const SEPARATORS = ["-", "", ".", "_", " "];
const CSV_HEAD = ["original_name", "new_name", "folder", "new_path", "status", "job", "type", "vendor", "date", "date_source", "flags"];
// Items the real scanner reports as skipped (scanner.py:52-63): a hidden system file and a folder junction.
const HIDDEN = { "desktop.ini": "hidden or system file" } as Record<string, string>;
const JUNCTIONS = { "Old Jobs": "link or junction, not followed" } as Record<string, string>;

const fresh = (): State => {
  const fs: Record<string, VFile> = {};
  SAMPLES.forEach((f) => { fs[INBOX + "\\" + f.name] = { size: f.size, lastModified: f.lastModified }; });
  return { rules: { ...O.DEFAULT_RULES, useFileDate: true, dateSep: "-" }, fs, dirs: ["C:\\", "C:\\Jobs", INBOX, OUT, DATA_DIR, DEFAULT_BACKUP],
    plans: [], runs: [], activity: [], backupDir: "", flashes: [] };
};
const load = (): State => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch { /* fresh */ } return fresh(); };
const nowText = () => new Date().toISOString().slice(0, 19) + "Z";
const dash = (v: unknown): ReactNode => (v === null || v === undefined || v === "" ? "\u2014" : (v as ReactNode));
const lower = (p: string) => p.toLowerCase().replace(/\\+$/, "");
const inside = (child: string, parent: string) => { const c = lower(child), p = lower(parent); return c === p || c.startsWith(p + "\\"); };
const dirname = (p: string) => { const i = p.lastIndexOf("\\"); const d = p.slice(0, i); return /^[A-Za-z]:$/.test(d) ? d + "\\" : d; };
const join = (a: string, b: string) => (a.endsWith("\\") ? a + b : a + "\\" + b);
const breakable = (s: string): ReactNode => {
  const parts = String(s).split(/(?<=[\\/])|(?<=[A-Za-z0-9][-_.])(?=[A-Za-z0-9])/);
  return parts.map((x, i) => <span key={i}>{x}{i < parts.length - 1 && <wbr />}</span>);
};
class Refused extends Error {}
function normalise(text: string) {
  const raw = (text || "").trim().replace(/^"|"$/g, "").trim();
  if (!raw) throw new Refused("no folder was given");
  if (raw.startsWith("\\\\") || raw.startsWith("//")) throw new Refused("network folders are not supported; choose a folder on this PC");
  if (!/^[A-Za-z]:[\\/]/.test(raw)) throw new Refused("give the full folder path, for example C:\\Jobs\\Inbox");
  const drive = raw.slice(0, 2).toUpperCase();
  const parts: string[] = [];
  raw.slice(3).split(/[\\/]+/).forEach((p) => { if (p === "..") parts.pop(); else if (p && p !== ".") parts.push(p); });
  if (drive !== "C:") throw new Refused(drive + " is not a local drive (network, CD or unknown drive)");
  return parts.length ? drive + "\\" + parts.join("\\") : drive + "\\";
}
function systemReason(path: string) {
  if (/^[A-Za-z]:\\$/.test(path)) return "a whole drive (" + path + ") cannot be organised; choose a folder on it";
  for (const f of ["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)", "C:\\ProgramData", DATA_DIR]) if (inside(path, f)) return f + " is a system or program folder";
  if (lower(path) === "c:\\users") return "C:\\Users is a system folder; choose a folder inside it";
  return null;
}
const dirExists = (s: State, p: string) => s.dirs.some((d) => lower(d) === lower(p));
// Folders the Browse page shows: real, not hidden (ProgramData is hidden on Windows; junctions are never listed).
const subfolders = (s: State, p: string) => s.dirs.filter((d) => d !== p && lower(dirname(d)) === lower(p) && !inside(d, "C:\\ProgramData")).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
const filesIn = (s: State, folder: string) => Object.keys(s.fs).filter((k) => lower(dirname(k)) === lower(folder));
const order = (name: string) => { const n = name.toLowerCase(), i = n.lastIndexOf("."); return i > 0 ? [n.slice(0, i), n.slice(i)] : [n, ""]; };
const ruleKeyProblem = (key: string) => {
  if (/[<>:"/\\|?*\x00-\x1f]/.test(key)) return 'it holds one of  < > : " / \\ | ? *  or a control character';
  if (key === "." || key === ".." || key.replace(/[ .]+$/, "") !== key) return "it ends with a dot or a space";
  if (key.length > 80) return "it is longer than 80 characters";
  return null;
};
function ruleErrors(r: Rules) {
  const errors: string[] = [];
  if (!SEPARATORS.includes(r.dateSep)) errors.push("Choose one of the offered date separators.");
  ([["jobs", "Jobs"], ["types", "Doc types"], ["vendors", "Vendors"]] as const).forEach(([k, label]) => O.parseRules(r[k]).forEach((rule: any) => {
    const p = ruleKeyProblem(rule.key); if (p) errors.push(`${label}: '${rule.key}' cannot be a folder name because ${p}.`);
  }));
  if (!O.parseRules(r.jobs).length || !O.parseRules(r.types).length) errors.push("Give at least one job and one doc type (Name = word, word).");
  return errors;
}
const hasOwnJobRule = (r: Rules) => {
  const starter = new Set(O.parseRules(O.DEFAULT_RULES.jobs).map((x: any) => x.key + "|" + x.words.join(",")));
  return O.parseRules(r.jobs).some((x: any) => !starter.has(x.key + "|" + x.words.join(",")));
};
function download(data: BlobPart, type: string, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
const csvCell = (v: unknown) => { let t = v == null ? "" : String(v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
function undoState(records: Rec[]) {
  let st: string | null = null;
  for (const r of records) { if (r.type === "undo_end" && !r.left) return "undone"; if (r.type === "undo_partial" || r.type === "undo_end") st = "partially_undone"; }
  return st;
}

/* ---------------------------------------------------------------- routing (hash) */
function useRoute() {
  const get = () => { const h = location.hash.replace(/^#/, "") || "/"; const [path, q = ""] = h.split("?"); return { path, q: new URLSearchParams(q) }; };
  const [r, setR] = useState(get);
  useEffect(() => { const f = () => { setR(get()); window.scrollTo(0, 0); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}
const href = (path: string, q?: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams(); Object.entries(q || {}).forEach(([k, v]) => { if (v !== undefined && v !== "") p.set(k, String(v)); });
  const s = p.toString(); return "#" + path + (s ? "?" + s : "");
};

export default function App() {
  const [s, setS] = useState<State>(load);
  const route = useRoute();
  const [shown, setShown] = useState<Flash[]>([]);
  const [nonce, setNonce] = useState(0);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* full */ } }, [s]);
  // Flash messages show once on the next page, like Flask's flash().
  useEffect(() => { if (s.flashes.length) { setShown(s.flashes); setS((x) => ({ ...x, flashes: [] })); } else setShown([]); }, [route.path, route.q.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.title = (titleFor(route.path)) + " - GMA File Organizer"; }, [route.path]);

  const go = (to: string, flashes: Flash[] = [], mut?: (x: State) => State) => {
    // Same page again (a redirect to itself in the real program): reload it in place and show its flashes now.
    if (location.hash === to) { if (mut) setS(mut); setShown(flashes); setNonce((n) => n + 1); window.scrollTo(0, 0); return; }
    setS((x) => { const y = mut ? mut(x) : x; return { ...y, flashes: [...y.flashes, ...flashes] }; });
    location.hash = to;
  };
  const log = (x: State, action: string, detail: string): State => ({ ...x, activity: [{ ts_utc: nowText(), username: USER, action, detail }, ...x.activity] });

  /* ---- actions (each mirrors the real view function named in the comment) */
  function scan(sourceText: string, recursive: boolean, from?: number) { // views.scan / views.replan
    let source: string;
    try {
      source = normalise(sourceText);
      const why = systemReason(source); if (why) throw new Refused(why);
      if (!dirExists(s, source)) throw new Refused("the folder " + source + " does not exist");
    } catch (e: any) {
      if (from) return go(href("/plan/" + from), [["error", "Cannot scan again: " + e.message + "."]]);
      return go(href("/", { source: sourceText }), [["error", "Cannot scan: " + e.message + "."]]);
    }
    const names: { rel: string; name: string; size: number; lastModified: number }[] = [];
    const skipped: { rel: string; reason: string }[] = [];
    const walk = (folder: string, rel: string) => {
      const entries = [...filesIn(s, folder).map((k) => ({ k, dir: false })), ...subfolders(s, folder).map((k) => ({ k, dir: true }))];
      const extra = lower(folder) === lower(INBOX) ? [...Object.keys(HIDDEN), ...Object.keys(JUNCTIONS)].map((n) => ({ k: join(folder, n), dir: n in JUNCTIONS })) : [];
      [...entries, ...extra].sort((a, b) => { const x = order(a.k.slice(a.k.lastIndexOf("\\") + 1)), y = order(b.k.slice(b.k.lastIndexOf("\\") + 1)); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0; })
        .forEach(({ k, dir }) => {
          const name = k.slice(k.lastIndexOf("\\") + 1), r = rel ? rel + "\\" + name : name;
          if (JUNCTIONS[name] && lower(folder) === lower(INBOX)) return skipped.push({ rel: r, reason: JUNCTIONS[name] });
          if (dir) { if (recursive) walk(k, r); return; }
          if (HIDDEN[name] && lower(folder) === lower(INBOX)) return skipped.push({ rel: r, reason: HIDDEN[name] });
          names.push({ rel: r, name, size: s.fs[k].size, lastModified: s.fs[k].lastModified });
        });
    };
    walk(source, "");
    const rows = O.plan(names, s.rules, { useFileDate: s.rules.useFileDate, dateSep: s.rules.dateSep }).map((row: Row, i: number) => ({ ...row, i, rel: names[i].rel, name: names[i].name, lastModified: names[i].lastModified }));
    const id = (s.plans[0]?.id || 0) + 1;
    const plan: Plan = { id, created_utc: nowText(), username: USER, source, recursive, rows, skipped };
    go(href("/plan/" + id), [], (x) => log({ ...x, plans: [plan, ...x.plans] }, from ? "rescan" : "scan",
      from ? `${source}: plan ${from} replaced by plan ${id}` : `${source}: ${rows.length} files planned, ${skipped.length} skipped${recursive ? " (with subfolders)" : ""}`));
  }

  function apply(plan: Plan, accepted: number[], destText: string, mode: string, backupOn: boolean) { // views.apply + applier.apply_plan
    if (mode !== "move" && mode !== "copy") return go(href("/plan/" + plan.id), [["error", "Choose Move or Copy."]]);
    if (!accepted.length) return go(href("/plan/" + plan.id, { dest: destText }), [["error", "No files are ticked, so nothing was changed."]]);
    let dest: string, backup: string | null = null;
    try {
      dest = normalise(destText);
      const why = systemReason(dest); if (why) throw new Refused(why);
      if (inside(dest, plan.source)) throw new Refused("the destination may not be the source folder or inside it");
      if (mode === "move" && backupOn) { backup = s.backupDir || DEFAULT_BACKUP; if (inside(backup, plan.source)) throw new Refused("the backup folder may not be inside the source folder"); }
    } catch (e: any) { return go(href("/plan/" + plan.id, { dest: destText }), [["error", "Cannot apply: " + e.message + "."]]); }
    const d = new Date(), p2 = (n: number) => String(n).padStart(2, "0");
    const runId = `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}-${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}-` + Math.random().toString(16).slice(2, 8).padEnd(6, "0");
    const fs = { ...s.fs }, dirs = [...s.dirs], records: Rec[] = [];
    const mkdirs = (base: string, parts: string[]) => {
      let cur = base; const chain: string[] = [];
      for (let c = base; !dirs.some((x) => lower(x) === lower(c)); c = dirname(c)) chain.unshift(c);
      parts.forEach((p) => { cur = join(cur, p); chain.push(cur); });
      chain.forEach((c) => { if (!dirs.some((x) => lower(x) === lower(c))) { dirs.push(c); records.push({ type: "mkdir", path: c }); } });
      return parts.length ? cur : base;
    };
    const free = (folder: string, name: string) => { const i = name.lastIndexOf("."), stem = i > 0 ? name.slice(0, i) : name, ext = i > 0 ? name.slice(i) : ""; let c = name, n = 1; while (fs[join(folder, c)]) { n++; c = `${stem}_${n}${ext}`; } return c; };
    records.push({ type: "run", run_id: runId, mode, source: plan.source, dest, backup: mode === "move" ? backup : null, started_utc: nowText() });
    mkdirs(dest, []); if (backup) mkdirs(join(backup, runId), []);
    let done = 0, skipped = 0;
    [...new Set(accepted)].sort((a, b) => a - b).forEach((i) => {
      const row = plan.rows[i], src = join(plan.source, row.rel), f = fs[src];
      const problem = !f ? "no longer there" : f.size !== row.size || f.lastModified !== row.lastModified ? "changed since the preview" : null;
      if (problem) { records.push({ type: "skip", i, src, reason: problem }); skipped++; return; }
      const folder = mkdirs(dest, String(row.folder).split("/").filter(Boolean)), target = join(folder, free(folder, row.newName));
      let bk: string | null = null;
      if (mode === "move" && backup) { const bf = mkdirs(join(backup, runId), row.rel.split("\\").slice(0, -1)); bk = join(bf, free(bf, row.name)); fs[bk] = { ...f }; records.push({ type: "backup", src, copy: bk }); }
      records.push({ type: "intent", i, op: mode, src, dst: target, backup: bk, src_size: row.size, src_mtime_ns: row.lastModified * 1e6 });
      fs[target] = { ...f }; if (mode === "move") delete fs[src];
      records.push({ type: "done", i, op: mode, src, dst: target, backup: bk, size: f.size, mtime_ns: f.lastModified * 1e6, sha256: mode === "copy" ? "(demo: sample files have no contents)" : null });
      done++;
    });
    records.push({ type: "end", finished_utc: nowText(), done, skipped });
    const run: Run = { id: runId, plan_id: plan.id, created_utc: nowText(), username: USER, mode: mode as Run["mode"], source: plan.source, dest, backup, done, skipped, state: "applied", journal: DATA_DIR + "\\runs\\" + runId + ".jsonl", records };
    go(href("/runs/" + runId), [], (x) => log({ ...x, fs, dirs, runs: [run, ...x.runs] }, "apply",
      `run ${runId}: ${mode === "move" ? "moved" : "copied"} ${done} files from ${plan.source} to ${dest}, ${skipped} skipped${backup ? ", backup in " + backup : ""}`));
  }

  function undo(run: Run) { // views.undo + applier.undo_run
    if (undoState(run.records) === "undone") return go(href("/runs/" + run.id), [["error", "Cannot undo: this run was already undone."]]);
    const fs = { ...s.fs }, dirs = [...s.dirs], records = [...run.records, { type: "undo_start", started_utc: nowText() }];
    const restoredBefore = new Set(run.records.filter((r) => r.type === "undo" && r.result === "restored").map((r) => r.src + "|" + r.dst));
    let restored = 0, left = 0;
    run.records.filter((r) => r.type === "done" && !restoredBefore.has(r.src + "|" + r.dst)).reverse().forEach((op) => {
      const leave = (reason: string) => { records.push({ type: "undo", src: op.src, dst: op.dst, result: "left", reason }); left++; };
      if (!fs[op.dst]) return leave("not found at its new place, left as it is");
      if (op.op === "move") {
        if (fs[op.src]) return leave("a new file now has the original name, left at its new place");
        if (!dirs.some((x) => lower(x) === lower(dirname(op.src)))) dirs.push(dirname(op.src));
        fs[op.src] = fs[op.dst]; delete fs[op.dst];
        records.push({ type: "undo", src: op.src, dst: op.dst, result: "restored" }); restored++; return;
      }
      const asideRoot = join(run.dest, "_Undone " + run.id), aside = join(asideRoot, op.dst.slice(run.dest.length).replace(/^\\+/, ""));
      for (let c = dirname(aside); !dirs.some((x) => lower(x) === lower(c)); c = dirname(c)) { dirs.push(c); records.push({ type: "mkdir", path: c }); }
      fs[aside] = fs[op.dst]; delete fs[op.dst];
      records.push({ type: "undo", src: op.src, dst: op.dst, aside, result: "restored" }); restored++;
    });
    let removed = 0;
    const owned = [...new Set(run.records.filter((r) => r.type === "mkdir").map((r) => r.path as string))].sort((a, b) => b.split("\\").length - a.split("\\").length);
    owned.forEach((d) => {
      const busy = Object.keys(fs).some((k) => inside(k, d)) || dirs.some((x) => x !== d && inside(x, d) && lower(x) !== lower(d));
      if (!busy && ![INBOX, OUT, "C:\\Jobs"].some((k) => lower(k) === lower(d))) { const i = dirs.findIndex((x) => lower(x) === lower(d)); if (i >= 0) { dirs.splice(i, 1); removed++; } }
    });
    const complete = left === 0;
    records.push({ type: complete ? "undo_end" : "undo_partial", finished_utc: nowText(), restored, left, folders_removed: removed, folders_kept_unsafe: 0 });
    const flash: Flash = complete ? ["ok", `Undo finished: ${restored} restored, ${left} left in place.`]
      : ["error", `Undo is NOT finished: ${restored} restored, ${left} left in place (listed below). Nothing was overwritten or deleted. Fix what the list says, then use Retry undo.`];
    go(href("/runs/" + run.id), [flash], (x) => log({ ...x, fs, dirs, runs: x.runs.map((r) => (r.id === run.id ? { ...r, records, state: complete ? "undone" : "partially_undone" } : r)) },
      complete ? "undo" : "undo partial", `run ${run.id}: ${restored} restored, ${left} left in place, ${removed} empty folders removed`));
  }

  /* ---- page chrome (base.html) */
  const path = route.path;
  const planMatch = /^\/plan\/(\d+)$/.exec(path), runMatch = /^\/runs\/([\w-]+)$/.exec(path);
  const plan = planMatch ? s.plans.find((p) => p.id === +planMatch[1]) : undefined;
  const run = runMatch ? s.runs.find((r) => r.id === runMatch[1]) : undefined;
  const navOn = path.startsWith("/rules") ? "rules" : path.startsWith("/activity") || runMatch ? "activity" : path.startsWith("/settings") ? "settings" : path.startsWith("/licence") ? "licence" : "organize";
  const step = path === "/" ? 1 : path === "/rules" ? 2 : plan ? 3 : run ? 4 : 0;
  const stepPlan = plan ? href("/plan/" + plan.id) : run ? href("/plan/" + run.plan_id) : href("/");

  let page: ReactNode;
  if (path === "/") page = <Organize />;
  else if (planMatch) page = plan ? <PlanPage plan={plan} /> : <ErrorPage code={404} message="The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again." />;
  else if (runMatch) page = run ? <RunPage run={run} /> : <ErrorPage code={404} message="The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again." />;
  else if (path === "/rules") page = <RulesPage />;
  else if (path === "/activity") page = <Activity />;
  else if (path === "/settings") page = <Settings />;
  else if (path === "/licence") page = <Licence />;
  else if (path === "/browse") page = <Browse />;
  else page = <ErrorPage code={404} message="The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again." />;

  const ctx = { s, setS, route, go, log, scan, apply, undo };
  return (
    <Ctx.Provider value={ctx}>
      <div className="demo-ribbon" role="note">
        <a href="/">&larr; Back to Demo Lab</a>
        <span className="tag">DEMO</span>
        <span>Sample files only. Nothing on your computer is read, moved or changed. The C:\ drive here lives in this browser.</span>
        <span className="sp" />
        <span className="soon" title="GMA File Organizer is not on sale yet">Coming soon</span>
        <button type="button" id="demo-reset" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setS(fresh()); location.hash = "#/"; setShown([["ok", "Demo reset: the sample folder C:\\Jobs\\Inbox is back to its 17 files."]]); }}>Reset demo</button>
      </div>
      <header className="top">
        <div className="brand"><strong>Granite Models Automations</strong><span>Built for the trades.</span></div>
        <div className="title">File Organizer</div>
        <div className="who">
          <button type="button" className="linkbtn" id="theme-toggle" title="Switch light or dark" onClick={() => {
            const root = document.documentElement;
            const dark = root.getAttribute("data-theme") === "dark" || (!root.getAttribute("data-theme") && matchMedia("(prefers-color-scheme: dark)").matches);
            const next = dark ? "light" : "dark"; root.setAttribute("data-theme", next); try { localStorage.setItem("fo-theme", next); } catch { /* private */ }
          }}>Light / dark</button>
          <span>{USER}</span>
          <button className="linkbtn" type="button" title="Sign-in is skipped in this demo" onClick={() => go(href("/"), [["ok", "This demo has no sign-in, so there is nothing to log out of. The real program asks for a user name and password."]])}>Log out</button>
        </div>
      </header>
      <div className="shell">
        <nav className="nav" aria-label="Main">
          <a href={href("/")} className={navOn === "organize" ? "on" : ""}>Organize</a>
          <a href={href("/rules")} className={navOn === "rules" ? "on" : ""}>Rules</a>
          <a href={href("/activity")} className={navOn === "activity" ? "on" : ""}>Activity</a>
          <a href={href("/settings")} className={navOn === "settings" ? "on" : ""}>Settings</a>
          <a href={href("/licence")} className={navOn === "licence" ? "on" : ""}>Licence</a>
        </nav>
        <main>
          {shown.map(([cat, msg], i) => <div key={i} className={"flash " + cat} role="status">{msg}</div>)}
          {step > 0 && (
            <div className="steps" aria-label="Steps">
              <a href={href("/")} className={step === 1 ? "on" : ""}>1 Add files or folder</a>
              <a href={href("/rules")} className={step === 2 ? "on" : ""}>2 Set rules</a>
              <a href={stepPlan} className={step === 3 ? "on" : ""}>3 Preview plan</a>
              <a href={stepPlan} className={step === 4 ? "on" : ""}>4 Apply (or export)</a>
            </div>
          )}
          <div key={route.path + "?" + route.q.toString() + "#" + nonce}>{page}</div>
          <p className="muted">GMA File Organizer {VERSION} - runs on this PC only; nothing is hosted. <span className="demo-tag">(This demo runs in your browser with sample files.)</span></p>
        </main>
      </div>
    </Ctx.Provider>
  );

}

/* ---------------------------------------------------------------- pages */
function Organize() { // organize.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const [source, setSource] = useState(route.q.get("source") || "");
  const [recursive, setRecursive] = useState(false);
  const latest = s.plans[0];
  const kp: Record<string, number | null> = { scanned: null, ok: null, check: null, review: null, duplicate: null, moved: null };
  if (latest) { kp.scanned = latest.rows.length; ["ok", "check", "review", "duplicate"].forEach((st) => (kp[st] = latest.rows.filter((r) => r.status === st).length)); }
  const applied = s.runs.filter((r) => r.state === "applied"); if (applied.length) kp.moved = applied.reduce((a, r) => a + r.done, 0);
  const counts = { jobs: O.parseRules(s.rules.jobs).length, types: O.parseRules(s.rules.types).length, vendors: O.parseRules(s.rules.vendors).length };
  return (<>
    {!hasOwnJobRule(s.rules) && (
      <div className="callout" id="first-run-hint" role="note">
        <p>Add your job numbers and destination folders in Rules so we know where your files belong.</p>
        <div className="row"><a className="btn primary" id="first-run-add-job" href={href("/rules", { add: "job" })}>Add a job rule</a></div>
      </div>)}
    <div className="grid">
      <section className="card">
        <h2>1 Add files or folder</h2>
        <form onSubmit={(e) => { e.preventDefault(); scan(source, recursive); }}>
          <label htmlFor="source">Folder on this PC with the files to sort</label>
          <input type="text" id="source" name="source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="C:\Jobs\Inbox" required />
          <div className="row">
            <label className="inline"><input type="checkbox" name="recursive" checked={recursive} onChange={(e) => setRecursive(e.target.checked)} /> Include subfolders</label>
            <a href={href("/browse", { for: "source" })}>Browse folders</a>
          </div>
          <div className="row"><button className="btn primary" type="submit">Scan and plan</button></div>
          <p className="muted">Only file names, sizes and dates are read. Nothing moves until you apply a plan.</p>
          <p className="demo-tag">Demo: the sample folder is C:\Jobs\Inbox (17 messy file names).</p>
        </form>
      </section>
      <section className="card">
        <h2>2 Rules in use</h2>
        <dl className="kv">
          <dt>Jobs</dt><dd>{dash(counts.jobs)}</dd>
          <dt>Doc types</dt><dd>{dash(counts.types)}</dd>
          <dt>Vendors</dt><dd>{dash(counts.vendors)}</dd>
          <dt>New name</dt><dd>{breakable("Date_Job_Type_Vendor")} in Job/Type folders</dd>
          <dt>Date</dt><dd>from the file name{s.rules.useFileDate && ", else the file's own date (flagged)"}</dd>
          <dt>Unclear files</dt><dd>_Needs review (never guessed)</dd>
          <dt>Copies</dt><dd>_Duplicates</dd>
        </dl>
        <div className="row"><a className="btn" href={href("/rules")}>Edit rules</a></div>
      </section>
      <section className="card">
        <h2>Recent plans</h2>
        {s.plans.length ? <ul className="plain">{s.plans.slice(0, 5).map((p) => <li key={p.id}><a href={href("/plan/" + p.id)}>Plan {p.id}</a> - {p.rows.length} files - <span className="muted">{breakable(p.source)} (<span className="nowrap">{p.created_utc}</span>)</span></li>)}</ul>
          : <p>{dash(null)} no plans yet - scan a folder first</p>}
      </section>
    </div>
    <div className="kpis">
      {([["scanned", "Files scanned", "not scanned yet"], ["ok", "Ready (ok)", "not scanned yet"], ["check", "Check", "not scanned yet"], ["review", "Needs review", "not scanned yet"], ["duplicate", "Duplicates", "not scanned yet"], ["moved", "Organised (undoable)", "nothing applied"]] as const).map(([k, label, why]) => (
        <div className="kpi" key={k}><div className="label">{label}</div><div className="value">{dash(kp[k])}</div>{kp[k] === null && <div className="why">{why}</div>}</div>))}
    </div>
  </>);
}

function PlanPage({ plan }: { plan: Plan }) { // plan.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const wanted = route.q.get("status") || "";
  const [dest, setDest] = useState(route.q.get("dest") || "");
  const [mode, setMode] = useState("move");
  const [backupOn, setBackupOn] = useState(true);
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(plan.rows.map((r) => r.i)));
  const rows = plan.rows.filter((r) => !wanted || r.status === wanted);
  const counts: Record<string, number> = {}; ["ok", "check", "review", "duplicate"].forEach((st) => (counts[st] = plan.rows.filter((r) => r.status === st).length));
  const noJob = plan.rows.length > 0 && plan.rows.every((r) => !r.job && !r.flags.some((f: string) => f.startsWith("matches more than one job")));
  const exportCsv = () => {
    const text = [CSV_HEAD.join(",")].concat(plan.rows.map((r) => [r.original, r.newName, r.folder, r.path, r.status, r.job, r.type, r.vendor, r.date, r.dateSource, r.flags.join("; ")].map(csvCell).join(","))).join("\r\n") + "\r\n";
    download("\ufeff" + text, "text/csv", `file-organizer-plan-${plan.id}.csv`);
    setS((x) => log(x, "export", `plan ${plan.id} exported as CSV (${plan.rows.length} rows)`));
  };
  const onApply = (e: FormEvent) => { e.preventDefault(); apply(plan, plan.rows.filter((r) => ticked.has(r.i) && (!wanted || r.status === wanted)).map((r) => r.i), dest, mode, backupOn); };
  const all = rows.length > 0 && rows.every((r) => ticked.has(r.i));
  return (<>
    {noJob && (<div className="callout" id="no-job-matched" role="note">
      <p>None of these files matched a job, so each one is waiting in "_Needs review". Add the job numbers your shop uses in Rules, then scan again.</p>
      <div className="row"><a className="btn primary" id="add-job-rule" href={href("/rules", { add: "job", plan: plan.id })}>Add a job rule</a></div></div>)}
    <div className="grid">
      <section className="card">
        <h2>Source</h2>
        <dl className="kv">
          <dt>Folder</dt><dd>{breakable(plan.source)} <span className="demo-tag">(sample)</span></dd>
          <dt>Subfolders</dt><dd>{plan.recursive ? "included" : "not included"}</dd>
          <dt>Files planned</dt><dd>{plan.rows.length}</dd>
          <dt>Skipped</dt><dd>{dash(plan.skipped.length || null)}</dd>
          <dt>Scanned</dt><dd><span className="nowrap">{plan.created_utc}</span> by {plan.username}</dd>
        </dl>
        <div className="row">
          <button className="btn" type="button" onClick={() => scan(plan.source, plan.recursive, plan.id)}>Scan again</button>
          <button className="btn" type="button" id="export-csv" onClick={exportCsv}>Export plan (CSV)</button>
        </div>
      </section>
      <section className="card span2">
        <h2>4 Apply</h2>
        <form id="apply-form" onSubmit={onApply}>
          <label htmlFor="dest">Destination folder (Job/Type folders are made inside it)</label>
          <input type="text" id="dest" name="dest" value={dest} onChange={(e) => setDest(e.target.value)} placeholder="C:\Jobs\Organised" required />
          <div className="row">
            <a href={href("/browse", { for: "dest-" + plan.id })}>Browse folders</a>
            <label className="inline"><input type="radio" name="mode" value="move" id="mode-move" checked={mode === "move"} onChange={() => setMode("move")} /> Move</label>
            <label className="inline"><input type="radio" name="mode" value="copy" id="mode-copy" checked={mode === "copy"} onChange={() => setMode("copy")} /> Copy (originals stay)</label>
            <label className="inline"><input type="checkbox" name="backup" id="backup" checked={backupOn} disabled={mode === "copy"} onChange={(e) => setBackupOn(e.target.checked)} /> Back up each file before moving</label>
          </div>
          <div className="row">
            <button className="btn primary" type="submit" id="apply-button">Apply ticked files</button>
            <span className="muted">Never overwrites and never deletes; every run can be undone from Activity.</span>
          </div>
        </form>
      </section>
    </div>
    <section className="card gap">
      <h2>3 Preview plan</h2>
      <div className="filters">
        <a href={href("/plan/" + plan.id, { dest })} className={!wanted ? "on" : ""}>All {plan.rows.length}</a>
        {["ok", "check", "review", "duplicate"].map((st) => <a key={st} href={href("/plan/" + plan.id, { status: st, dest })} className={wanted === st ? "on" : ""}>{STATUS_LABELS[st]} {counts[st]}</a>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th><input type="checkbox" id="accept-all" checked={all} aria-label="Tick all" onChange={(e) => setTicked(e.target.checked ? new Set(plan.rows.map((r) => r.i)) : new Set())} /></th><th>Status</th><th>File now</th><th>New folder</th><th>New name</th><th>Date</th><th>Why</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.i}>
                <td><input type="checkbox" name="accept" value={row.i} checked={ticked.has(row.i)} aria-label={"Accept " + row.rel} onChange={(e) => setTicked((t) => { const n = new Set(t); if (e.target.checked) n.add(row.i); else n.delete(row.i); return n; })} /></td>
                <td><span className={"chip " + row.status}>{STATUS_LABELS[row.status]}</span></td>
                <td className="path">{breakable(row.rel)}</td>
                <td className="path">{breakable(row.folder)}</td>
                <td className="path">{breakable(row.newName)}</td>
                <td><span className="nowrap">{dash(row.date)}</span>{row.dateSource === "file date" && <><br /><span className="muted">(file date)</span></>}</td>
                <td>{dash(row.flags.join("; "))}</td>
              </tr>))}
            {!rows.length && <tr><td colSpan={7}>{dash(null)} no files {wanted ? "with this status" : "in this folder"}</td></tr>}
          </tbody>
        </table>
      </div>
      {wanted && <p className="muted">Only the files shown are sent to Apply. Choose "All" to apply every ticked file.</p>}
    </section>
    {plan.skipped.length > 0 && (
      <section className="card gap">
        <h2>Skipped while scanning</h2>
        <table><thead><tr><th>Item</th><th>Why</th></tr></thead><tbody>
          {plan.skipped.map((it) => <tr key={it.rel}><td className="path">{breakable(it.rel)}</td><td>{it.reason}</td></tr>)}
        </tbody></table>
      </section>)}
  </>);
}

function RunPage({ run }: { run: Run }) { // run.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const firstDone = run.records.find((r) => r.type === "done");
  const blocker = firstDone && run.mode === "move" ? firstDone.src : null;
  const blocked = blocker ? !!s.fs[blocker] : false;
  const canUndo = ["applied", "started", "interrupted", "partially_undone"].includes(run.state);
  return (<>
    <div className="grid">
      <section className="card span2">
        <h2>Run {run.id}</h2>
        <dl className="kv">
          <dt>What</dt><dd>{run.mode === "move" ? "Moved" : "Copied"} {run.done} files, {run.skipped} skipped</dd>
          <dt>From</dt><dd>{breakable(run.source)}</dd>
          <dt>To</dt><dd>{breakable(run.dest)}</dd>
          <dt>Backup copies</dt><dd>{dash(run.backup)}</dd>
          <dt>When</dt><dd><span className="nowrap">{run.created_utc}</span> by {run.username}</dd>
          <dt>State</dt><dd id="run-state">{run.state}</dd>
          <dt>Undo log</dt><dd>{breakable(run.journal)}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Undo</h2>
        {run.state === "partially_undone" && <p className="errors" role="alert" id="partial-undo-note">Undo is NOT finished: some files were left where they are (see "undo ... left" in the table below, with the reason for each). Nothing was overwritten or deleted. Fix what each reason says (for example rename or move the file that is now sitting at the original name), then press Retry undo. Files already put back are not touched again.</p>}
        {canUndo ? (<>
          <p>Puts every moved file back where it was{run.mode === "copy" && ` (copies are set aside in "_Undone ${run.id}", not deleted)`}. Nothing is overwritten.</p>
          <button className="btn primary" type="button" id="undo-button" onClick={() => undo(run)}>{run.state === "partially_undone" ? "Retry undo" : "Undo this run"}</button>
        </>) : <p>This run was undone.</p>}
        <div className="row"><button className="btn" type="button" id="undo-log" onClick={() => download(JSON.stringify({ run: run.id, records: run.records, damaged_lines: [] }, null, 1), "application/json", `file-organizer-undo-${run.id}.json`)}>Download undo log (JSON)</button></div>
        {blocker && canUndo && (
          <div className="demo-sim" id="demo-sim">
            <p className="demo-tag"><b>Demo only:</b> see what Retry undo is for. Put a new file at one original name, press Undo (that file is left), then remove it and press Retry undo.</p>
            {blocked
              ? <button className="btn" type="button" id="demo-unblock" onClick={() => go(href("/runs/" + run.id), [["ok", "Demo: the new file at " + blocker + " was moved away."]], (x) => { const fs = { ...x.fs }; delete fs[blocker]; return { ...x, fs }; })}>Remove the new file</button>
              : <button className="btn" type="button" id="demo-block" onClick={() => go(href("/runs/" + run.id), [["ok", "Demo: a new file now sits at " + blocker + "."]], (x) => ({ ...x, fs: { ...x.fs, [blocker]: { size: 2048, lastModified: Date.now() } } }))}>Put a new file at an original name</button>}
          </div>)}
      </section>
    </div>
    <section className="card gap">
      <h2>File by file</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Step</th><th>Result</th><th>From</th><th>To</th><th>Note</th></tr></thead>
        <tbody>
          {run.records.filter((r) => ["done", "skip", "undo"].includes(r.type)).map((r, i) => {
            const res = r.type === "done" ? "done" : r.type === "skip" ? "skipped" : r.result;
            return (<tr key={i}>
              <td className="nowrap">{r.type === "undo" ? "undo" : r.op || "apply"}</td>
              <td><span className={"chip " + res}>{res}</span></td>
              <td className="path">{breakable(r.src)}</td>
              <td className="path">{r.dst ? breakable(r.dst) : dash(null)}</td>
              <td className="note">{dash(r.reason)}</td>
            </tr>);
          })}
        </tbody>
      </table></div>
    </section>
  </>);
}

function Activity() { // activity.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  return (<>
    <section className="card">
      <h2>Runs (each one can be undone)</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>Run</th><th>When</th><th>Who</th><th>What</th><th>From</th><th>To</th><th>State</th></tr></thead>
        <tbody>
          {s.runs.map((r) => (<tr key={r.id}><td><a href={href("/runs/" + r.id)}>{r.id}</a></td><td className="nowrap">{r.created_utc}</td><td>{r.username}</td>
            <td>{r.mode} {r.done} ({r.skipped} skipped)</td><td className="path">{breakable(r.source)}</td><td className="path">{breakable(r.dest)}</td>
            <td>{r.state}{["started", "interrupted", "partially_undone", "journal_damaged"].includes(r.state) && <> - <a href={href("/runs/" + r.id)}>{r.state === "partially_undone" ? "retry undo" : r.state === "journal_damaged" ? "see why" : "undo / recover"}</a></>}</td></tr>))}
          {!s.runs.length && <tr><td colSpan={7}>{dash(null)} nothing applied yet</td></tr>}
        </tbody>
      </table></div>
    </section>
    <section className="card gap">
      <h2>Activity log</h2>
      <div className="table-wrap"><table>
        <thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>
          {s.activity.map((l, i) => <tr key={i}><td className="nowrap">{l.ts_utc}</td><td>{l.username}</td><td>{l.action}</td><td>{breakable(l.detail)}</td></tr>)}
          {!s.activity.length && <tr><td colSpan={4}>{dash(null)} no activity yet</td></tr>}
        </tbody>
      </table></div>
    </section>
  </>);
}

function RulesPage() { // rules.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const adding = route.q.get("add") === "job";
  const scanPlan = s.plans.find((p) => String(p.id) === route.q.get("plan"));
  const [r, setR] = useState<Rules>(s.rules);
  const [errors, setErrors] = useState<string[]>([]);
  const [jobName, setJobName] = useState(""), [jobWords, setJobWords] = useState("");
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const back = href("/rules", { plan: scanPlan?.id });
  const addJob = (e: FormEvent) => {
    e.preventDefault();
    const name = jobName.split(/\s+/).filter(Boolean).join(" ");
    const words = jobWords.split(",").map((w) => w.split(/\s+/).filter(Boolean).join(" ")).filter(Boolean);
    let errs: string[] = [];
    if (!name) errs.push("Give the job a folder name, for example J2417 SmithRailing.");
    else if (/[=,]/.test(name)) errs.push("The job folder name cannot contain = or a comma.");
    else if (O.parseRules(s.rules.jobs).some((x: any) => x.key.toLowerCase() === name.toLowerCase())) errs.push(`A job called '${name}' already exists; change its words in the Jobs box below.`);
    if (!words.length) errs.push("Give the words that find this job in file names, for example 2417, smith railing.");
    else if (words.some((w) => w.includes("="))) errs.push("The words cannot contain =.");
    const proposed = { ...s.rules, jobs: s.rules.jobs.replace(/\n+$/, "") + `\n${name} = ${words.join(", ")}` };
    if (!errs.length) errs = ruleErrors(proposed);
    if (errs.length) return setAddErrors(errs);
    go(back, [["ok", `Job ${name} added. Scan again to plan with it.`]], (x) => log({ ...x, rules: proposed }, "rules", `job added: ${name} (${O.parseRules(proposed.jobs).length} jobs now)`));
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    const errs = ruleErrors(r); if (errs.length) return setErrors(errs);
    go(back, [["ok", "Rules saved. Scan again to plan with them."]], (x) => log({ ...x, rules: r }, "rules", "rules saved (" + (["jobs", "types", "vendors"] as const).map((k) => O.parseRules(r[k]).length + " " + k).join(", ") + ")"));
  };
  return (<>
    {scanPlan && (<div className="callout" id="scan-again-note" role="note">
      <p>Rules apply to the next scan. Scan {breakable(scanPlan.source)} again to see your files sorted with them.</p>
      <div className="row"><button className="btn primary" type="button" id="scan-again-button" onClick={() => scan(scanPlan.source, scanPlan.recursive, scanPlan.id)}>Scan again</button></div></div>)}
    <form onSubmit={addJob} id="add-job-form" className={"card" + (adding || addErrors.length ? " on" : "")}>
      <h2>Add a job rule</h2>
      {!hasOwnJobRule(s.rules) && <p className="muted">The jobs below are only examples. Add the job numbers your shop really uses, with the folder each one should go to.</p>}
      <div className="grid two">
        <div><label htmlFor="job_name">Job folder name (the folder its files go to)</label>
          <input type="text" id="job_name" value={jobName} onChange={(e) => setJobName(e.target.value)} placeholder="J2417 SmithRailing" autoFocus={adding} /></div>
        <div><label htmlFor="job_words">Words found in its file names (job number, customer), separated by commas</label>
          <input type="text" id="job_words" value={jobWords} onChange={(e) => setJobWords(e.target.value)} placeholder="2417, smith railing" /></div>
      </div>
      <div className="row"><button className="btn primary" type="submit" id="add-job-button">Add this job</button></div>
      {addErrors.length > 0 && <ul className="errors" role="alert" id="add-job-errors">{addErrors.map((x) => <li key={x}>{x}</li>)}</ul>}
    </form>
    <form onSubmit={save} className="gap">
      <div className="grid">
        <section className="card"><h2>Jobs</h2>
          <label htmlFor="jobs">One job per line: Folder name = words found in file names</label>
          <textarea id="jobs" spellCheck={false} value={r.jobs} onChange={(e) => setR({ ...r, jobs: e.target.value })} /></section>
        <section className="card"><h2>Doc types</h2>
          <label htmlFor="types">Type = words, or extensions such as .dwg</label>
          <textarea id="types" spellCheck={false} value={r.types} onChange={(e) => setR({ ...r, types: e.target.value })} /></section>
        <section className="card"><h2>Vendors</h2>
          <label htmlFor="vendors">Vendor = words (photos and drawings need no vendor)</label>
          <textarea id="vendors" spellCheck={false} value={r.vendors} onChange={(e) => setR({ ...r, vendors: e.target.value })} /></section>
        <section className="card span2"><h2>Dates and names</h2>
          <label className="inline"><input type="checkbox" checked={r.useFileDate} onChange={(e) => setR({ ...r, useFileDate: e.target.checked })} /> If the name has no date, use the file's own date (and flag it "check")</label>
          <label htmlFor="date_sep">Date separator in new names</label>
          <select id="date_sep" value={r.dateSep} onChange={(e) => setR({ ...r, dateSep: e.target.value })}>
            {SEPARATORS.map((sep) => <option key={sep} value={sep}>{"2026" + sep + "10" + sep + "05"}{sep === "" ? " (none)" : ""}{sep === " " ? " (space)" : ""}</option>)}
          </select>
          <p className="muted">New names are Date_Job_Type_Vendor in Job/Type folders. A file that matches no job, no type, more than one of them, or has no date goes to "_Needs review": it is flagged, never guessed. Copies go to "_Duplicates". The same new name twice gets _2, _3.</p>
        </section>
        <section className="card"><h2>Save</h2>
          {errors.length > 0 && <ul className="errors" role="alert">{errors.map((x) => <li key={x}>{x}</li>)}</ul>}
          <button className="btn primary" type="submit">Save rules</button></section>
      </div>
    </form>
    <div className="row">
      <button className="btn" type="button" onClick={() => go(href("/rules"), [["ok", "Example rules restored."]], (x) => log({ ...x, rules: { ...O.DEFAULT_RULES, useFileDate: true, dateSep: "-" } }, "rules", "example rules restored"))}>Restore the example rules</button>
    </div>
  </>);
}

function Settings() { // settings.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const [dir, setDir] = useState(s.backupDir);
  const saveBackup = (e: FormEvent) => {
    e.preventDefault();
    const text = dir.trim();
    if (!text) return go(href("/settings"), [["ok", "Backups go to the program's data folder."]], (x) => log({ ...x, backupDir: "" }, "settings", "backup folder set to the default"));
    try {
      const p = normalise(text);
      if (inside(p, DATA_DIR)) throw new Refused(DATA_DIR + " is a system or program folder");
      const why = systemReason(p); if (why) throw new Refused(why);
      go(href("/settings"), [["ok", "Backup folder saved."]], (x) => log({ ...x, backupDir: p, dirs: x.dirs.some((d) => lower(d) === lower(p)) ? x.dirs : [...x.dirs, p] }, "settings", "backup folder set to " + p));
    } catch (err: any) { go(href("/settings"), [["error", "Cannot use that backup folder: " + err.message + "."]]); }
  };
  return (<div className="grid">
    <section className="card">
      <h2>Change password</h2>
      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="current">Current password</label><input type="password" id="current" disabled />
        <label htmlFor="new">New password (12 characters or more)</label><input type="password" id="new" disabled />
        <label htmlFor="confirm">New password again</label><input type="password" id="confirm" disabled />
        <div className="row"><button className="btn primary" type="submit" disabled aria-disabled="true">Change password</button></div>
        <p className="demo-tag">Not in this demo: there is no sign-in here. The real program has one administrator per shop.</p>
      </form>
    </section>
    <section className="card">
      <h2>Backup before move</h2>
      <form onSubmit={saveBackup}>
        <label htmlFor="backup_dir">Backup folder (empty = {DEFAULT_BACKUP})</label>
        <input type="text" id="backup_dir" value={dir} onChange={(e) => setDir(e.target.value)} placeholder={DEFAULT_BACKUP} />
        <div className="row"><button className="btn primary" type="submit">Save backup folder</button></div>
        <p className="muted">Each run that moves files with backup on copies the originals into a folder named after the run. Backups are never deleted by the program.</p>
      </form>
    </section>
    <section className="card">
      <h2>This installation</h2>
      <dl className="kv"><dt>Data folder</dt><dd>{DATA_DIR}</dd><dt>Version</dt><dd>{VERSION}</dd><dt>Network</dt><dd>none - answers on 127.0.0.1 only</dd></dl>
    </section>
  </div>);
}

function Licence() { // licence.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  return (<div className="grid two">
    <section className="card">
      <h2>Licence</h2>
      <dl className="kv">
        <dt>Status</dt><dd id="licence-status">valid</dd>
        <dt>Detail</dt><dd>licence valid until 2027-10-01T00:00:00Z</dd>
        <dt>Company</dt><dd>Demo Shop (sample)</dd>
        <dt>Plan</dt><dd>annual</dd>
        <dt>Issued</dt><dd>2026-10-01T00:00:00Z</dd>
        <dt>Renews / expires</dt><dd>2027-10-01T00:00:00Z</dd>
        <dt>Grace ends</dt><dd>2027-10-15</dd>
        <dt>Licence file</dt><dd>{DATA_DIR}\licence.json</dd>
      </dl>
      <p className="demo-tag">Demo licence. GMA File Organizer is coming soon and is not on sale yet.</p>
    </section>
    <section className="card">
      <h2>What the licence controls</h2>
      <p>Your licence is installed with the program; you never type a key. Renewals arrive as a small update.</p>
      <p>Without a valid licence the program is read-only: scanning, the preview, the CSV export and undo of earlier runs keep working; Apply and rule changes are turned off. Nothing is ever deleted.</p>
      <p className="muted">After a monthly or annual licence expires there are 14 days of grace with a banner before read-only starts.</p>
    </section>
  </div>);
}

function Browse() { // browse.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  const target = route.q.get("for") || "source";
  const raw = route.q.get("path") || "";
  let current: string | null = null, error: string | null = null, folders: { name: string; path: string }[] = [];
  if (!raw) folders = [{ name: "C:\\", path: "C:\\" }];
  else {
    try { current = normalise(raw); if (!dirExists(s, current)) throw new Refused("[WinError 3] The system cannot find the path specified: '" + current + "'"); folders = subfolders(s, current).map((d) => ({ name: d.slice(d.lastIndexOf("\\") + 1), path: d })); }
    catch (e: any) { error = e.message; }
  }
  const parent = current && dirname(current) !== current && current.length > 3 ? dirname(current) : "";
  const usable = !!current && !systemReason(current);
  const use = target === "source" ? href("/", { source: current || "" }) : href("/plan/" + target.slice(5), { dest: current || "" });
  return (<section className="card">
    <h2>Choose a folder on this PC</h2>
    <p className="muted">Current: {dash(current)} <span className="demo-tag">(the demo's sample drive)</span></p>
    {error && <p className="errors" role="alert">{error}</p>}
    <div className="row">
      {current && <a href={href("/browse", { path: parent, for: target })}>Up one level</a>}
      {current && usable && <a className="btn primary" href={use}>Use this folder</a>}
      {current && !usable && <span className="muted">This folder cannot be used (system or program folder or drive root).</span>}
    </div>
    <ul className="plain gap">
      {folders.map((f) => <li key={f.path}><a href={href("/browse", { path: f.path, for: target })}>{f.name}</a></li>)}
      {!folders.length && <li>{dash(null)} no subfolders</li>}
    </ul>
  </section>);
}

function ErrorPage({ code, message }: { code: number; message: string }) { // error.html
  const { s, setS, route, go, log, scan, apply, undo } = useContext(Ctx); void [s, setS, route, go, log, scan, apply, undo];
  return <section className="card"><h2>{code}</h2><p id="error-message">{message}</p><p><a href={href("/")}>Back to Organize</a></p></section>;
}

function titleFor(path: string) {
  if (path === "/") return "Organize";
  if (path.startsWith("/plan/")) return "Preview plan " + path.slice(6);
  if (path.startsWith("/runs/")) return "Run " + path.slice(6);
  return ({ "/rules": "Rules", "/activity": "Activity", "/settings": "Settings", "/licence": "Licence", "/browse": "Choose a folder" } as Record<string, string>)[path] || "Error 404";
}
