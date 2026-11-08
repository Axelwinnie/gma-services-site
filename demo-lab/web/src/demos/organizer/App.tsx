import { FormEvent, useEffect, useState } from "react";

const KEY = "gma-demo:organizer";
const STATUS: Record<string, string> = { ok: "ok", check: "check", review: "needs review", duplicate: "duplicate" };
const DATE_SEPS: [string, string][] = [["-", "2026-10-05"], ["", "20261005 (none)"], [".", "2026.10.05"], ["_", "2026_10_05"], [" ", "2026 10 05 (space)"]];
const NAV = [["organize", "Organize"], ["rules", "Rules"], ["activity", "Activity"], ["settings", "Settings"], ["licence", "Licence"]] as const;

type Rules = { jobs: string; types: string; vendors: string; useFileDate: boolean; dateSep: string };
type Row = { key: string; original: string; size: number; lastModified: number; newName: string; folder: string; path: string; status: string; job: string; type: string; vendor: string; date: string; dateSource: string; flags: string[]; ticked: boolean };
type Plan = { id: number; source: string; subfolders: boolean; rows: Row[]; skipped: { item: string; why: string }[]; when: number; who: string };
type RunFile = { step: number; result: string; from: string; to: string; note: string; name: string; size: number; lastModified: number };
type Run = { id: string; intent: "move" | "copy"; from: string; to: string; backup: boolean; backupRoot: string; when: number; who: string; state: string; records: unknown[]; damaged: unknown[]; files: RunFile[]; done: number; skipped: number };
type Shop = { version: number; user: string; signedIn: boolean; readonly: boolean; demoSkip: boolean; blockerPath: string; source: string; dest: string; subfolders: boolean; backupFolder: string; rules: Rules; savedRulesAt: number; plans: Plan[]; runs: Run[]; log: { at: number; who: string; action: string; detail: string }[] };
type Flash = { kind: "ok" | "error"; text: string } | null;
type Dir = { path: string; missing: boolean; dirs: string[]; fileCount: number; usable: boolean; reason: string };
type Result = { ok: boolean; state: Shop; error?: string; message?: string; planId?: number; runId?: string };
type SimApi = {
  VERSION: string; INBOX: string; ORGANISED: string; DATA: string; BACKUPS: string;
  fresh: (now?: number) => Shop; reset: (s: Shop, now?: number) => Shop;
  signIn: (s: Shop, user: string) => Shop; signOut: (s: Shop) => Shop;
  setSource: (s: Shop, path: string) => Shop; setDest: (s: Shop, path: string) => Shop;
  setSubfolders: (s: Shop, on: boolean) => Shop; setReadonly: (s: Shop, on: boolean) => Shop; setDemoSkip: (s: Shop, on: boolean) => Shop;
  scan: (s: Shop, opts?: { folder?: string; subfolders?: boolean; now?: number }) => Result;
  saveRules: (s: Shop, rules: Rules, now?: number) => Result; restoreExamples: (s: Shop, now?: number) => Result;
  checkJob: (folder: string, words: string, jobsText: string) => { error?: string; line?: string };
  setTicks: (s: Shop, planId: number, keys: string[], on: boolean) => Shop;
  apply: (s: Shop, opts: { planId: number; keys: string[]; intent: "move" | "copy"; backup: boolean; dest: string; now?: number }) => Result;
  undo: (s: Shop, id: string, now?: number) => Result;
  saveBackup: (s: Shop, folder: string, now?: number) => Result;
  addNames: (s: Shop, list: { name: string; size: number; lastModified: number }[], now?: number) => Result;
  setBlocker: (s: Shop, on: boolean, now?: number) => Result;
  logExport: (s: Shop, planId: number, now?: number) => Shop;
  planCsv: (plan: Plan) => { filename: string; text: string };
  undoDownload: (run: Run) => { filename: string; text: string };
  kpis: (s: Shop) => { scanned: number | null; ok: number | null; check: number | null; review: number | null; duplicate: number | null; organised: number };
  ruleCounts: (rules: Rules) => { jobs: number; types: number; vendors: number };
  isExampleJobs: (rules: Rules) => boolean;
  listDir: (s: Shop, path: string) => Dir; parent: (path: string) => string; base: (path: string) => string; utc: (ms: number) => string;
};

function loadShop(Sim: SimApi): Shop {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Shop & { files?: unknown };
      if (parsed && parsed.version === 2 && parsed.files && parsed.rules) return parsed;
    }
  } catch { /* a bad or old save starts the sample shop */ }
  return Sim.fresh();
}
function keepShop(s: Shop) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode keeps the session only */ }
}
function saveText(text: string, name: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function parse(hash: string) {
  const h = hash.replace(/^#/, "");
  if (!h) return { page: "organize", id: "" };
  if (["login", "setup", "organize", "browse", "rules", "activity", "settings", "licence"].includes(h)) return { page: h, id: "" };
  if (h === "plan" || h.startsWith("plan/")) return { page: "plan", id: h.slice(5) };
  if (h.startsWith("run/")) return { page: "run", id: decodeURIComponent(h.slice(4)) };
  return { page: "error", id: "" };
}
function themeNow(): "light" | "dark" {
  try {
    const t = localStorage.getItem("fo-theme");
    if (t === "light" || t === "dark") return t;
  } catch { /* fall through to the OS */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function undoNote(state: string) {
  if (state === "interrupted") return "This run stopped before it finished. Undo puts back what was applied.";
  if (state === "partially_undone") return "Undo did not finish. Files marked left are still at the new path because the original path was not free. Clear that path, then retry undo.";
  if (state === "journal_damaged") return "The undo log has damaged lines. Undo will recover what it still can.";
  return "";
}
function undoButton(state: string) {
  if (state === "undone") return "";
  if (state === "partially_undone") return "Retry undo";
  if (state === "interrupted" || state === "journal_damaged") return "Undo / recover this run";
  return "Undo this run";
}
function runLink(state: string) {
  if (state === "partially_undone") return "retry undo";
  if (state === "interrupted" || state === "journal_damaged") return "undo / recover";
  if (state === "undone" || state === "failed") return "see why";
  return "";
}
function whatText(run: Run) {
  return (run.intent === "copy" ? "Copied" : "Moved") + " " + run.done + " files, " + run.skipped + " skipped";
}

type Act = { s: Shop; setS: (s: Shop) => void; setFlash: (f: Flash) => void; go: (h: string) => void; Sim: SimApi };

export default function App() {
  const Sim = window.GMAOrganizerSim as SimApi | undefined;
  if (!Sim) return <p className="fo-app" style={{ padding: 16 }}>The File Organizer demo did not load. Reload the page.</p>;
  return <ShopApp Sim={Sim} />;
}

function ShopApp({ Sim }: { Sim: SimApi }) {
  const [s, setS] = useState<Shop>(() => loadShop(Sim));
  const [flash, setFlash] = useState<Flash>(null);
  const [ribbon, setRibbon] = useState("");
  const [hash, setHash] = useState(() => window.location.hash || (loadShop(Sim).signedIn ? "#organize" : "#login"));
  const [theme, setTheme] = useState(themeNow);
  const [intent, setIntent] = useState<"move" | "copy">("move");
  const [backup, setBackup] = useState(true);
  const [filter, setFilter] = useState("all");
  const [browseFor, setBrowseFor] = useState<"source" | "dest">("source");
  const [browseAt, setBrowseAt] = useState(Sim.INBOX);
  const [browseBack, setBrowseBack] = useState("#organize");
  const route = parse(hash);
  const page = !s.signedIn && route.page !== "setup" ? "login" : route.page;

  useEffect(() => { keepShop(s); }, [s]);
  useEffect(() => {
    const on = () => setHash(window.location.hash || "#organize");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => { try { if (!localStorage.getItem("fo-theme")) setTheme(mq.matches ? "dark" : "light"); } catch { /* ignore */ } };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [hash]);

  function go(h: string) {
    if (window.location.hash !== h) window.location.hash = h;
    else setHash(h);
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("fo-theme", next); } catch { /* the toggle still applies for this visit */ }
    document.documentElement.setAttribute("data-theme", next);
    setTheme(next);
  }
  function resetDemo() {
    const n = Sim.reset(s, Date.now());
    setS(n);
    setIntent("move");
    setBackup(true);
    setFilter("all");
    setRibbon("Sample shop restored. Nothing on your computer was changed.");
    setFlash(null);
    if (n.signedIn) go("#organize");
  }
  function openBrowse(which: "source" | "dest", back: string) {
    const start = which === "source" ? s.source : s.dest;
    const listing = Sim.listDir(s, start);
    setBrowseFor(which);
    setBrowseBack(back);
    setBrowseAt(listing.missing ? "C:\\" : start);
    setFlash(null);
    go("#browse");
  }
  function take(r: Result, href?: string) {
    if (!r.ok) { setFlash({ kind: "error", text: r.error || "That did not work." }); return; }
    setS(r.state);
    if (r.message) setFlash({ kind: "ok", text: r.message });
    if (href && href.startsWith("#plan/")) setFilter("all");
    if (href) go(href);
  }
  useEffect(() => {
    if (!window.location.hash) window.location.hash = s.signedIn ? "#organize" : "#login";
  }, [s.signedIn]);

  const showFrame = s.signedIn && page !== "login" && page !== "setup";
  const showSteps = ["organize", "browse", "rules", "plan", "run"].includes(page);
  const step = page === "rules" ? 2 : page === "plan" ? 3 : page === "run" ? 4 : 1;
  const plan = s.plans.find((p) => String(p.id) === route.id) || s.plans[0];
  const run = s.runs.find((r) => r.id === route.id);

  function stepHref(n: number) {
    if (n === 1) return "#organize";
    if (n === 2) return "#rules";
    if (n === 3) return s.plans[0] ? "#plan/" + s.plans[0].id : "#organize";
    if (s.runs[0]) return "#run/" + encodeURIComponent(s.runs[0].id);
    if (s.plans[0]) return "#plan/" + s.plans[0].id;
    return "#organize";
  }

  return (
    <div className="fo-app">
      <a className="fo-skip" href="#work">Skip to the workspace</a>
      <Ribbon s={s} setS={setS} Sim={Sim} ribbon={ribbon} setRibbon={setRibbon} onReset={resetDemo} />
      <header className="fo-top">
        <div className="fo-brand"><b>Granite Models Automations</b><span>Built for the trades.</span></div>
        <h1 className="fo-title">File Organizer</h1>
        <div className="fo-top-r">
          <button type="button" className="fo-link" title="Switch light or dark" onClick={toggleTheme}>Light / dark</button>
          {showFrame && <span className="fo-user">{s.user}</span>}
          {showFrame && <button type="button" className="fo-link" onClick={() => { setS(Sim.signOut(s)); setFlash(null); go("#login"); }}>Log out</button>}
        </div>
      </header>
      {showFrame ? (
        <div className="fo-body">
          <nav className="fo-nav" aria-label="File Organizer">
            {NAV.map(([id, label]) => (
              <a key={id} href={"#" + id} aria-current={page === id ? "page" : undefined} onClick={() => setFlash(null)}>{label}</a>
            ))}
          </nav>
          <main id="work" className="fo-main">
            {showSteps && (
              <ol className="fo-steps" aria-label="Steps">
                {["1 Add files or folder", "2 Set rules", "3 Preview plan", "4 Apply (or export)"].map((label, i) => (
                  <li key={label}><a href={stepHref(i + 1)} className={step === i + 1 ? "on" : ""} aria-current={step === i + 1 ? "step" : undefined} onClick={() => setFlash(null)}>{label}</a></li>
                ))}
              </ol>
            )}
            {s.readonly && <p className="fo-banner">Read-only: no licence is installed. Preview and export work; Apply is turned off.</p>}
            {flash && <p className={"fo-flash " + flash.kind} role="status">{flash.text}</p>}
            {page === "organize" && <Organize s={s} setS={setS} setFlash={setFlash} go={go} Sim={Sim} openBrowse={() => openBrowse("source", "#organize")} take={take} />}
            {page === "browse" && <Browse s={s} setS={setS} Sim={Sim} at={browseAt} setAt={setBrowseAt} which={browseFor} back={browseBack} go={go} />}
            {page === "rules" && <Rules s={s} setS={setS} setFlash={setFlash} go={go} Sim={Sim} take={take} />}
            {page === "plan" && (plan ? <PlanPage s={s} setS={setS} Sim={Sim} plan={plan} intent={intent} setIntent={setIntent} backup={backup} setBackup={setBackup} filter={filter} setFilter={setFilter} openBrowse={() => openBrowse("dest", "#plan/" + plan.id)} take={take} go={go} setFlash={setFlash} /> : <Missing text="That plan is not in this demo." />)}
            {page === "run" && (run ? <RunPage s={s} Sim={Sim} run={run} take={take} /> : <Missing text="That run is not in this demo." />)}
            {page === "activity" && <Activity s={s} Sim={Sim} />}
            {page === "settings" && <Settings s={s} Sim={Sim} take={take} />}
            {page === "licence" && <Licence s={s} Sim={Sim} />}
            {page === "error" && <Missing text="That page is not in File Organizer." />}
          </main>
        </div>
      ) : (
        <main id="work" className="fo-gate">
          <Gate mode={page === "setup" ? "setup" : "login"} onSignIn={(user) => {
            setS(Sim.signIn(s, user));
            const wanted = window.location.hash;
            const name = parse(wanted).page;
            go(!wanted || name === "login" || name === "setup" ? "#organize" : wanted);
          }} go={go} />
        </main>
      )}
      <footer className="fo-foot">
        <p>GMA File Organizer {Sim.VERSION} - runs on this PC only; nothing is hosted.</p>
        <p>Demo: runs in your browser with sample files.</p>
      </footer>
    </div>
  );
}

function Ribbon({ s, setS, Sim, ribbon, setRibbon, onReset }: { s: Shop; setS: (s: Shop) => void; Sim: SimApi; ribbon: string; setRibbon: (t: string) => void; onReset: () => void }) {
  return (
    <div className="fo-ribbon">
      <a href="/">Back to Demo Lab</a>
      <p className="fo-ribbon-warn">DEMO - sample files only. Nothing on your computer is read, moved or changed.</p>
      <button type="button" className="fo-text" onClick={onReset}>Reset demo</button>
      <details className="fo-tools">
        <summary>Demo-only tools (not in the installed program)</summary>
        <div className="fo-tools-row">
          <label className="fo-btn">Try your own file names (names only)
            <input className="fo-sr" type="file" multiple onChange={(e) => {
              const list = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified }));
              const r = Sim.addNames(s, list, Date.now());
              setS(r.state);
              setRibbon(r.message || "");
              e.target.value = "";
            }} />
          </label>
          <label><input type="checkbox" checked={s.readonly} onChange={(e) => { setS(Sim.setReadonly(s, e.target.checked)); setRibbon(e.target.checked ? "Read-only mode is on. Apply is turned off." : "Read-only mode is off."); }} /> See read-only mode</label>
          <label><input type="checkbox" checked={s.demoSkip} onChange={(e) => { setS(Sim.setDemoSkip(s, e.target.checked)); setRibbon(e.target.checked ? "The next Apply skips the first ticked file: changed since the preview." : "Apply will take every ticked file."); }} /> Simulate: a file changed since the preview</label>
          <label><input type="checkbox" checked={!!s.blockerPath} onChange={(e) => { const r = Sim.setBlocker(s, e.target.checked, Date.now()); setS(r.state); setRibbon(r.ok ? (r.message || "") : (r.error || "")); }} /> Simulate: a new file now sits at the original name</label>
        </div>
      </details>
      {ribbon && <p className="fo-ribbon-note" role="status">{ribbon}</p>}
    </div>
  );
}

function Gate({ mode, onSignIn, go }: { mode: "login" | "setup"; onSignIn: (user: string) => void; go: (h: string) => void }) {
  const [user, setUser] = useState("demo");
  const [pw, setPw] = useState("sample-shop-1");
  const [again, setAgain] = useState("sample-shop-1");
  const [err, setErr] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!user.trim()) { setErr("Type a user name."); return; }
    if (mode === "setup") {
      if (pw.length < 12) { setErr("Use a password of at least 12 characters."); return; }
      if (pw !== again) { setErr("Those passwords do not match."); return; }
    } else if (!pw) { setErr("Type a password."); return; }
    onSignIn(user.trim());
  }
  return (
    <form className="fo-card" onSubmit={submit}>
      <h2>{mode === "setup" ? "First-run setup" : "Sign in"}</h2>
      {mode === "setup" && <p>Create the administrator for this shop. There are no default accounts; choose your own password of at least 12 characters.</p>}
      <label className="fo-field"><span>User name</span><input className="fo-inp" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" /></label>
      <label className="fo-field"><span>{mode === "setup" ? "Password (12 characters or more)" : "Password"}</span><input className="fo-inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" /></label>
      {mode === "setup" && <label className="fo-field"><span>Password again</span><input className="fo-inp" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="off" /></label>}
      {err && <p className="fo-note bad" role="alert">{err}</p>}
      <p className="fo-note">Demo: no password is stored. This only opens the sample shop.</p>
      <div className="fo-row">
        <button className="fo-btn primary" type="submit">{mode === "setup" ? "Create administrator" : "Sign in"}</button>
        {mode === "login" ? <button type="button" className="fo-link" onClick={() => go("#setup")}>First-run setup</button> : <button type="button" className="fo-link" onClick={() => go("#login")}>Already set up? Sign in</button>}
      </div>
    </form>
  );
}

function Organize({ s, setS, Sim, openBrowse, take }: Act & { openBrowse: () => void; take: (r: Result, href?: string) => void }) {
  const k = Sim.kpis(s);
  const counts = Sim.ruleCounts(s.rules);
  function scan(e: FormEvent) {
    e.preventDefault();
    const r = Sim.scan(s, { folder: s.source, subfolders: s.subfolders, now: Date.now() });
    take(r, r.ok ? "#plan/" + r.planId : undefined);
  }
  return (
    <>
      {Sim.isExampleJobs(s.rules) && (
        <div className="fo-call">
          <p>Add your job numbers and destination folders in Rules so we know where your files belong.</p>
          <a className="fo-btn" href="#rules">Add a job rule</a>
        </div>
      )}
      <form className="fo-card" onSubmit={scan}>
        <h2>1 Add files or folder</h2>
        <label className="fo-field"><span>Folder on this PC with the files to sort</span>
          <input className="fo-inp fo-path" value={s.source} placeholder="C:\Jobs\Inbox" onChange={(e) => setS(Sim.setSource(s, e.target.value))} spellCheck={false} />
        </label>
        <label className="fo-check"><input type="checkbox" checked={s.subfolders} onChange={(e) => setS(Sim.setSubfolders(s, e.target.checked))} /> Include subfolders</label>
        <div className="fo-row">
          <button type="button" className="fo-link" onClick={openBrowse}>Browse folders</button>
          <button className="fo-btn primary" type="submit">Scan and plan</button>
        </div>
        <p className="fo-note">Only file names, sizes and dates are read. Nothing moves until you apply a plan.</p>
      </form>
      <section className="fo-card">
        <h2>2 Rules in use</h2>
        <dl className="fo-kv">
          <dt>Jobs</dt><dd>{counts.jobs}</dd>
          <dt>Doc types</dt><dd>{counts.types}</dd>
          <dt>Vendors</dt><dd>{counts.vendors}</dd>
          <dt>New name</dt><dd>Date_Job_Type_Vendor in Job/Type folders</dd>
          <dt>Date</dt><dd>{s.rules.useFileDate ? "from the file name, else the file's own date (flagged)" : "from the file name only"}</dd>
          <dt>Unclear files</dt><dd>_Needs review (never guessed)</dd>
          <dt>Copies</dt><dd>_Duplicates</dd>
        </dl>
        <a className="fo-btn" href="#rules">Edit rules</a>
      </section>
      <section className="fo-card">
        <h2>Recent plans</h2>
        {s.plans.length === 0 ? <p className="fo-empty">- no plans yet - scan a folder first</p> : (
          <ul className="fo-plans">{s.plans.map((p) => <li key={p.id}><a href={"#plan/" + p.id}>Plan {p.id} - {p.rows.length} files - {p.source} ({Sim.utc(p.when)})</a></li>)}</ul>
        )}
      </section>
      <div className="fo-kpis">
        <Tile label="Files scanned" value={k.scanned} empty="not scanned yet" />
        <Tile label="Ready (ok)" value={k.ok} empty="not scanned yet" />
        <Tile label="Check" value={k.check} empty="not scanned yet" />
        <Tile label="Needs review" value={k.review} empty="not scanned yet" />
        <Tile label="Duplicates" value={k.duplicate} empty="not scanned yet" />
        <Tile label="Organised (undoable)" value={k.organised || null} empty="nothing applied" />
      </div>
    </>
  );
}

function Tile({ label, value, empty }: { label: string; value: number | null; empty: string }) {
  return <div className="fo-kpi"><span>{label}</span><b>{value == null ? "-" : value}</b>{value == null && <small>{empty}</small>}</div>;
}

function Browse({ s, setS, Sim, at, setAt, which, back, go }: { s: Shop; setS: (s: Shop) => void; Sim: SimApi; at: string; setAt: (p: string) => void; which: "source" | "dest"; back: string; go: (h: string) => void }) {
  const listing = Sim.listDir(s, at);
  const up = Sim.parent(listing.path);
  return (
    <section className="fo-card">
      <h2>Choose a folder on this PC</h2>
      <p>Current: <span className="fo-path">{listing.path || "C:\\"}</span></p>
      {listing.reason && <p className="fo-note bad">{listing.reason}</p>}
      <div className="fo-row">
        <button type="button" className="fo-btn" disabled={!up} onClick={() => up && setAt(up)}>Up one level</button>
        <button type="button" className="fo-btn primary" disabled={!listing.usable} onClick={() => { setS(which === "dest" ? Sim.setDest(s, listing.path) : Sim.setSource(s, listing.path)); go(back); }}>Use this folder</button>
      </div>
      <ul className="fo-dirs">
        {listing.dirs.map((d) => <li key={d}><button type="button" onClick={() => setAt(d)}>{Sim.base(d)}</button></li>)}
      </ul>
      <p className="fo-note">{listing.fileCount} files in this folder</p>
    </section>
  );
}

function Rules({ s, setS, setFlash, Sim, take }: Act & { take: (r: Result, href?: string) => void }) {
  const [draft, setDraft] = useState(s.rules);
  const [job, setJob] = useState("");
  const [words, setWords] = useState("");
  const [jobErr, setJobErr] = useState("");
  useEffect(() => { setDraft(s.rules); }, [s.savedRulesAt]); // eslint-disable-line react-hooks/exhaustive-deps -- reset only when a save, restore or Reset demo commits rules
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.rules);
  function addJob(e: FormEvent) {
    e.preventDefault();
    const hit = Sim.checkJob(job, words, draft.jobs);
    if (hit.error || !hit.line) { setJobErr(hit.error || "Type a job folder name."); return; }
    setDraft({ ...draft, jobs: draft.jobs.trim() ? draft.jobs.replace(/\s*$/, "") + "\n" + hit.line : hit.line });
    setJob(""); setWords(""); setJobErr("Added to the list below. Save rules to keep it.");
  }
  function save(e: FormEvent) {
    e.preventDefault();
    take(Sim.saveRules(s, draft, Date.now()));
  }
  function scanAgain() {
    if (dirty) { setFlash({ kind: "error", text: "Save rules first. Rules apply to the next scan." }); return; }
    const r = Sim.scan(s, { now: Date.now() });
    take(r, r.ok ? "#plan/" + r.planId : undefined);
  }
  return (
    <>
      {s.plans.length > 0 && (
        <div className="fo-call">
          <p>Rules apply to the next scan. Scan {s.plans[0].source} again.</p>
          <button type="button" className="fo-btn" onClick={scanAgain}>Scan again</button>
        </div>
      )}
      <form className="fo-card" onSubmit={addJob}>
        <h2>Add a job rule</h2>
        <label className="fo-field"><span>Job folder name (the folder its files go to)</span><input className="fo-inp" value={job} placeholder="J2417 SmithRailing" onChange={(e) => setJob(e.target.value)} /></label>
        <label className="fo-field"><span>Words found in its file names (job number, customer), separated by commas</span><input className="fo-inp" value={words} placeholder="2417, smith railing" onChange={(e) => setWords(e.target.value)} /></label>
        {jobErr && <p className={jobErr.startsWith("Added") ? "fo-note" : "fo-note bad"} role="status">{jobErr}</p>}
        <button className="fo-btn" type="submit">Add this job</button>
        {Sim.isExampleJobs(draft) && <p className="fo-note">The jobs below are only examples. Replace them with your job numbers and the words that show up in the file names.</p>}
      </form>
      <form className="fo-card" onSubmit={save}>
        <h2>Rules</h2>
        <label className="fo-field"><span>Jobs. One job per line: Folder name = words found in file names</span><textarea className="fo-area" rows={5} value={draft.jobs} onChange={(e) => setDraft({ ...draft, jobs: e.target.value })} spellCheck={false} /></label>
        <label className="fo-field"><span>Doc types. Type = words, or extensions such as .dwg</span><textarea className="fo-area" rows={6} value={draft.types} onChange={(e) => setDraft({ ...draft, types: e.target.value })} spellCheck={false} /></label>
        <label className="fo-field"><span>Vendors. Vendor = words (photos and drawings need no vendor)</span><textarea className="fo-area" rows={4} value={draft.vendors} onChange={(e) => setDraft({ ...draft, vendors: e.target.value })} spellCheck={false} /></label>
        <h2>Dates and names</h2>
        <label className="fo-check"><input type="checkbox" checked={draft.useFileDate} onChange={(e) => setDraft({ ...draft, useFileDate: e.target.checked })} /><span>{'If the name has no date, use the file\'s own date (and flag it "check")'}</span></label>
        <label className="fo-field"><span>Date separator in new names</span>
          <select className="fo-sel" value={draft.dateSep} onChange={(e) => setDraft({ ...draft, dateSep: e.target.value })}>
            {DATE_SEPS.map(([v, label]) => <option key={label} value={v}>{label}</option>)}
          </select>
        </label>
        <p className="fo-note">The new name is the date, job, type and vendor, joined with underscores. This separator is the mark between the year, month and day. Photos and drawings do not need a vendor.</p>
        <div className="fo-row" style={{ marginTop: 8 }}><button className="fo-btn primary" type="submit">Save rules</button></div>
      </form>
      <p><button type="button" className="fo-btn" onClick={() => take(Sim.restoreExamples(s, Date.now()))}>Restore the example rules</button></p>
    </>
  );
}

function PlanPage({ s, setS, Sim, plan, intent, setIntent, backup, setBackup, filter, setFilter, openBrowse, take, setFlash }: Act & {
  plan: Plan; intent: "move" | "copy"; setIntent: (v: "move" | "copy") => void; backup: boolean; setBackup: (v: boolean) => void;
  filter: string; setFilter: (v: string) => void; openBrowse: () => void; take: (r: Result, href?: string) => void;
}) {
  const shown = plan.rows.filter((r) => filter === "all" || r.status === filter);
  const ticked = shown.filter((r) => r.ticked);
  const allOn = shown.length > 0 && ticked.length === shown.length;
  const counts = { ok: 0, check: 0, review: 0, duplicate: 0 };
  plan.rows.forEach((r) => { if (r.status in counts) counts[r.status as keyof typeof counts]++; });
  const noJob = plan.rows.length > 0 && plan.rows.every((r) => !r.job);
  function ticks(keys: string[], on: boolean) { setS(Sim.setTicks(s, plan.id, keys, on)); }
  function apply() {
    const r = Sim.apply(s, { planId: plan.id, keys: ticked.map((row) => row.key), intent, backup: intent === "move" && backup, dest: s.dest, now: Date.now() });
    take(r, r.ok ? "#run/" + encodeURIComponent(r.runId || "") : undefined);
  }
  function exportCsv() {
    const file = Sim.planCsv(plan);
    saveText(file.text, file.filename, "text/csv;charset=utf-8");
    setS(Sim.logExport(s, plan.id, Date.now()));
    setFlash({ kind: "ok", text: "Exported the plan (CSV)." });
  }
  return (
    <>
      {noJob && (
        <div className="fo-call">
          <p>None of these files matched a job, so each one is waiting in &quot;_Needs review&quot;. Add a job rule, then scan again.</p>
          <a className="fo-btn" href="#rules">Add a job rule</a>
        </div>
      )}
      <section className="fo-card">
        <h2>Source</h2>
        <dl className="fo-kv">
          <dt>Folder</dt><dd className="fo-path">{plan.source} <span className="fo-sample">(sample)</span></dd>
          <dt>Subfolders</dt><dd>{plan.subfolders ? "included" : "not included"}</dd>
          <dt>Files planned</dt><dd>{plan.rows.length}</dd>
          <dt>Skipped</dt><dd>{plan.skipped.length}</dd>
          <dt>Scanned</dt><dd>{Sim.utc(plan.when)} by {plan.who}</dd>
        </dl>
        <div className="fo-row">
          <button type="button" className="fo-btn" onClick={() => { const r = Sim.scan(s, { folder: plan.source, subfolders: plan.subfolders, now: Date.now() }); take(r, r.ok ? "#plan/" + r.planId : undefined); }}>Scan again</button>
          <button type="button" className="fo-btn" onClick={exportCsv}>Export plan (CSV)</button>
        </div>
      </section>
      <section className="fo-card">
        <h2>4 Apply</h2>
        <label className="fo-field"><span>Destination folder (Job/Type folders are made inside it)</span>
          <input className="fo-inp fo-path" value={s.dest} placeholder="C:\Jobs\Organised" onChange={(e) => setS(Sim.setDest(s, e.target.value))} spellCheck={false} />
        </label>
        <button type="button" className="fo-link" onClick={openBrowse}>Browse folders</button>
        <div className="fo-row" style={{ marginTop: 8 }}>
          <label className="fo-check"><input type="radio" name="intent" checked={intent === "move"} onChange={() => { setIntent("move"); setBackup(true); }} /> Move</label>
          <label className="fo-check"><input type="radio" name="intent" checked={intent === "copy"} onChange={() => { setIntent("copy"); setBackup(false); }} /> Copy (originals stay)</label>
        </div>
        <label className="fo-check"><input type="checkbox" checked={intent === "move" && backup} disabled={intent === "copy"} onChange={(e) => setBackup(e.target.checked)} /> Back up each file before moving</label>
        <button type="button" className="fo-btn primary" disabled={s.readonly || ticked.length === 0} onClick={apply}>Apply ticked files</button>
        <p className="fo-note">Never overwrites and never deletes; every run can be undone from Activity.</p>
        {s.readonly && <p className="fo-note bad">Apply is turned off: read-only licence. Preview and export still work.</p>}
      </section>
      <section className="fo-card">
        <h2>3 Preview plan</h2>
        <div className="fo-filters">
          {([["all", "All " + plan.rows.length], ["ok", "ok " + counts.ok], ["check", "check " + counts.check], ["review", "needs review " + counts.review], ["duplicate", "duplicate " + counts.duplicate]] as [string, string][]).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        {filter !== "all" && <p className="fo-note">Only the files shown are sent to Apply. Choose &quot;All&quot; to apply every ticked file.</p>}
        <div className="fo-scroll">
          <table className="fo-table">
            <caption className="fo-sr">Preview plan</caption>
            <thead><tr>
              <th><input type="checkbox" aria-label="Select all shown files" checked={allOn} ref={(el) => { if (el) el.indeterminate = ticked.length > 0 && !allOn; }} onChange={(e) => ticks(shown.map((r) => r.key), e.target.checked)} /></th>
              <th>Status</th><th>File now</th><th>New folder</th><th>New name</th><th>Date</th><th>Why</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td><input type="checkbox" aria-label={"Select " + r.original} checked={r.ticked} onChange={(e) => ticks([r.key], e.target.checked)} /></td>
                  <td><span className={"fo-chip " + r.status}>{STATUS[r.status] || r.status}</span></td>
                  <td>{r.original}</td>
                  <td className="fo-path">{r.folder}</td>
                  <td className="fo-path">{r.newName}</td>
                  <td>{r.date}{r.dateSource === "file date" ? " (file date)" : ""}</td>
                  <td>{r.flags.join("; ")}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={7} className="fo-empty">No files in this view.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className="fo-card">
        <h2>Skipped while scanning</h2>
        {plan.skipped.length === 0 ? <p className="fo-empty">Nothing was skipped.</p> : (
          <table className="fo-table"><thead><tr><th>Item</th><th>Why</th></tr></thead><tbody>
            {plan.skipped.map((sk) => <tr key={sk.item}><td>{sk.item}</td><td>{sk.why}</td></tr>)}
          </tbody></table>
        )}
      </section>
    </>
  );
}

function RunPage({ s, Sim, run, take }: { s: Shop; Sim: SimApi; run: Run; take: (r: Result) => void }) {
  const label = undoButton(run.state);
  const note = undoNote(run.state);
  return (
    <>
      <section className="fo-card">
        <h2>Run {run.id}</h2>
        <dl className="fo-kv">
          <dt>What</dt><dd>{whatText(run)}</dd>
          <dt>From</dt><dd className="fo-path">{run.from}</dd>
          <dt>To</dt><dd className="fo-path">{run.to}</dd>
          <dt>Backup copies</dt><dd>{run.backup ? "yes, " + run.backupRoot + "\\" + run.id : "no"}</dd>
          <dt>When</dt><dd>{Sim.utc(run.when)}</dd>
          <dt>State</dt><dd>{run.state}</dd>
          <dt>Undo log</dt><dd>kept with this run</dd>
        </dl>
      </section>
      <section className="fo-card">
        <h2>Undo</h2>
        {note && <p className="fo-note bad">{note}</p>}
        {run.state === "undone" && <p>This run was undone.</p>}
        <p className="fo-note">A move is put back where it came from. A copy is set aside in _Undone {run.id}.</p>
        <div className="fo-row">
          {label && <button type="button" className="fo-btn primary" onClick={() => take(Sim.undo(s, run.id, Date.now()))}>{label}</button>}
          <button type="button" className="fo-btn" onClick={() => { const file = Sim.undoDownload(run); saveText(file.text, file.filename, "application/json"); }}>Download undo log (JSON)</button>
        </div>
      </section>
      <section className="fo-card">
        <h2>File by file</h2>
        <div className="fo-scroll">
          <table className="fo-table">
            <thead><tr><th>Step</th><th>Result</th><th>From</th><th>To</th><th>Note</th></tr></thead>
            <tbody>{run.files.map((f) => (
              <tr key={f.step}><td>{f.step}</td><td><span className={"fo-chip " + f.result}>{f.result}</span></td><td className="fo-path">{f.from}</td><td className="fo-path">{f.to}</td><td>{f.note}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Activity({ s, Sim }: { s: Shop; Sim: SimApi }) {
  return (
    <>
      <section className="fo-card">
        <h2>Runs (each one can be undone)</h2>
        {s.runs.length === 0 ? <p className="fo-empty">No runs yet. Apply a plan and it will show up here.</p> : (
          <div className="fo-scroll"><table className="fo-table">
            <thead><tr><th>Run</th><th>When</th><th>Who</th><th>What</th><th>From</th><th>To</th><th>State</th></tr></thead>
            <tbody>{s.runs.map((run) => {
              const href = "#run/" + encodeURIComponent(run.id);
              const extra = runLink(run.state);
              return <tr key={run.id}><td><a href={href}>{run.id}</a>{extra && <> <a href={href}>{extra}</a></>}</td><td>{Sim.utc(run.when)}</td><td>{run.who}</td><td>{whatText(run)}</td><td className="fo-path">{run.from}</td><td className="fo-path">{run.to}</td><td>{run.state}</td></tr>;
            })}</tbody>
          </table></div>
        )}
      </section>
      <section className="fo-card">
        <h2>Activity log</h2>
        {s.log.length === 0 ? <p className="fo-empty">No activity yet.</p> : (
          <div className="fo-scroll"><table className="fo-table">
            <thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>{s.log.map((row, i) => <tr key={row.at + "-" + i}><td>{Sim.utc(row.at)}</td><td>{row.who}</td><td>{row.action}</td><td>{row.detail}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

function Settings({ s, Sim, take }: { s: Shop; Sim: SimApi; take: (r: Result) => void }) {
  const [folder, setFolder] = useState(s.backupFolder);
  useEffect(() => { setFolder(s.backupFolder); }, [s.backupFolder]);
  return (
    <>
      <section className="fo-card">
        <h2>Change password</h2>
        <label className="fo-field"><span>Current</span><input className="fo-inp" type="password" value="" disabled autoComplete="off" /></label>
        <label className="fo-field"><span>New (12 characters or more)</span><input className="fo-inp" type="password" value="" disabled autoComplete="off" /></label>
        <label className="fo-field"><span>New password again</span><input className="fo-inp" type="password" value="" disabled autoComplete="off" /></label>
        <button type="button" className="fo-btn" disabled>Change password</button>
        <p className="fo-note">Not in this demo. No password is stored.</p>
      </section>
      <form className="fo-card" onSubmit={(e) => { e.preventDefault(); take(Sim.saveBackup(s, folder, Date.now())); }}>
        <h2>Backup before move</h2>
        <label className="fo-field"><span>{"Backup folder (empty = <data>\\backups)"}</span>
          <input className="fo-inp fo-path" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder={Sim.BACKUPS} spellCheck={false} />
        </label>
        <button className="fo-btn primary" type="submit">Save backup folder</button>
        <p className="fo-note">Used only when you move. A copy does not write a backup. Empty uses {Sim.BACKUPS}.</p>
      </form>
      <section className="fo-card">
        <h2>This installation</h2>
        <dl className="fo-kv">
          <dt>Data folder</dt><dd className="fo-path">{Sim.DATA} <span className="fo-sample">(sample)</span></dd>
          <dt>Version</dt><dd>{Sim.VERSION}</dd>
          <dt>Network</dt><dd>none - answers on 127.0.0.1 only</dd>
        </dl>
      </section>
    </>
  );
}

function Licence({ s, Sim }: { s: Shop; Sim: SimApi }) {
  const rows: [string, string][] = s.readonly
    ? [["Status", "read-only"], ["Detail", "No licence is installed."], ["Company", "—"], ["Plan", "—"], ["Issued", "—"], ["Renews / expires", "—"], ["Grace ends", "—"], ["Licence file", "none"]]
    : [["Status", "valid"], ["Detail", "Sample licence for this demo shop."], ["Company", "Demo Shop (sample)"], ["Plan", "annual"], ["Issued", "2026-01-15"], ["Renews / expires", "2027-01-15"], ["Grace ends", "—"], ["Licence file", Sim.DATA + "\\licence.json (sample)"]];
  return (
    <>
      <section className="fo-card">
        <h2>Licence</h2>
        <dl className="fo-kv">{rows.map(([k, v]) => <span key={k} style={{ display: "contents" }}><dt>{k}</dt><dd className={k === "Licence file" ? "fo-path" : undefined}>{v}</dd></span>)}</dl>
      </section>
      <section className="fo-card">
        <h2>What the licence controls</h2>
        <p>The licence is a file that comes with the installer. There is nowhere to type a key.</p>
        <p>With no valid licence the program is read-only. Preview and export still work. Apply is turned off. Files already on the PC are not deleted.</p>
        <p>A missed payment has 14 days of grace. After that the program stays read-only until it is paid. Once it is paid off, it is yours.</p>
      </section>
    </>
  );
}

function Missing({ text }: { text: string }) {
  return <section className="fo-card"><h2>404</h2><p>{text}</p><a className="fo-btn" href="#organize">Back to Organize</a></section>;
}
