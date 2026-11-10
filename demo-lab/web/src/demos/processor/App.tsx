import { FormEvent, useEffect, useState } from "react";
import Shell, { PROJECTS } from "../../shell/Shell";
import { Btn, useToast } from "../../shell/ui";
import { keep, load, wipe } from "../../shell/store";
import {
  DESTINATIONS, PAGES, destLabel, fresh, stamp, statusLabel,
  type ActivityRow, type DestId, type PageId, type ShopFile, type ShopState,
} from "./data";

const PAGE_TITLE: Record<PageId, string> = {
  inbox: "Inbox", review: "Review", filed: "Filed", activity: "Activity", settings: "Settings", licence: "Licence",
};

function pageOf(hash: string): PageId {
  const id = hash.replace(/^#/, "") as PageId;
  return PAGES.some((p) => p.id === id) ? id : "inbox";
}

function loadState(): ShopState {
  const saved = load<ShopState | null>("processor", () => null);
  if (!saved || saved.version !== 1 || !Array.isArray(saved.files) || !saved.settings) return fresh();
  return saved;
}

function initialProject() {
  const id = load("project", () => "J2041");
  return PROJECTS.some((p) => p.id === id) ? id : "J2041";
}

export default function App() {
  const [state, setState] = useState<ShopState>(loadState);
  const [project, setProject] = useState(initialProject);
  const [page, setPage] = useState<PageId>(() => pageOf(window.location.hash));
  const [choice, setChoice] = useState<DestId>(() => {
    const s = loadState();
    const f = s.files.find((x) => x.id === s.selectedId);
    return f?.destination || f?.suggested || "takeoff";
  });
  const [confirming, setConfirming] = useState(false);
  const { say, node } = useToast();

  useEffect(() => { keep("processor", state); }, [state]);
  useEffect(() => {
    const on = () => setPage(pageOf(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { document.title = `${PAGE_TITLE[page]} | File Processor | GMA Demo Lab`; }, [page]);
  useEffect(() => {
    if (page !== "review") return;
    const current = state.files.find((f) => f.id === state.selectedId);
    if (current && current.status === "review" && current.jobId === project) return;
    const next = state.files.find((f) => f.status === "review" && f.jobId === project);
    if (!next) return;
    setChoice(next.destination || next.suggested);
    setConfirming(false);
    setState((s) => (s.selectedId === next.id ? s : { ...s, selectedId: next.id }));
  }, [page, project, state.selectedId, state.files]);

  const jobName = PROJECTS.find((p) => p.id === project)?.name ?? "this job";
  const inJob = (f: ShopFile) => f.jobId === project;
  const selected = state.files.find((f) => f.id === state.selectedId) ?? null;
  const counts = {
    inbox: state.files.filter((f) => f.status === "inbox" && inJob(f)).length,
    review: state.files.filter((f) => f.status === "review" && inJob(f)).length,
    filed: state.files.filter((f) => f.status === "filed" && inJob(f)).length,
  };

  function go(id: PageId) {
    const next = "#" + id;
    if (window.location.hash !== next) window.location.hash = next;
    else setPage(id);
  }
  function select(id: string) {
    const f = state.files.find((x) => x.id === id);
    setState({ ...state, selectedId: id });
    if (f) setChoice(f.destination || f.suggested);
    setConfirming(false);
  }
  function log(action: string, detail: string, base: ShopState): ActivityRow[] {
    return [{ at: stamp(), action, detail }, ...base.activity];
  }
  function openReview(id: string) {
    const f = state.files.find((x) => x.id === id);
    if (!f) return;
    if (f.status === "inbox") {
      setState({
        ...state,
        selectedId: id,
        files: state.files.map((x) => (x.id === id ? { ...x, status: "review" } : x)),
        activity: log("Opened for review", f.name, state),
      });
      say(f.name + " is in Review. Pick where it goes, then send it. Nothing leaves this browser.");
    } else {
      select(id);
    }
    setChoice(f.destination || f.suggested);
    setConfirming(false);
    go("review");
  }
  function send(f: ShopFile) {
    const label = destLabel(choice);
    setState({
      ...state,
      selectedId: f.id,
      files: state.files.map((x) => (x.id === f.id ? { ...x, status: "filed", destination: choice, filedAt: stamp() } : x)),
      activity: log("Sent", `${f.name} to ${label}`, state),
    });
    setConfirming(false);
    say(`Sent ${f.name} to ${label}. Sample only. Nothing left this browser.`);
    go("filed");
  }
  function onSend(e: FormEvent, f: ShopFile) {
    e.preventDefault();
    if (state.settings.ask && !confirming) { setConfirming(true); return; }
    send(f);
  }
  function returnToInbox(f: ShopFile) {
    setState({
      ...state,
      selectedId: f.id,
      files: state.files.map((x) => (x.id === f.id ? { ...x, status: "inbox", destination: null, filedAt: null } : x)),
      activity: log("Returned to the inbox", f.name, state),
    });
    setChoice(f.suggested);
    say(f.name + " is back in the inbox.");
    go("inbox");
  }
  function reset() {
    wipe("processor");
    const next = fresh();
    setState(next);
    const f = next.files.find((x) => x.id === next.selectedId);
    setChoice(f?.suggested || "takeoff");
    setConfirming(false);
    go("inbox");
    say("Demo reset. Sample files are back. Nothing on your computer was changed.");
  }

  return (
    <Shell demo="processor" kicker="Sends files on" title="File Processor"
      sub="Sends files to your other programs. This replica runs in the browser on sample files from Pine Hollow Storage, Cedar Run Stair and Mill Pond Canopy. Nothing is sent."
      project={project} onProject={(id) => { setProject(id); keep("project", id); say("Sample job: " + (PROJECTS.find((p) => p.id === id)?.name ?? id) + "."); }}
      toast={node}
      actions={<Btn icon="reset" onClick={reset}>Reset Demo</Btn>}>
      <div className="fp">
        <header className="fp-brand">
          <div className="fp-mark">GMA</div>
          <div>
            <h2>File Processor</h2>
            <p className="fp-tag">Sends files to your other programs. Runs on this PC.</p>
          </div>
          <span className="fp-chip">Sample files</span>
        </header>
        <div className="fp-grid">
          <nav className="fp-nav" aria-label="File Processor">
            {PAGES.map((p) => (
              <a key={p.id} href={"#" + p.id} aria-current={page === p.id ? "page" : undefined} onClick={() => setConfirming(false)}>
                {p.label}
                {p.id === "inbox" || p.id === "review" || p.id === "filed" ? <span className="fp-ct">{counts[p.id]}</span> : null}
              </a>
            ))}
          </nav>
          <main className="fp-work" aria-label="Work">
            {page === "inbox" && <Inbox files={state.files.filter((f) => f.status === "inbox" && inJob(f))} selectedId={state.selectedId} jobName={jobName} onSelect={select} onReview={openReview} />}
            {page === "review" && <Review files={state.files.filter((f) => f.status === "review" && inJob(f))} selected={selected && inJob(selected) ? selected : null} jobName={jobName} choice={choice} setChoice={(id) => { setChoice(id); setConfirming(false); }} confirming={confirming} ask={state.settings.ask} onSubmit={onSend} onCancel={() => setConfirming(false)} onSelect={select} />}
            {page === "filed" && <Filed files={state.files.filter((f) => f.status === "filed" && inJob(f))} selectedId={state.selectedId} jobName={jobName} onSelect={select} onReturn={returnToInbox} />}
            {page === "activity" && <Activity rows={state.activity} />}
            {page === "settings" && <Settings state={state} setState={setState} />}
            {page === "licence" && <Licence shopName={state.settings.shopName} />}
          </main>
          <ThisFile file={selected} jobName={PROJECTS.find((p) => p.id === selected?.jobId)?.name ?? ""} otherJob={!!selected && selected.jobId !== project} onReview={() => selected && openReview(selected.id)} />
        </div>
      </div>
    </Shell>
  );
}

function Inbox({ files, selectedId, jobName, onSelect, onReview }: {
  files: ShopFile[]; selectedId: string; jobName: string; onSelect: (id: string) => void; onReview: (id: string) => void;
}) {
  return (
    <>
      <div>
        <h2>Inbox</h2>
        <p className="fp-lead">Files waiting for {jobName}. Opening one moves it to Review.</p>
      </div>
      {files.length === 0 ? <p className="fp-empty">Nothing is waiting for {jobName}. Reset the demo to bring the sample files back, or pick another sample job.</p> : (
        <div className="fp-card fp-scroll">
          <table className="fp-table">
            <thead><tr><th>File</th><th>Arrived</th><th>Suggested</th><th></th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className={f.id === selectedId ? "on" : ""}>
                  <td><button type="button" className="fp-pick" aria-pressed={f.id === selectedId} onClick={() => onSelect(f.id)}>{f.name}</button></td>
                  <td>{f.arrived}</td>
                  <td>{destLabel(f.suggested)}</td>
                  <td><button type="button" className="fp-btn" onClick={() => onReview(f.id)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Review({ files, selected, jobName, choice, setChoice, confirming, ask, onSubmit, onCancel, onSelect }: {
  files: ShopFile[]; selected: ShopFile | null; jobName: string; choice: DestId; setChoice: (id: DestId) => void;
  confirming: boolean; ask: boolean; onSubmit: (e: FormEvent, f: ShopFile) => void; onCancel: () => void; onSelect: (id: string) => void;
}) {
  const current = selected && selected.status === "review" ? selected : null;
  return (
    <>
      <div>
        <h2>Review</h2>
        <p className="fp-lead">Choose where the file goes, then send it. {jobName}.</p>
      </div>
      {files.length > 0 && (
        <div className="fp-card fp-scroll">
          <table className="fp-table">
            <thead><tr><th>File</th><th>Suggested</th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className={selected?.id === f.id ? "on" : ""}>
                  <td><button type="button" className="fp-pick" aria-pressed={selected?.id === f.id} onClick={() => onSelect(f.id)}>{f.name}</button></td>
                  <td>{destLabel(f.suggested)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!current ? <p className="fp-empty">{files.length ? "Select a file in review." : `Nothing is in review for ${jobName}. Open a file from the inbox.`}</p> : (
        <form className="fp-card" onSubmit={(e) => onSubmit(e, current)}>
          <h3>{current.name}</h3>
          <p className="fp-excerpt">{current.excerpt}</p>
          <fieldset className="fp-dest">
            <legend>Where this file goes</legend>
            {DESTINATIONS.map((d) => (
              <label key={d.id}>
                <input type="radio" name="where" value={d.label} checked={choice === d.id} onChange={() => setChoice(d.id)} />
                <b>{d.label}</b>
                <small>{d.note}</small>
              </label>
            ))}
          </fieldset>
          {confirming ? (
            <div className="fp-confirm">
              <p>Send {current.name} to {destLabel(choice)}? This demo only updates the sample list.</p>
              <div className="fp-row">
                <button className="fp-btn primary" type="submit">Send to {destLabel(choice)}</button>
                <button className="fp-btn" type="button" onClick={onCancel}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="fp-row">
              <button className="fp-btn primary" type="submit">Send this file</button>
            </div>
          )}
          <p className="fp-note">{ask ? "Settings asks before a file leaves Review." : "Ask-before-send is off. Sending updates the sample list immediately."} Nothing is sent to a server.</p>
        </form>
      )}
    </>
  );
}

function Filed({ files, selectedId, jobName, onSelect, onReturn }: {
  files: ShopFile[]; selectedId: string; jobName: string; onSelect: (id: string) => void; onReturn: (f: ShopFile) => void;
}) {
  return (
    <>
      <div>
        <h2>Filed</h2>
        <p className="fp-lead">Files already sent for {jobName}. In this demo, return one to the inbox to try again.</p>
      </div>
      {files.length === 0 ? <p className="fp-empty">Nothing has been sent for {jobName} yet.</p> : (
        <div className="fp-card fp-scroll">
          <table className="fp-table">
            <thead><tr><th>File</th><th>Sent to</th><th>When</th><th></th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} className={f.id === selectedId ? "on" : ""}>
                  <td><button type="button" className="fp-pick" aria-pressed={f.id === selectedId} onClick={() => onSelect(f.id)}>{f.name}</button></td>
                  <td>{destLabel(f.destination)}</td>
                  <td>{f.filedAt}</td>
                  <td><button type="button" className="fp-btn" onClick={() => onReturn(f)}>Return to inbox</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Activity({ rows }: { rows: ActivityRow[] }) {
  return (
    <>
      <div>
        <h2>Activity</h2>
        <p className="fp-lead">What this shop did with the sample files. New times are from this browser.</p>
      </div>
      <div className="fp-card fp-scroll">
        <table className="fp-table">
          <thead><tr><th>When</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={r.at + r.detail + i}><td>{r.at}</td><td>{r.action}</td><td>{r.detail}</td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Settings({ state, setState }: { state: ShopState; setState: (s: ShopState) => void }) {
  const s = state.settings;
  function patch(p: Partial<typeof s>) { setState({ ...state, settings: { ...s, ...p } }); }
  return (
    <>
      <div>
        <h2>Settings</h2>
        <p className="fp-lead">Saved in this browser for the demo. The installed program keeps these on the PC.</p>
      </div>
      <section className="fp-card">
        <h3>This shop</h3>
        <label className="fp-field"><span>Shop name</span>
          <input className="fp-inp" value={s.shopName} onChange={(e) => patch({ shopName: e.target.value })} />
        </label>
        <label className="fp-field"><span>Inbox folder on this PC</span>
          <input className="fp-inp fp-path" value={s.inbox} spellCheck={false} onChange={(e) => patch({ inbox: e.target.value })} />
        </label>
        <label className="fp-check">
          <input type="checkbox" checked={s.ask} onChange={(e) => patch({ ask: e.target.checked })} />
          <span>Ask before a file leaves Review</span>
        </label>
        <p className="fp-note">Sample paths only. This demo does not read a folder on your computer.</p>
      </section>
      <section className="fp-card">
        <h3>Where files go</h3>
        <ul className="fp-list">
          {DESTINATIONS.map((d) => <li key={d.id}><b>{d.label}</b><span>{d.note}</span></li>)}
        </ul>
        <p className="fp-note">Names are the ones the shop sees. Sending stays on this PC.</p>
      </section>
    </>
  );
}

function Licence({ shopName }: { shopName: string }) {
  const rows: [string, string][] = [
    ["Status", "sample"],
    ["Detail", "Sample licence for this demo shop."],
    ["Company", shopName || "Demo Shop (sample)"],
    ["Plan", "own it"],
    ["Issued", "2026-03-01"],
    ["Licence file", "C:\\GMA\\File Processor\\licence.json (sample)"],
  ];
  return (
    <>
      <div>
        <h2>Licence</h2>
        <p className="fp-lead">The licence is a file that comes with the install. There is nowhere to type a key.</p>
      </div>
      <section className="fp-card">
        <h3>This install</h3>
        <dl className="fp-kv">
          {rows.map(([k, v]) => (
            <span key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd className={k === "Licence file" ? "fp-path" : undefined}>{v}</dd>
            </span>
          ))}
        </dl>
      </section>
      <section className="fp-card">
        <h3>What the licence controls</h3>
        <p>The licence is a file that comes with the install. There is nowhere to type a key.</p>
        <p className="fp-note">This demo does not install a licence file and does not ask for one. Sample files stay in the browser.</p>
      </section>
    </>
  );
}

function ThisFile({ file, jobName, otherJob, onReview }: { file: ShopFile | null; jobName: string; otherJob: boolean; onReview: () => void }) {
  return (
    <aside className="fp-file" aria-label="This file">
      <h2>This file</h2>
      {!file ? <p className="fp-empty">No file selected. Pick one from Inbox or Review.</p> : (
        <>
          <p className="fp-name">{file.name}</p>
          <p className={"fp-status " + file.status}>{statusLabel(file.status)}</p>
          {otherJob && <p className="fp-note">This file is on {jobName}, not the sample job selected above.</p>}
          <dl className="fp-kv">
            <dt>Job</dt><dd>{jobName}</dd>
            <dt>Kind</dt><dd>{file.kind} · {file.size}</dd>
            <dt>Arrived</dt><dd>{file.arrived}</dd>
            <dt>Suggested</dt><dd>{destLabel(file.suggested)}</dd>
            {file.destination && <><dt>Sent to</dt><dd>{destLabel(file.destination)}</dd></>}
            {file.filedAt && <><dt>When</dt><dd>{file.filedAt}</dd></>}
            <dt>Path</dt><dd className="fp-path">{file.path} <span className="fp-note">(sample)</span></dd>
          </dl>
          <p className="fp-excerpt">{file.excerpt}</p>
          {file.status === "inbox" && <button type="button" className="fp-btn primary" onClick={onReview}>Review this file</button>}
        </>
      )}
    </aside>
  );
}
