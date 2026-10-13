/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Badge, Btn, Field, Icon, Kpi, Panel, SearchBox, Tabs } from "../../shell/ui";
import { readSmall } from "../../shell/store";
import { JOBS, PRIO_TONE, STATUS_TONE, day, useForm, useT, when } from "./ctx";

const PER = 8;

export function TicketTable({ sel, onSel, full }: { sel: number | null; onSel: (id: number) => void; full?: boolean }) {
  const { s, T } = useT();
  const [q, setQ] = useState(""); const [st, setSt] = useState(""); const [dp, setDp] = useState(""); const [pr, setPr] = useState(""); const [page, setPage] = useState(1);
  const [checked, setChecked] = useState<number[]>([]);
  const rows = s.tickets.filter((t: any) =>
    (!st || (st === "open" ? t.status !== "Done" : t.status === st)) &&
    (!dp || T.dept(s, t.requester) === dp || T.dept(s, t.assignee) === dp) &&
    (!pr || t.priority === pr) &&
    (!q || (`#${t.id} ${t.title} ${t.equipment} ${t.area} ${t.job} ${t.assignee} ${t.requester}`).toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(rows.length / PER)), pg = Math.min(page, pages);
  const shown = full ? rows : rows.slice((pg - 1) * PER, pg * PER);
  return (
    <Panel title="Tool Tickets" sub={`${rows.length} shown of ${s.tickets.length}. View and manage tool requests from the shop floor.`} className="flush"
      tools={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search tickets, jobs or tools" />}>
      <div className="bar-f pad">
        <select aria-label="Status" value={st} onChange={(e) => { setSt(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="open">All open</option>{T.STATUSES.map((x: string) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Department" value={dp} onChange={(e) => { setDp(e.target.value); setPage(1); }}><option value="">All departments</option>{T.DEPTS.map((x: string) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Priority" value={pr} onChange={(e) => { setPr(e.target.value); setPage(1); }}><option value="">All priorities</option>{T.PRIORITIES.map((x: string) => <option key={x}>{x}</option>)}</select>
        {(q || st || dp || pr) && <Btn kind="quiet" icon="x" onClick={() => { setQ(""); setSt(""); setDp(""); setPr(""); }}>Clear filters</Btn>}
      </div>
      <div className="tw">
        <table className="t">
          <thead><tr><th><input type="checkbox" aria-label="Select all on this page" checked={shown.length > 0 && shown.every((t: any) => checked.includes(t.id))} onChange={(e) => setChecked(e.target.checked ? shown.map((t: any) => t.id) : [])} /></th><th>Ticket</th><th>Title / equipment</th><th>Job / area</th><th>Dept</th><th>Assigned to</th><th>Priority</th><th>Status</th><th>Opened</th></tr></thead>
          <tbody>
            {shown.map((t: any) => (
              <tr key={t.id} className={`click${sel === t.id ? " sel" : ""}`} onClick={() => onSel(t.id)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select #${t.id}`} checked={checked.includes(t.id)} onChange={(e) => setChecked((c) => e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id))} /></td>
                <td><button type="button" className="lnk mono" onClick={(e) => { e.stopPropagation(); onSel(t.id); }}>TT-{t.id}</button></td>
                <td><b>{t.title}</b><div className="mut small">{t.equipment || "No crib tool"}</div></td>
                <td>{t.job || t.area}</td>
                <td>{T.dept(s, t.requester)}</td>
                <td>{t.assignee || <span className="mut">Unassigned</span>}</td>
                <td><Badge tone={PRIO_TONE(t.priority)}>{t.priority}</Badge></td>
                <td><Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></td>
                <td className="mut">{day(t.createdAt)}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={9} className="empty">No tickets match those filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>{checked.length} of {rows.length} tickets selected</span>
        {!full && <div className="pg">{Array.from({ length: pages }, (_, i) => <button type="button" key={i} className={pg === i + 1 ? "on" : ""} aria-label={`Page ${i + 1}`} aria-current={pg === i + 1} onClick={() => setPage(i + 1)}>{i + 1}</button>)}</div>}
      </div>
    </Panel>
  );
}

export function Detail({ id, onClose }: { id: number; onClose?: () => void }) {
  const { s, T, me, act, go } = useT();
  const t = T.find(s, id);
  const [tab, setTab] = useState("details");
  const [note, setNote] = useState(""); const [status, setStatus] = useState(t?.status || "New"); const [tagId, setTagId] = useState("");
  const [tagBad, setTagBad] = useState(""); const [edit, setEdit] = useState(false);
  if (!t) return <Panel title="Ticket"><p className="mut">Pick a ticket.</p></Panel>;
  const j = t.jha && T.jha(s, t.jha);
  const lotos = s.lotos.filter((l: any) => l.ticket === t.id), reqs = s.reqs.filter((r: any) => r.ticket === t.id);
  return (
    <section className="panel detail" aria-label={`Ticket ${t.id}`}>
      <header className="ph">
        <div><h2>TT-{t.id} <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge></h2><p>Opened {when(t.createdAt)} by {t.requester}</p></div>
        {onClose && <Btn kind="quiet" icon="x" aria-label="Close ticket" onClick={onClose} />}
      </header>
      <Tabs small value={tab} onChange={setTab} tabs={[["details", "Details"], ["files", `Files (${(t.photos || []).length})`], ["activity", `Activity (${t.log.length})`]]} />
      <div className="pb">
        {tab === "details" && edit && <EditTicket t={t} done={() => setEdit(false)} />}
        {tab === "details" && !edit && <>
          <div className="split"><h3 className="dt">{t.title}</h3>{t.status !== "Done" && <Btn kind="quiet" onClick={() => setEdit(true)}>Edit</Btn>}</div>
          <dl className="kv">
            <dt>Equipment</dt><dd>{t.equipment || "Not a crib tool"}</dd>
            <dt>Where</dt><dd>{t.area}{t.job ? ", " + t.job : ""}</dd>
            <dt>Priority</dt><dd><Badge tone={PRIO_TONE(t.priority)}>{t.priority}</Badge></dd>
            <dt>Department</dt><dd>{T.dept(s, t.requester)}</dd>
            <dt>Assigned</dt><dd>
              <select className="inp" aria-label="Assign to" value={t.assignee} onChange={(e) => e.target.value && act(() => T.assign(s, t.id, e.target.value, me), "Assigned to " + e.target.value + ".")}>
                <option value="">Nobody yet</option>{s.people.map((p: string) => <option key={p}>{p}</option>)}
              </select></dd>
          </dl>
          {t.ncr && <p className="note">From {t.ncr}.</p>}
          {t.jhaRequired && <div className="note">
            <b>JHA required before work starts.</b> {j ? `${j.id} (${j.crew.length ? j.crew.length + " signed on" : "nobody signed on yet"})` : "None linked."}
            <div className="row" style={{ marginTop: 6 }}>
              <select className="inp" aria-label="Link a JHA" value="" onChange={(e) => e.target.value && act(() => T.linkJha(s, t.id, e.target.value, me), "Linked " + e.target.value + ".")}>
                <option value="">Link a JHA...</option>{s.jhas.map((x: any) => <option key={x.id} value={x.id}>{x.id} {x.task}</option>)}
              </select>
              <Btn className="btn sm" onClick={() => go("records:jha")}>Open JHAs</Btn>
            </div>
          </div>}
          {lotos.map((l: any) => <p key={l.id} className="note"><Icon n="lock" /> {l.id} {T.lotoState(l)}. <button className="lnk" type="button" onClick={() => go("records:loto")}>Open LOTO</button></p>)}
          {reqs.map((r: any) => <p key={r.id} className="note">{r.id} {r.item}, {r.status}{r.po ? ", PO " + r.po : ""}.</p>)}
          <div className="tagbox">
            <span className="mut small">{(t.tags || []).length ? "Tagged out on this ticket:" : "No tools tagged out on this ticket."}</span>
            {(t.tags || []).map((tid: string) => <span key={tid} className="row"><Badge tone="red">{tid} {T.tool(s, tid).name}</Badge>{t.status !== "Done" && <Btn className="btn sm" onClick={() => act(() => T.untagTool(s, t.id, tid), tid + " untagged. Back in the crib unless a lockout is still on it.")}>Remove tag</Btn>}</span>)}
            {t.status !== "Done" && <div className="row">
              <select className={`inp${tagBad ? " bad" : ""}`} aria-label="Tag out a tool" aria-invalid={!!tagBad} value={tagId} onChange={(e) => setTagId(e.target.value)}><option value="">Tag out a tool...</option>{s.tools.map((x: any) => <option key={x.id} value={x.id}>{x.id} {x.name}</option>)}</select>
              <Btn className="btn sm" onClick={() => { try { T.tagTool(s, t.id, tagId); setTagBad(""); act(() => 0, tagId + " tagged out on #" + t.id + "."); setTagId(""); } catch (e: any) { setTagBad(e.message); } }}>Tag out</Btn>
            </div>}
            {tagBad && <p className="err" role="alert">{tagBad}</p>}
          </div>
          <Field label="Note (required to mark it Done)"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done, parts used, what is next" /></Field>
          <div className="row" style={{ marginTop: 8 }}>
            <select className="inp" style={{ width: 160 }} aria-label="Move to status" value={status} onChange={(e) => setStatus(e.target.value)}>{T.STATUSES.map((x: string) => <option key={x}>{x}</option>)}</select>
            <Btn kind="blue" onClick={() => act(() => { T.setStatus(s, t.id, status, me, note.trim()); setNote(""); }, `#${t.id} is now ${status}.`)}>Update status</Btn>
            <Btn onClick={() => act(() => { T.addNote(s, t.id, me, note.trim()); setNote(""); }, "Note added.")}>Add note</Btn>
          </div>
        </>}
        {tab === "files" && <div>
          <label className="drop"><Icon n="upload" s={22} /><b>Attach a photo</b><span className="small">Shown here only. Nothing is uploaded.</span>
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const url = await readSmall(f); act(() => { (t.photos = t.photos || []).push({ url, name: f.name, size: f.size, type: f.type }); T.addNote(s, t.id, me, "Attached: " + f.name); }, url ? "Attached. It's saved in this browser only." : "Attached by name. Files over 350 KB aren't kept after a reload."); }} /></label>
          <ul className="files">{(t.photos || []).map((p: any, i: number) => <li key={i}>{p.url && /^data:image/.test(p.url) ? <img src={p.url} alt={"Attached " + p.name} /> : <span className="fi">{(p.name.split(".").pop() || "").toUpperCase()}</span>}<span>{p.url ? <a href={p.url} download={p.name}>{p.name}</a> : p.name}<small>{Math.round(p.size / 1024)} KB</small></span><button type="button" className="btn btn-quiet" aria-label={"Remove " + p.name} onClick={() => act(() => { t.photos.splice(i, 1); T.addNote(s, t.id, me, "Removed attachment: " + p.name); }, "Attachment removed.")}>Remove</button></li>)}</ul>
        </div>}
        {tab === "activity" && <ul className="act">{t.log.slice().reverse().map((l: any, i: number) => <li key={i}><b>{l.text}</b><small>{l.who} · {when(l.at)}</small></li>)}</ul>}
      </div>
      {t.status !== "Done" && <footer className="pf">
        <Btn onClick={() => setTab("activity")} icon="list">History</Btn>
        <Btn kind="blue" icon="check" onClick={() => act(() => T.assign(s, t.id, me, me), "Assigned to you, " + me + ".")}>Assign to me</Btn>
        <Btn kind="primary" icon="play" onClick={() => act(() => T.setStatus(s, t.id, "In progress", me, ""), `#${t.id} is in progress.`)}>Mark in progress</Btn>
      </footer>}
    </section>
  );
}

export function Dashboard({ sel, setSel }: { sel: number | null; setSel: (n: number | null) => void }) {
  const { s } = useT();
  const c = (st: string[]) => s.tickets.filter((t: any) => st.includes(t.status)).length;
  const weekAgo = s.now - 7 * 86400000;
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      <Kpi label="Open tickets" value={c(["New", "Assigned"])} sub="Waiting on assignment or work" icon="ticket" tone="orange" />
      <Kpi label="In progress" value={c(["In progress"])} sub="Being worked now" icon="gear" />
      <Kpi label="On hold" value={c(["Waiting on parts"])} sub="Waiting on parts or approval" icon="pause" tone="orange" />
      <Kpi label="Completed" value={c(["Done"])} sub={`${s.tickets.filter((t: any) => t.status === "Done" && t.log[t.log.length - 1].at > weekAgo).length} closed this week`} icon="check" tone="green" />
    </div>
    <div className="g-tk">
      <TicketTable sel={sel} onSel={setSel} />
      {sel ? <Detail key={sel} id={sel} onClose={() => setSel(null)} /> : <Panel title="Ticket detail"><p className="mut">Pick a ticket to see it here.</p></Panel>}
    </div>
  </>;
}

export function Board({ onOpen }: { onOpen: (id: number) => void }) {
  const { s, T, me } = useT();
  const [f, setF] = useState("open");
  return (
    <Panel n="01" title="All tickets" sub="Board view by status. Click a card to open it." tools={<select className="inp" style={{ width: 170 }} aria-label="Show" value={f} onChange={(e) => setF(e.target.value)}><option value="open">Open tickets</option><option value="all">Everything</option><option value="mine">Assigned to me</option></select>}>
      <div className="board">
        {T.STATUSES.filter((st: string) => f !== "open" || st !== "Done").map((st: string) => (
          <div className="col" key={st}><h4>{st} <span className="mut">{s.tickets.filter((t: any) => t.status === st).length}</span></h4>
            {s.tickets.filter((t: any) => t.status === st && (f !== "mine" || t.assignee === me)).map((t: any) => (
              <button type="button" className="card" key={t.id} onClick={() => onOpen(t.id)}>
                <b>TT-{t.id} {t.title}</b><span className="row"><Badge tone={PRIO_TONE(t.priority)}>{t.priority}</Badge><span className="mut small">{t.assignee || "Unassigned"}</span></span>
                <span className="mut small">{t.equipment || t.area}{t.job ? " · " + t.job : ""}</span>
              </button>))}
          </div>))}
      </div>
    </Panel>
  );
}

export function NewTicket({ onDone, prefill }: { onDone: (id: number) => void; prefill?: any }) {
  const { s, T, me, act } = useT();
  const f = useForm({ title: "", equipment: "", area: "", priority: "Normal", job: "", notes: "", tagOut: true, ...(prefill || {}) });
  const isTool = /^T-\d+/.test(f.v.equipment);
  const tools = useMemo(() => s.tools, [s]);
  return (
    <Panel n="01" title="New ticket" sub={`Filed as ${me}. It shows up as New until somebody takes it.`}>
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = 0; if (f.run(() => { id = T.createTicket(s, { title: f.v.title.trim(), equipment: isTool ? f.v.equipment : f.v.equipment.trim(), area: f.v.area.trim(), priority: f.v.priority, job: f.v.job, notes: f.v.notes.trim(), requester: me, toolId: isTool ? f.v.equipment.split(" ")[0] : "", tagOut: f.v.tagOut }).id; })) { act(() => 0, `Ticket #${id} is in.`); f.reset(); onDone(id); } }}>
        <Field label="What's wrong *" error={f.bad("title")}><input data-f="title" value={f.v.title} onChange={f.set("title")} aria-invalid={f.bad("title")} placeholder="Welder 3 ground clamp cracked" /></Field>
        <Field label="Equipment" error={f.bad("equipment")}><select data-f="equipment" value={f.v.equipment} onChange={f.set("equipment")}><option value="">Other / not a crib tool</option>{tools.map((t: any) => <option key={t.id} value={`${t.id} ${t.name}`}>{t.id} {t.name}</option>)}</select></Field>
        <Field label="Where *" error={f.bad("area")}><input data-f="area" value={f.v.area} onChange={f.set("area")} aria-invalid={f.bad("area")} placeholder="Fab bay 1" /></Field>
        <Field label="Priority *" error={f.bad("priority")}><select data-f="priority" value={f.v.priority} onChange={f.set("priority")}><option value="">Pick one</option>{T.PRIORITIES.map((p: string) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Job"><select value={f.v.job} onChange={f.set("job")}><option value="">No job</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <label className="chk"><input type="checkbox" checked={f.v.tagOut} onChange={f.set("tagOut")} disabled={!isTool} /> Tag the tool out until it's fixed</label>
        <Field label="Notes"><textarea rows={3} value={f.v.notes} onChange={f.set("notes")} /></Field>
        <div className="wide row"><Btn kind="primary" type="submit" icon="plus">Open ticket</Btn><Btn onClick={f.reset}>Clear</Btn></div>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
  );
}

function EditTicket({ t, done }: { t: any; done: () => void }) {
  const { T, act, me } = useT();
  const f = useForm({ title: t.title, area: t.area, priority: t.priority, job: t.job || "", equipment: t.equipment || "" });
  return <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); if (f.run(() => {
    const miss = [["title", "what's wrong"], ["area", "where"], ["priority", "priority"]].filter(([k]) => !String((f.v as any)[k]).trim());
    if (miss.length) { const er: any = new Error("Fill in " + miss.map((m) => m[1]).join(", ") + "."); er.fields = miss.map((m) => m[0]); throw er; }
    if (T.PRIORITIES.indexOf(f.v.priority) < 0) { const er: any = new Error("Pick a priority."); er.fields = ["priority"]; throw er; }
  })) { act(() => { const ch = (["title", "area", "priority", "job", "equipment"] as const).filter((k) => (t[k] || "") !== (f.v as any)[k]); ch.forEach((k) => { t[k] = typeof (f.v as any)[k] === "string" ? (f.v as any)[k].trim() : (f.v as any)[k]; }); t.log.push({ at: Date.now(), who: me, text: ch.length ? "Edited " + ch.join(", ") : "Saved with no changes" }); }, "Ticket saved."); done(); } }}>
    <Field label="What's wrong *" error={f.bad("title")}><input data-f="title" value={f.v.title} onChange={f.set("title")} /></Field>
    <Field label="Where *" error={f.bad("area")}><input data-f="area" value={f.v.area} onChange={f.set("area")} /></Field>
    <Field label="Priority *" error={f.bad("priority")}><select data-f="priority" value={f.v.priority} onChange={f.set("priority")}><option value="">Pick one</option>{T.PRIORITIES.map((p: string) => <option key={p}>{p}</option>)}</select></Field>
    <Field label="Job"><select value={f.v.job} onChange={f.set("job")}><option value="">No job</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
    <Field label="Equipment"><input value={f.v.equipment} onChange={f.set("equipment")} /></Field>
    <div className="wide row"><Btn kind="primary" type="submit">Save</Btn><Btn onClick={done}>Cancel</Btn></div>
    {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
  </form>;
}
