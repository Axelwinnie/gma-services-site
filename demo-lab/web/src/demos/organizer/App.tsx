/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import Shell, { PROJECTS } from "../../shell/Shell";
import { Badge, Btn, Field, Icon, Kpi, Menu, Panel, SearchBox, Toggle, useToast } from "../../shell/ui";
import { NOTE, csv, json, pdf, save, xlsx } from "../../shell/files";
import { keep, load, wipe } from "../../shell/store";

const O = window.GMAOrganizer, SAMPLE = window.GMAOrganizerSamples;
type F = { name: string; size: number; lastModified: number };
type Log = { at: number; kind: "ok" | "warn" | "info"; text: string };
type St = { files: F[]; rules: { jobs: string; types: string; vendors: string }; off: string[]; edits: Record<string, { newName?: string; folder?: string }>; picked: string[]; extraFolders: string[]; log: Log[]; previewed: boolean; organized: number; useFileDate: boolean };
const now = () => Date.now();
const fresh = (): St => ({ files: SAMPLE.map((x: F) => ({ ...x })), rules: { ...O.DEFAULT_RULES }, off: [], edits: {}, picked: SAMPLE.map((x: F, i: number) => i + "|" + x.name), extraFolders: [], log: [{ at: now(), kind: "info", text: `Sample project data loaded (${SAMPLE.length} files).` }, { at: now(), kind: "info", text: "Rules loaded." }], previewed: false, organized: 0, useFileDate: true });
const LABEL: Record<string, [string, string]> = { ok: ["ready", "green"], check: ["check", "yellow"], review: ["needs review", "red"], duplicate: ["copy?", "purple"], edited: ["edited", "blue"] };
const kb = (n: number) => (n > 1e6 ? (n / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1e3)) + " KB");
const extOf = (n: string) => (/\.([a-z0-9]+)$/i.exec(n)?.[1] || "").toUpperCase();

export default function App() {
  const [s, setS] = useState<St>(() => load("organizer", fresh));
  const [project, setProject] = useState(() => load("project", () => "J2041"));
  const [q, setQ] = useState(""); const [show, setShow] = useState(""); const [logF, setLogF] = useState(""); const [rulesOpen, setRulesOpen] = useState(false);
  const [draft, setDraft] = useState(s.rules); const [folder, setFolder] = useState(""); const [folderBad, setFolderBad] = useState(""); const [openDirs, setOpenDirs] = useState<Record<string, boolean>>({});
  const [allPrev, setAllPrev] = useState(false);
  const { say, node } = useToast();
  useEffect(() => { keep("organizer", s); }, [s]);
  const put = (o: Partial<St> | ((x: St) => Partial<St>)) => setS((x) => ({ ...x, ...(typeof o === "function" ? o(x) : o), previewed: "previewed" in (typeof o === "function" ? {} : o) ? (o as any).previewed : false }));
  const log = (kind: Log["kind"], text: string) => (x: St) => ({ log: [...x.log, { at: now(), kind, text }] });

  const typeRules = O.parseRules(s.rules.types);
  const rows = useMemo(() => {
    const types = s.rules.types.split("\n").filter((l: string) => !s.off.includes(l.split("=")[0].trim())).join("\n");
    return O.plan(s.files, { ...s.rules, types }, { useFileDate: s.useFileDate }).map((r: any, i: number) => {
      const key = i + "|" + r.original, e = s.edits[key];
      if (e) { if (e.newName) r.newName = e.newName; if (e.folder) r.folder = e.folder; r.path = r.folder + "/" + r.newName; r.status = "edited"; }
      return { ...r, key, picked: s.picked.includes(key) };
    });
  }, [s.files, s.rules, s.off, s.edits, s.picked, s.useFileDate]);
  const sel = rows.filter((r: any) => r.picked);
  const shown = rows.filter((r: any) => (!show || (show === "flagged" ? !["ok", "edited"].includes(r.status) : r.status === show)) && (!q || `${r.original} ${r.newName} ${r.folder} ${r.type}`.toLowerCase().includes(q.toLowerCase())));
  const folders = Array.from(new Set([...rows.map((r: any) => r.folder), ...s.extraFolders])).sort((a, b) => (a[0] === "_" ? 1 : 0) - (b[0] === "_" ? 1 : 0) || a.localeCompare(b));
  const tagged = rows.length ? Math.round((100 * rows.filter((r: any) => r.type).length) / rows.length) : 0;
  const conflicts = sel.filter((r: any) => r.status === "review" || r.status === "duplicate").length;
  const tree = useMemo(() => { const t: Record<string, Record<string, number>> = {}; folders.forEach((f) => { const [a, b] = f.split("/"); t[a] = t[a] || {}; if (b) t[a][b] = t[a][b] || 0; }); rows.forEach((r: any) => { const [a, b] = r.folder.split("/"); if (b) t[a][b]++; else t[a][""] = (t[a][""] || 0) + 1; }); return t; }, [rows, folders]);

  const addFiles = (list: FileList) => { const add = Array.from(list).map((f) => ({ name: f.name, size: f.size, lastModified: f.lastModified })); put((x) => ({ files: [...x.files, ...add], picked: [...x.picked, ...add.map((f, i) => x.files.length + i + "|" + f.name)], ...log("info", `Added ${add.length} file name(s). File contents were not read.`)(x) })); say(`Added ${add.length} file(s). Only the names are used.`); };
  const preview = () => { if (!sel.length) { say("Select at least one file first.", true); return; } setS((x) => ({ ...x, previewed: true, ...log(conflicts ? "warn" : "ok", `Preview completed. ${sel.length} files categorized, ${conflicts} need review.`)(x) })); say(`Preview ready: ${sel.length} files, ${conflicts} need review.`); };
  const organize = () => {
    if (!sel.length) { say("Select at least one file first.", true); return; }
    if (!s.previewed) { say("Preview the changes first, then run the organization.", true); return; }
    const z = [{ name: "rename-plan.csv", data: O.toCsv(sel) }, { name: "README.txt", data: "Folder layout from the GMA Demo Lab File Organizer.\r\nEvery file in here is an empty placeholder. Your real files were never read or included.\r\nrename-plan.csv shows which original goes where.\r\n" }, ...sel.map((r: any) => ({ name: "organized/" + r.path, data: "" }))];
    save(window.GMAZip.zip(z), "organized-folders.zip");
    setS((x) => ({ ...x, organized: x.organized + sel.length, log: [...x.log, ...sel.slice(0, 40).map((r: any) => ({ at: now(), kind: (r.status === "review" || r.status === "duplicate" ? "warn" : "ok") as Log["kind"], text: `${r.original} -> ${r.path}` })), { at: now(), kind: "ok", text: `Organization run: ${sel.length} files placed, folder layout downloaded.` }] }));
    say(`Organized ${sel.length} files. Downloaded the folder layout as a zip.`);
  };
  const ex = (k: string) => {
    const head = ["Original", "New name", "Folder", "Status", "Job", "Type", "Vendor", "Date", "Flags"], body = sel.map((r: any) => [r.original, r.newName, r.folder, r.status, r.job, r.type, r.vendor, r.date, r.flags.join("; ")]);
    if (k === "csv") save(new Blob([O.toCsv(sel)], { type: "text/csv" }), "rename-plan.csv");
    if (k === "xlsx") save(xlsx([{ name: "Rename plan", rows: [[NOTE], [], head, ...body] }]), "rename-plan.xlsx");
    if (k === "json") save(json({ note: NOTE, rules: s.rules, disabled_rules: s.off, files: sel }), "rename-plan.json");
    if (k === "pdf") save(pdf("File Organizer rename plan", [{ lines: [`${sel.length} files, ${conflicts} need review.`] }, { table: [head.slice(0, 4), ...body.map((r: unknown[]) => r.slice(0, 4))] }]), "rename-plan.pdf");
    say("Downloaded the " + k.toUpperCase() + " rename plan.");
  };
  const edit = (key: string, o: { newName?: string; folder?: string }) => put((x) => ({ edits: { ...x.edits, [key]: { ...x.edits[key], ...o } } }));

  return (
    <Shell demo="organizer" kicker="File organizer" title="File Organizer" sub="Organize, rename and route project files with rules. Review the suggestions, make changes, and run the organization. Saved in this browser until you reset."
      project={project} onProject={(id) => { setProject(id); keep("project", id); const p = PROJECTS.find((x) => x.id === id)!; setQ(p.name.split(" ")[0].toLowerCase()); say("Filtered to " + p.name + " (sample)."); }} toast={node}
      actions={<>
        <div className="chip"><Icon n="box" /><div><b>Sample data loaded</b><small>{s.files.length} files, {PROJECTS.find((p) => p.id === project)!.name}</small></div></div>
        <Btn icon="reset" onClick={() => { wipe("organizer"); const n = fresh(); setS(n); setDraft(n.rules); setQ(""); setShow(""); say("Demo reset."); }}>Reset Demo</Btn>
        <Menu kind="ghost" icon="download" label="Export Plan" items={[["Excel (.xlsx)", () => ex("xlsx")], ["PDF", () => ex("pdf")], ["CSV", () => ex("csv")], ["JSON", () => ex("json")]]} />
        <Btn kind="primary" icon="play" onClick={organize}>Run Organization</Btn>
      </>}>
      <div className="kpis" style={{ ["--n" as string]: 4 }}>
        <Kpi label="Incoming files" value={sel.length} sub={`of ${rows.length} selected to organize`} icon="folder" />
        <Kpi label="Destination folders" value={new Set(sel.map((r: any) => r.folder)).size} sub="From your rules" icon="folder" tone="orange" />
        <Kpi label="Auto-tagging" value={tagged + "%"} sub="Files with a doc type from the rules" icon="tag" tone="orange" />
        <Kpi label="Ready to run" value={s.previewed ? "Preview checked" : "Not previewed"} sub={s.previewed ? (conflicts ? `${conflicts} need review` : "No conflicts detected") : `${s.organized} organized so far`} icon="bolt" tone={s.previewed && !conflicts ? "green" : "orange"} />
      </div>
      <div className="g-org">
        <Panel n="01" title="Project Folders" sub="Destination structure for organized files" className="flush">
          <div className="tree">
            {Object.keys(tree).map((a) => <div key={a}>
              <button type="button" className="dir" aria-expanded={openDirs[a] !== false} onClick={() => setOpenDirs({ ...openDirs, [a]: openDirs[a] === false })}><span>{openDirs[a] === false ? "▸" : "▾"}</span><Icon n="folder" />{a}</button>
              {openDirs[a] !== false && Object.entries(tree[a]).filter(([b]) => b).map(([b, n]) => <button key={b} type="button" className={`sub${q === a + "/" + b ? " on" : ""}`} onClick={() => setQ(q === a + "/" + b ? "" : a + "/" + b)}><Icon n="folder" />{b}<span className="mut">{n}</span></button>)}
            </div>)}
          </div>
          <form className="addf" noValidate onSubmit={(e) => { e.preventDefault(); const v = folder.trim().replace(/^\/+|\/+$/g, ""); if (!v) { setFolderBad("Type a folder name, like J2041-PineHollow/Submittals."); return; } if (folders.includes(v)) { setFolderBad(v + " already exists."); return; } setFolderBad(""); setFolder(""); put((x) => ({ extraFolders: [...x.extraFolders, v], ...log("info", "Folder added: " + v)(x) })); say("Folder added. Pick it as a destination in the file list."); }}>
            <input className={`inp${folderBad ? " bad" : ""}`} aria-invalid={!!folderBad} aria-label="New folder" placeholder="Job/Folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
            <Btn type="submit" className="btn sm" icon="plus">Folder</Btn>
          </form>
          {folderBad && <p className="err" style={{ margin: "0 10px 10px" }} role="alert">{folderBad}</p>}
        </Panel>

        <Panel n="02" title="Incoming Files" sub="Review and adjust how files will be organized" className="flush"
          tools={<><SearchBox value={q} onChange={setQ} placeholder="Search files by name, type or folder" />
            <select className="inp" style={{ width: 130 }} aria-label="Show" value={show} onChange={(e) => setShow(e.target.value)}><option value="">All files</option><option value="flagged">Flagged only</option><option value="ok">Ready</option><option value="check">Check</option><option value="review">Needs review</option><option value="duplicate">Copies</option><option value="edited">Edited</option></select>
            <label className="btn btn-blue"><Icon n="plus" />Add Files<input type="file" multiple className="sr-only" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} /></label></>}>
          <div className="tw ftab"><table className="t">
            <thead><tr><th><input type="checkbox" aria-label="Select all" checked={sel.length === rows.length && rows.length > 0} onChange={(e) => put({ picked: e.target.checked ? rows.map((r: any) => r.key) : [] })} /></th><th>File name</th><th>Type</th><th className="n">Size</th><th>Detected</th><th>Match</th><th>Destination</th><th>New filename</th><th></th></tr></thead>
            <tbody>{shown.map((r: any) => <tr key={r.key}>
              <td><input type="checkbox" aria-label={"Select " + r.original} checked={r.picked} onChange={(e) => put((x) => ({ picked: e.target.checked ? [...x.picked, r.key] : x.picked.filter((k) => k !== r.key) }))} /></td>
              <td className="fn"><span className={`fi ft-${extOf(r.original).toLowerCase()}`}>{extOf(r.original).slice(0, 4)}</span><span title={r.original}>{r.original}</span></td>
              <td className="mut">{extOf(r.original)}</td><td className="n mut">{kb(r.size)}</td>
              <td>{r.type ? <Badge tone="blue">{r.type}</Badge> : <span className="mut">Unknown</span>}</td>
              <td><Badge tone={LABEL[r.status][1]}>{LABEL[r.status][0]}</Badge>{r.flags.length > 0 && <div className="mut small why" title={r.flags.join(". ")}>{r.flags[0]}</div>}</td>
              <td><select className="inp" aria-label={"Destination for " + r.original} value={r.folder} onChange={(e) => edit(r.key, { folder: e.target.value })}>{Array.from(new Set([r.folder, ...folders])).map((f) => <option key={f}>{f}</option>)}</select></td>
              <td><input className="inp" aria-label={"New name for " + r.original} defaultValue={r.newName} key={r.newName} onBlur={(e) => { const v = e.target.value.trim(); if (!v) { e.target.value = r.newName; say("A file name can't be blank.", true); return; } if (v !== r.newName) edit(r.key, { newName: v }); }} /></td>
              <td>{s.edits[r.key] && <button type="button" className="btn btn-quiet" title="Undo my edit" aria-label={"Undo edit for " + r.original} onClick={() => put((x) => { const e = { ...x.edits }; delete e[r.key]; return { edits: e }; })}><Icon n="reset" /></button>}</td>
            </tr>)}{!shown.length && <tr><td colSpan={9} className="empty">No files match. Add files or clear the search.</td></tr>}</tbody>
          </table></div>
          <div className="pager"><span>{sel.length} of {rows.length} files selected</span><div className="row"><label className="chk"><input type="checkbox" checked={s.useFileDate} onChange={(e) => put({ useFileDate: e.target.checked })} /> Use file date when the name has none</label><Btn kind="blue" icon="play" onClick={preview}>Preview Changes</Btn></div></div>
        </Panel>

        <div className="g-col">
          <Panel n="03" title="Organization Rules" sub="Define how files are classified and routed" tools={<Btn className="btn sm" icon="gear" onClick={() => { setDraft(s.rules); setRulesOpen(!rulesOpen); }}>{rulesOpen ? "Close" : "Manage Rules"}</Btn>} className="flush">
            {rulesOpen ? <div className="pb">
              {(["types", "jobs", "vendors"] as const).map((k) => <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)}: Name = keyword, keyword`}><textarea className="inp mono" rows={k === "types" ? 5 : 3} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} spellCheck={false} /></Field>)}
              <div className="row" style={{ marginTop: 8 }}>
                <Btn kind="primary" onClick={() => { const bad = (["types", "jobs", "vendors"] as const).filter((k) => !O.parseRules(draft[k]).length); if (bad.length) { say("Each rule list needs at least one line like Invoice = inv, bill. Check " + bad.join(", ") + ".", true); return; } put((x) => ({ rules: draft, ...log("info", "Rules saved: " + O.parseRules(draft.types).length + " type rules.")(x) })); setRulesOpen(false); say("Rules saved and applied. Your manual edits were kept."); }}>Save rules</Btn>
                <Btn onClick={() => setDraft({ ...O.DEFAULT_RULES })}>Defaults</Btn>
              </div></div> :
              <ul className="rules">{typeRules.map((r: any) => { const on = !s.off.includes(r.key); return <li key={r.key} style={{ opacity: on ? 1 : 0.5 }}>
                <span className="fi ft-rule">{r.key.slice(0, 3).toUpperCase()}</span><b>{r.key}</b><span className="kw" title={r.words.join(", ")}>{r.words.slice(0, 3).join(", ")}</span><span className="mut small">Job/{r.key}</span>
                <Toggle label={`${r.key} rule`} on={on} onChange={(v) => put((x) => ({ off: v ? x.off.filter((k) => k !== r.key) : [...x.off, r.key], ...log("info", `${r.key} rule ${v ? "on" : "off"}.`)(x) }))} /></li>; })}</ul>}
          </Panel>
          <Panel n="04" title="Output Preview" sub={s.previewed ? "How the selected files will be organized" : "Run Preview Changes to check the plan"} className="flush">
            {s.previewed ? <><table className="t"><thead><tr><th>New filename</th><th>Destination</th><th>Action</th></tr></thead>
              <tbody>{sel.slice(0, allPrev ? 999 : 5).map((r: any) => <tr key={r.key}><td className="small" title={r.newName}>{r.newName}</td><td className="small mut">{r.folder}</td><td><Badge tone={r.status === "duplicate" ? "purple" : r.status === "review" ? "red" : r.newName === r.original ? "gray" : "green"}>{r.status === "duplicate" ? "Hold" : r.status === "review" ? "Review" : r.newName === r.original ? "Move" : "Rename"}</Badge></td></tr>)}</tbody></table>
              {sel.length > 5 && <button type="button" className="lnk more" onClick={() => setAllPrev(!allPrev)}>{allPrev ? "Show fewer" : `Show all ${sel.length} changes`}</button>}</> : <p className="empty">Nothing previewed yet.</p>}
          </Panel>
        </div>
      </div>
      <Panel n="05" title="Automation Activity" sub="Live log of organizer actions" className="flush" tools={<><select className="inp" style={{ width: 130 }} aria-label="Log filter" value={logF} onChange={(e) => setLogF(e.target.value)}><option value="">All events</option><option value="ok">Success</option><option value="warn">Warnings</option><option value="info">Info</option></select><Btn className="btn sm" onClick={() => setS((x) => ({ ...x, log: [] }))}>Clear Log</Btn></>}>
        <ul className="log">{s.log.filter((l) => !logF || l.kind === logF).slice().reverse().map((l, i) => <li key={i}><time>[{new Date(l.at).toLocaleTimeString()}]</time><span className={l.kind}>{l.text}</span></li>)}{!s.log.length && <li className="mut">Log is empty.</li>}</ul>
      </Panel>
    </Shell>
  );
}
