import { DragEvent, useEffect, useRef, useState } from "react";
import { keep, load, wipe } from "../../shell/store";
import {
  ACCEPT_ATTR, ACCEPTED, DOC, FOLDERS, HOURS_OPEN, LEADS, LICENCE_ROWS, PAGES, WHERE,
  docLabel, fieldsFor, freshItems, isToday, keptWhere, listFor, whenLabel, whereLabel,
  type Bucket, type Fields, type Item, type PageId,
} from "./data";

type Flash = { text: string; kind: "ok" | "bad" } | null;
type Save = { version: 2; items: Item[] };

function pageOf(hash: string): PageId {
  const part = hash.replace(/^#/, "").toLowerCase();
  return (PAGES as string[]).includes(part) ? (part as PageId) : "inbox";
}

function loadItems(): Item[] {
  const saved = load<Save | null>("processor", () => null);
  if (!saved || saved.version !== 2 || !Array.isArray(saved.items)) return freshItems();
  return saved.items;
}

export default function App() {
  const [items, setItems] = useState<Item[]>(loadItems);
  const [page, setPage] = useState<PageId>(() => pageOf(window.location.hash));
  const [selected, setSelected] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(() => fieldsFor(null));
  const [flash, setFlash] = useState<Flash>(null);
  const [hot, setHot] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const item = items.find((row) => row.key === selected) || null;
  const [title, lead] = LEADS[page];

  useEffect(() => { keep("processor", { version: 2, items }); }, [items]);
  useEffect(() => {
    const on = () => setPage(pageOf(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => { document.title = title + " — File Processor"; }, [title]);
  useEffect(() => { setFlash(null); }, [page]);

  function select(key: string) {
    const next = items.find((row) => row.key === key) || null;
    setSelected(key);
    setFields(fieldsFor(next));
  }
  function patch(key: string, change: Partial<Item>) {
    setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }
  function takeFiles(list: FileList | null) {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    const ok = chosen.filter((file) => ACCEPTED.test(file.name));
    if (!ok.length) {
      setFlash({ text: "That file was not accepted. Use PDF, Word, Excel, a drawing, or a picture.", kind: "bad" });
      return;
    }
    const added: Item[] = ok.map((file) => ({
      key: "upload:" + Math.random().toString(36).slice(2, 10),
      bucket: "review",
      name: file.name,
      state: "Needs you",
      where: "Not chosen yet",
      whereKey: "",
      when: new Date().toISOString(),
      kind: "upload",
      docType: "unknown",
      project: "",
      jobNumber: "",
      notes: "",
      note: "Dropped today. Check it before it goes out.",
    }));
    setItems((rows) => [...added, ...rows]);
    setFlash({ text: "Held for you to check. Open Review.", kind: "ok" });
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setHot(false);
    takeFiles(e.dataTransfer.files);
  }
  function send(row: Item) {
    patch(row.key, {
      bucket: "filed",
      state: "Sent",
      where: whereLabel(fields.whereKey),
      whereKey: fields.whereKey,
      docType: fields.docType,
      project: fields.project,
      jobNumber: fields.jobNumber,
      notes: fields.notes,
      when: new Date().toISOString(),
      note: "",
    });
    setSelected(null);
    setFlash({ text: "Sent on.", kind: "ok" });
  }
  function keepHere(row: Item) {
    const kept = keptWhere();
    patch(row.key, {
      bucket: "filed",
      state: "Kept here",
      where: kept.where,
      whereKey: kept.whereKey,
      docType: fields.docType,
      project: fields.project,
      jobNumber: fields.jobNumber,
      notes: fields.notes,
      when: new Date().toISOString(),
      note: "",
    });
    setSelected(null);
    setFlash({ text: "Kept in this shop.", kind: "ok" });
  }
  function returnInbox(row: Item) {
    patch(row.key, { bucket: "inbox", state: "Waiting", where: "In this shop", whereKey: "", when: new Date().toISOString() });
    setSelected(null);
    setFlash({ text: "Back in the inbox. Demo only — nothing on this PC was moved.", kind: "ok" });
  }
  function reset() {
    wipe("processor");
    setItems(freshItems());
    setSelected(null);
    setFields(fieldsFor(null));
    setFlash(null);
    if (window.location.hash !== "#inbox") window.location.hash = "inbox";
    else setPage("inbox");
  }

  const counts: Record<Bucket, number> = {
    inbox: items.filter((row) => row.bucket === "inbox").length,
    review: items.filter((row) => row.bucket === "review").length,
    filed: items.filter((row) => row.bucket === "filed").length,
  };
  const feed = listFor(items, "inbox").concat(listFor(items, "review"), listFor(items, "filed")).slice(0, 30);

  return (
    <>
      <a className="skip" href="#work">Skip to the work</a>
      <div className="demo-ribbon">
        <a href="/">Back to Demo Lab</a>
        <p>Sample files only. Nothing is sent to a server.</p>
        <button type="button" onClick={reset}>Reset demo</button>
      </div>
      <div className="shop" data-screen={page}>
        <aside className="panel-nav">
          <div className="brand">
            <b>GMA</b>
            <strong>File Processor</strong>
            <span>Sends files to your other programs. Runs on this PC.</span>
          </div>
          <nav className="nav" aria-label="File Processor">
            {PAGES.map((id) => (
              <a key={id} href={"#" + id} aria-current={page === id ? "page" : undefined}>
                {LEADS[id][0]}
                {id === "inbox" || id === "review" || id === "filed" ? <span className="count" id={"count-" + id}>{counts[id]}</span> : null}
              </a>
            ))}
          </nav>
          <p className="pc-note on" id="pc-note"><span className="dot"></span><span id="pc-text">Running on this PC</span></p>
        </aside>

        <main className="panel-work" id="work">
          <p className="kicker">Granite Models Automations</p>
          <h1 id="screen-title">{title}</h1>
          <p className="lead" id="screen-lead">{lead}</p>
          {flash && <p className={"flash " + flash.kind} id="flash" role="status">{flash.text}</p>}

          <section className="screen screen-inbox" aria-label="Inbox">
            <div className={"drop" + (hot ? " hot" : "")} id="drop"
              onDragOver={(e) => { e.preventDefault(); setHot(true); }}
              onDragLeave={() => setHot(false)}
              onDrop={onDrop}>
              <strong>Drop files here</strong>
              <p>PDF, Word, Excel, drawings, and pictures. Each file is held for you to check.</p>
              <button type="button" className="btn" id="browse" onClick={() => inputRef.current?.click()}>Choose files</button>
              <input id="file-input" ref={inputRef} type="file" multiple hidden accept={ACCEPT_ATTR}
                onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
            </div>
            <FileList id="list-inbox" rows={listFor(items, "inbox")} selected={selected} onSelect={select} />
          </section>

          <section className="screen screen-review" aria-label="Review">
            <FileList id="list-review" rows={listFor(items, "review")} selected={selected} onSelect={select} />
          </section>

          <section className="screen screen-filed" aria-label="Filed">
            <FileList id="list-filed" rows={listFor(items, "filed")} selected={selected} onSelect={select} />
          </section>

          <section className="screen screen-activity" aria-label="Activity">
            <div className="stats" id="stats">
              <Stat label="Arrived today" value={items.filter((row) => isToday(row.when)).length} />
              <Stat label="Finished" value={counts.filed} />
              <Stat label="Need a look" value={counts.review} />
              <Stat label="Hours open" value={HOURS_OPEN} />
            </div>
            <div className="feed" id="feed">
              {feed.length === 0 ? <div className="empty">No activity yet.</div> : feed.map((row) => (
                <p key={row.key}><time>{whenLabel(row.when)}</time>{row.name} — {row.state}</p>
              ))}
            </div>
          </section>

          <section className="screen screen-settings" aria-label="Settings">
            <div id="settings-body">
              <div className="card">
                <h2>Folders</h2>
                <dl className="kv">
                  {FOLDERS.map(([k, v]) => <span key={k} style={{ display: "contents" }}><dt>{k}</dt><dd className="path">{v}</dd></span>)}
                </dl>
              </div>
              <div className="card">
                <h2>Programs a file can go to</h2>
                <ul>
                  <li>Takeoff</li>
                  <li>Documents</li>
                  <li>Bookkeeping</li>
                  <li>Or keep it in this shop</li>
                </ul>
                <p>File Processor does not replace those programs. It sends the file to the one you pick.</p>
              </div>
              <div className="card">
                <h2>Files it will take</h2>
                <p>PDF, Word, Excel, DWG, DXF, and pictures (JPG, PNG, TIFF).</p>
              </div>
            </div>
          </section>

          <section className="screen screen-licence" aria-label="Licence">
            <div className="card">
              <h2>On this PC</h2>
              <div id="licence-body">
                <dl className="kv">
                  {LICENCE_ROWS.map(([k, v]) => <span key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></span>)}
                </dl>
              </div>
            </div>
            <div className="card">
              <h2>What this does</h2>
              <p>The licence is a file that comes with the install. There is nowhere to type a key.</p>
              <p>With no licence in force you can still open Inbox, Review, Filed, and Activity and look at work already here. Sending a file to another program, and filing a new one from this screen, stays off. Files already here are left where they are.</p>
              <p className="demo-note">This replica does not install a licence file.</p>
            </div>
          </section>
        </main>

        <aside className="panel-detail" id="detail" aria-label="Selected file">
          <h2>This file</h2>
          <div id="detail-body">
            {!item ? <p className="meta">Pick a file to see where it is going.</p> : (
              <>
                <b>{item.name}</b>
                <p className="meta">{item.state}</p>
                <dl className="kv">
                  <dt>Where</dt><dd>{item.where}</dd>
                  <dt>Kind of file</dt><dd>{docLabel(item.docType)}</dd>
                  {item.project ? <><dt>Project</dt><dd>{item.project}</dd></> : null}
                  {item.jobNumber ? <><dt>Job</dt><dd>{item.jobNumber}</dd></> : null}
                  {item.when ? <><dt>When</dt><dd>{whenLabel(item.when)}</dd></> : null}
                </dl>
                {item.note ? <p className="meta">{item.note}</p> : null}
                {item.kind === "upload" && item.bucket === "review" && (
                  <>
                    <label className="field"><span>Kind of file</span>
                      <select id="f-type" value={fields.docType} onChange={(e) => setFields({ ...fields, docType: e.target.value })}>
                        {Object.entries(DOC).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>Project</span>
                      <input id="f-project" value={fields.project} onChange={(e) => setFields({ ...fields, project: e.target.value })} />
                    </label>
                    <label className="field"><span>Job number</span>
                      <input id="f-job" value={fields.jobNumber} onChange={(e) => setFields({ ...fields, jobNumber: e.target.value })} />
                    </label>
                    <label className="field"><span>Note</span>
                      <input id="f-notes" value={fields.notes} onChange={(e) => setFields({ ...fields, notes: e.target.value })} />
                    </label>
                    <label className="field"><span>Send it to</span>
                      <select id="f-where" value={fields.whereKey} onChange={(e) => setFields({ ...fields, whereKey: e.target.value })}>
                        {Object.entries(WHERE).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </select>
                    </label>
                    <div className="row-actions">
                      <button type="button" className="btn" data-act="send" onClick={() => send(item)}>Send to that program</button>
                      <button type="button" className="ghost" data-act="keep" onClick={() => keepHere(item)}>Keep in this shop</button>
                    </div>
                  </>
                )}
                {item.bucket === "filed" && (
                  <>
                    <p className="meta">Demo only. Puts this sample file back in the inbox so you can try again.</p>
                    <div className="row-actions">
                      <button type="button" className="ghost" onClick={() => returnInbox(item)}>Return to inbox</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function FileList({ id, rows, selected, onSelect }: { id: string; rows: Item[]; selected: string | null; onSelect: (key: string) => void }) {
  if (!rows.length) return <div className="list" id={id}><div className="empty">Nothing here yet.</div></div>;
  return (
    <div className="list" id={id}>
      {rows.map((row) => (
        <button type="button" key={row.key} className={"file" + (row.key === selected ? " on" : "")} onClick={() => onSelect(row.key)}>
          <b>{row.name}</b>
          <div className="meta">{row.state} · {row.where}{row.when ? " · " + whenLabel(row.when) : ""}</div>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}
