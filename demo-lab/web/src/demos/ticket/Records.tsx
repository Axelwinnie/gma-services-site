/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Badge, Btn, Field, Kpi, Menu, Panel, Tabs, Toggle } from "../../shell/ui";
import { NOTE, csv, json, pdf, save, xlsx } from "../../shell/files";
import { JOBS, day, money, useForm, useT, when } from "./ctx";
import { healthChecks, notifications } from "./extras";
import { Trend, weekly } from "./Ops";

const PPE = ["Safety glasses", "Hard hat", "Leather gloves", "Cut-resistant gloves", "Hearing protection", "Face shield", "Harness"];

function Crib() {
  const { s, T, me, act, go } = useT();
  const f = useForm({ id: "", name: "", type: "", area: "" });
  const [editing, setEditing] = useState<string | null>(null);
  return <>
    <Panel n="01" title={editing ? `Edit ${editing}` : "Add a tool to the crib"}>
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let msg = ""; if (f.run(() => { if (editing) { T.editTool(s, editing, f.v); msg = editing + " saved."; } else msg = T.addTool(s, f.v).id + " added to the crib."; })) { act(() => 0, msg); f.reset(); setEditing(null); } }}>
        <Field label="Tool ID *" error={f.bad("id")}><input data-f="id" value={f.v.id} disabled={!!editing} onChange={f.set("id")} placeholder="T-109" /></Field>
        <Field label="Name *" error={f.bad("name")}><input data-f="name" value={f.v.name} onChange={f.set("name")} /></Field>
        <Field label="Type *" error={f.bad("type")}><select data-f="type" value={f.v.type} onChange={f.set("type")}><option value="">Type...</option>{T.TOOL_TYPES.map((x: string) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Home location *" error={f.bad("area")}><input data-f="area" value={f.v.area} onChange={f.set("area")} /></Field>
        <div className="row"><Btn kind="primary" type="submit">{editing ? "Save changes" : "Add tool"}</Btn>{editing && <Btn onClick={() => { f.reset(); setEditing(null); }}>Cancel</Btn>}</div>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <Panel n="02" title="Tool crib" className="flush">
      <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Tool</th><th>Type</th><th>Status</th><th>With / where</th><th>Job</th><th>Due back</th><th></th></tr></thead>
        <tbody>{s.tools.map((tl: any) => { const late = tl.status === "out" && tl.dueAt < s.now; return <tr key={tl.id} className={late ? "flag" : ""}>
          <td className="mono">{tl.id}</td><td>{tl.name}</td><td>{tl.type}</td>
          <td><Badge tone={late ? "red" : tl.status === "in" ? "green" : tl.status === "out" ? "blue" : "orange"}>{late ? "overdue" : tl.status === "repair" && tl.loto ? "locked out" : ({ in: "in crib", out: "checked out", repair: "tagged out" } as any)[tl.status]}</Badge></td>
          <td>{tl.holder || (tl.status === "repair" ? [tl.ticket ? "Ticket #" + tl.ticket : "", tl.loto || ""].filter(Boolean).join(", ") : tl.area)}</td><td>{tl.job}</td><td>{tl.status === "out" ? day(tl.dueAt) : ""}</td>
          <td><div className="row">
            {tl.status === "out" && <Btn className="btn sm" onClick={() => act(() => T.checkin(s, tl.id), tl.name + " is back in the crib.")}>Check in</Btn>}
            {tl.status === "in" && <Btn className="btn btn-blue sm" onClick={() => act(() => T.checkout(s, tl.id, me, 2, ""), `${tl.name} checked out to ${me}, due back in 2 days.`)}>Check out to me</Btn>}
            {tl.status === "repair" && tl.ticket && <Btn className="btn sm" onClick={() => go("dashboard", tl.ticket)}>Open ticket</Btn>}
            {tl.status === "repair" && !tl.ticket && <Btn className="btn sm" onClick={() => go("records:loto")}>Open LOTO</Btn>}
            <Btn className="btn sm" onClick={() => { setEditing(tl.id); f.put({ id: tl.id, name: tl.name, type: tl.type || "Other", area: tl.area }); }}>Edit</Btn>
          </div></td></tr>; })}</tbody></table></div>
    </Panel>
  </>;
}

function Jha() {
  const { s, T, me, act, go } = useT();
  const f = useForm({ task: "", job: "", ppe: "" });
  const [steps, setSteps] = useState<Record<string, any>>({}); const [bad, setBad] = useState<{ id: string; fields: string[]; msg: string } | null>(null);
  return <>
    <Panel n="01" title="New JHA" sub="Job hazard analysis. The crew signs on before work starts.">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = T.createJha(s, { task: f.v.task.trim(), job: f.v.job, ppe: f.v.ppe ? [f.v.ppe] : [] }).id; })) { act(() => 0, id + " started. Add the steps next."); f.reset(); } }}>
        <Field label="Task *" error={f.bad("task")}><input data-f="task" value={f.v.task} onChange={f.set("task")} placeholder="Grind out cracked weld" /></Field>
        <Field label="Job"><select value={f.v.job} onChange={f.set("job")}><option value="">No job</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Main PPE *" error={f.bad("ppe")}><select data-f="ppe" value={f.v.ppe} onChange={f.set("ppe")}><option value="">Main PPE...</option>{PPE.map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Btn kind="primary" type="submit" icon="plus">New JHA</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <div className="g-2">{s.jhas.map((j: any) => { const st = steps[j.id] || { step: "", hazards: "", controls: "" }; const used = s.tickets.filter((t: any) => t.jha === j.id); return (
      <Panel key={j.id} title={`${j.id} ${j.task}`} sub={j.job || "No job"} tools={<Badge tone={j.crew.length ? "green" : "yellow"}>{j.crew.length ? j.crew.length + " signed on" : "not signed"}</Badge>}>
        <table className="t"><thead><tr><th>Step</th><th>Hazards</th><th>Controls</th></tr></thead><tbody>{j.steps.map((x: any, i: number) => <tr key={i}><td>{x.step}</td><td>{x.hazards}</td><td>{x.controls}</td></tr>)}
          <tr>{(["step", "hazards", "controls"] as const).map((k) => <td key={k}><input className={`inp${bad?.id === j.id && bad!.fields.includes(k) ? " bad" : ""}`} aria-label={`New ${k} for ${j.id}`} placeholder={k[0].toUpperCase() + k.slice(1)} value={st[k]} onChange={(e) => setSteps({ ...steps, [j.id]: { ...st, [k]: e.target.value } })} /></td>)}</tr></tbody></table>
        <div className="row" style={{ marginTop: 8 }}>
          <Btn className="btn sm" onClick={() => { try { T.addStep(s, j.id, { step: st.step.trim(), hazards: st.hazards.trim(), controls: st.controls.trim() }); setBad(null); setSteps({ ...steps, [j.id]: null }); act(() => 0, "Step added. Crew sign-ons were cleared since the JHA changed."); } catch (e: any) { setBad({ id: j.id, fields: e.fields || [], msg: e.message }); } }}>Add step</Btn>
          <Btn kind="blue" className="btn btn-blue sm" onClick={() => act(() => T.signOn(s, j.id, me), `${me} signed on to ${j.id}.`)}>Sign on as {me}</Btn>
          {used.map((t: any) => <button key={t.id} type="button" className="lnk" onClick={() => go("dashboard", t.id)}>needed by #{t.id}</button>)}
        </div>
        {bad?.id === j.id && <p className="err" role="alert">{bad!.msg}</p>}
        <div className="row small" style={{ marginTop: 8 }}>{PPE.map((p) => <label key={p} className="chk"><input type="checkbox" checked={j.ppe.includes(p)} onChange={(e) => act(() => { if (e.target.checked) j.ppe.push(p); else j.ppe.splice(j.ppe.indexOf(p), 1); })} />{p}</label>)}</div>
        <p className="mut small">{j.crew.length ? "Signed on: " + j.crew.map((c: any) => c.who + " " + when(c.at)).join(", ") : "Nobody signed on yet."}</p>
      </Panel>); })}</div>
  </>;
}

function Loto() {
  const { s, T, me, act, go } = useT();
  const f = useForm({ machine: "", energy: "", ticket: "" });
  const machines = s.tools.map((t: any) => t.id + " " + t.name).concat(["Welder 3", "Bay 2 overhead door", "Paint booth"]);
  return <>
    <Panel n="01" title="New lockout/tagout record" sub="Apply your lock, verify zero energy, release your own lock. Only the owner can take a lock off.">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = T.createLoto(s, { machine: f.v.machine, toolId: /^T-\d+/.test(f.v.machine) ? f.v.machine.split(" ")[0] : "", ticket: f.v.ticket ? +f.v.ticket : null, energy: f.v.energy.split(",").map((x: string) => x.trim()).filter(Boolean) }).id; })) { act(() => 0, id + " created. Apply locks next."); f.reset(); } }}>
        <Field label="Machine *" error={f.bad("machine")}><select data-f="machine" value={f.v.machine} onChange={f.set("machine")}><option value="">Machine...</option>{machines.map((m: string) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Energy sources, comma separated *" error={f.bad("energy")}><input data-f="energy" value={f.v.energy} onChange={f.set("energy")} placeholder="Electrical 480V, air" /></Field>
        <Field label="Ticket"><select value={f.v.ticket} onChange={f.set("ticket")}><option value="">No ticket</option>{s.tickets.map((t: any) => <option key={t.id} value={t.id}>#{t.id} {t.title}</option>)}</select></Field>
        <Btn kind="primary" type="submit" icon="lock">New LOTO record</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <div className="g-2">{s.lotos.map((l: any) => <Panel key={l.id} title={`${l.id} ${l.machine}`} tools={<Badge tone={l.released ? "green" : l.verified ? "blue" : l.locks.length ? "red" : "gray"}>{T.lotoState(l)}</Badge>}>
      <p className="small"><span className="mut">Energy:</span> {l.energy.join(", ")}</p>
      <p className="small"><span className="mut">Locks on:</span> {l.locks.length ? l.locks.map((k: any) => k.owner + " " + when(k.at)).join(", ") : "none"}</p>
      <div className="row">{!l.released ? <>
        <Btn className="btn btn-red sm" onClick={() => act(() => T.applyLock(s, l.id, me), `${me} locked out ${l.machine}.`)}>1. Apply my lock</Btn>
        <Btn className="btn sm" onClick={() => act(() => T.verifyLoto(s, l.id), l.id + " verified.")}>2. Verify zero energy</Btn>
        <Btn className="btn sm" onClick={() => act(() => T.releaseLock(s, l.id, me), () => (l.released ? l.id + " fully released." : me + "'s lock is off."))}>3. Release my lock</Btn></> :
        <Btn className="btn sm" onClick={() => act(() => T.applyLock(s, l.id, me), `${l.id} re-applied by ${me}.`)}>Lock out again</Btn>}
        {l.ticket && <button type="button" className="lnk" onClick={() => go("dashboard", l.ticket)}>blocks closing #{l.ticket}</button>}
        {l.toolId && <span className="mut small">blocks checkout of {l.toolId}</span>}
      </div>
    </Panel>)}</div>
  </>;
}

function Analytics() {
  const { s, T } = useT();
  const [d, setD] = useState("");
  const A = T.analytics(s, d), k = A.kpis;
  const crib: Record<string, number> = { "In crib": 0, "Checked out": 0, "Of those, overdue": k.overdueTools, "Tagged out": 0 }; s.tools.forEach((t: any) => { crib[t.status === "in" ? "In crib" : t.status === "repair" ? "Tagged out" : "Checked out"]++; });
  const rc: Record<string, number> = {}; A.rentals.forEach((r: any) => { rc[r.item] = r.cost; });
  const lo: Record<string, number> = { "Not applied": 0, Locked: 0, Released: 0 }; s.lotos.forEach((l: any) => { lo[l.released ? "Released" : l.locks.length ? "Locked" : "Not applied"]++; });
  const charts: [string, Record<string, number>, boolean?][] = [["Tickets by status", A.byStatus], ["Tool crib", crib], ["QA/QC inspections", A.qaBy], ["JHA before work", { Required: A.jha.need, "Signed and ready": A.jha.ok, Missing: A.jha.need - A.jha.ok }], ["Requisitions", A.reqBy], ["Rental running total (sample $)", rc, true], ["Lockout/tagout", lo]];
  return <>
    <div className="split"><p className="mut small">Company-wide view across every module. Filter by department.</p>
      <select className="inp" style={{ width: 190 }} aria-label="Department" value={d} onChange={(e) => setD(e.target.value)}><option value="">All departments</option>{T.DEPTS.map((x: string) => <option key={x}>{x}</option>)}</select></div>
    <div className="kpis" style={{ ["--n" as string]: 6 }}>
      <Kpi label="Open tickets" value={k.open} sub={`${k.down} stopping work`} tone="orange" />
      <Kpi label="Tools out" value={k.toolsOut} sub={`${k.overdueTools} overdue`} />
      <Kpi label="QA open or held" value={k.qaOpen} sub={`${k.ncrOpen} open NCRs`} />
      <Kpi label="JHA compliance" value={k.jhaPct + "%"} sub="Signed before work" tone="green" />
      <Kpi label="Reqs to approve" value={k.reqsPending} sub={`${k.lotoActive} active LOTO`} />
      <Kpi label="On rent (sample)" value={money(k.rentalCost)} sub={`${k.rentalsAlert} rental alerts`} />
    </div>
    <div className="g-3">{charts.map(([t, o, $]) => { const max = Math.max(1, ...Object.values(o)); return <Panel key={t} title={t}><div className="bars">{Object.keys(o).map((x) => <div key={x}><span title={x}>{x}</span><em><i style={{ width: (100 * o[x]) / max + "%" }} /></em><b>{$ ? money(o[x]) : o[x]}</b></div>)}</div></Panel>; })}
      <Panel title="Trend" sub="Sample history plus this week"><Trend title="Tickets opened vs closed" data={weekly(s, T)} keys={[["opened", "Opened", "#f97316"], ["closed", "Closed", "#22c55e"]]} /></Panel>
    </div>
    <Panel n="02" title="Cost-saving suggestions" sub="Built from the live sandbox data"><ul className="tips">{(A.tips.length ? A.tips : ["Nothing stands out right now."]).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul></Panel>
  </>;
}

function exportsFor(s: any, T: any, tab: string) {
  const sets: Record<string, () => { name: string; rows: unknown[][] }> = {
    crib: () => ({ name: "Tool crib", rows: [["ID", "Tool", "Type", "Status", "Holder", "Job", "Due back"], ...s.tools.map((t: any) => [t.id, t.name, t.type, t.status, t.holder, t.job, t.dueAt ? day(t.dueAt) : ""])] }),
    jha: () => ({ name: "JHA", rows: [["JHA", "Task", "Job", "Step", "Hazards", "Controls", "PPE", "Crew"], ...s.jhas.flatMap((j: any) => (j.steps.length ? j.steps : [{}]).map((x: any) => [j.id, j.task, j.job, x.step || "", x.hazards || "", x.controls || "", j.ppe.join("; "), j.crew.map((c: any) => c.who).join("; ")]))] }),
    loto: () => ({ name: "LOTO", rows: [["LOTO", "Machine", "State", "Energy", "Locks", "Ticket"], ...s.lotos.map((l: any) => [l.id, l.machine, T.lotoState(l), l.energy.join("; "), l.locks.map((k: any) => k.owner).join("; "), l.ticket || ""])] }),
    analytics: () => { const k = T.analytics(s).kpis; return { name: "Analytics", rows: [["Metric", "Value"], ...Object.keys(k).map((x) => [x, k[x]]), [], ["Suggestion"], ...T.analytics(s).tips.map((t: string) => [t])] }; },
  };
  return sets[tab]();
}

export function RecordsHub({ sub, setSub }: { sub: string; setSub: (v: string) => void }) {
  const { s, T, say } = useT();
  const ex = (kind: string) => {
    const set = exportsFor(s, T, sub), base = "gma-tts-demo-" + sub;
    if (kind === "csv") save(csv([[NOTE], ...set.rows]), base + ".csv");
    if (kind === "xlsx") save(xlsx([{ name: set.name, rows: [[NOTE], [], ...set.rows] }]), base + ".xlsx");
    if (kind === "json") save(json({ note: NOTE, record: set.name, rows: set.rows }), base + ".json");
    if (kind === "pdf") save(pdf("Tool Ticket System, " + set.name + " records", [{ table: set.rows }]), base + ".pdf");
    if (kind === "all") save(xlsx(["crib", "jha", "loto", "analytics"].map((x) => exportsFor(s, T, x))), "gma-tts-demo-records.xlsx");
    say("Downloaded " + set.name + " export. Sample data only.");
  };
  return <>
    <div className="split">
      <Tabs value={sub} onChange={setSub} tabs={[["crib", "Tool crib"], ["jha", "JHA"], ["loto", "Lockout/tagout"], ["analytics", "Analytics"]]} />
      <div className="row"><Menu label="Export" icon="download" kind="ghost" items={[["Excel (.xlsx)", () => ex("xlsx")], ["PDF", () => ex("pdf")], ["CSV", () => ex("csv")], ["JSON", () => ex("json")], ["All records, one workbook", () => ex("all")]]} /></div>
    </div>
    {sub === "crib" && <Crib />}{sub === "jha" && <Jha />}{sub === "loto" && <Loto />}{sub === "analytics" && <Analytics />}
  </>;
}

export function Notifications() {
  const { s, T, act, go } = useT();
  const list = notifications(s, T), unread = list.filter((n) => !s.readNotes[n.id]);
  return <>
    <div className="g-side">
      <Panel n="01" title="Notifications" sub={`${unread.length} unread of ${list.length}. Built from what's happening in the sandbox.`} tools={<Btn className="btn sm" onClick={() => act(() => list.forEach((n) => (s.readNotes[n.id] = 1)), "All marked read.")}>Mark all read</Btn>} className="flush">
        <ul className="notes">{list.map((n) => <li key={n.id} className={s.readNotes[n.id] ? "read" : ""}>
          <Badge tone={n.tone}>{n.title}</Badge><span>{n.text}</span>
          <div className="row"><Btn className="btn sm" onClick={() => { s.readNotes[n.id] = 1; go(n.view, n.ticket); }}>Open</Btn>{!s.readNotes[n.id] && <Btn kind="quiet" onClick={() => act(() => (s.readNotes[n.id] = 1))}>Mark read</Btn>}</div>
        </li>)}{!list.length && <li className="empty">All clear.</li>}</ul>
      </Panel>
      <Panel n="02" title="Delivery" sub="Demo only. Nothing is ever sent.">
        {([["inApp", "In-app alerts"], ["email", "Email (off in the demo)"], ["sms", "Text message (off in the demo)"], ["digest", "Daily digest in app"]] as const).map(([k, l]) => <div key={k} className="split" style={{ padding: "6px 0" }}><span>{l}</span><Toggle label={l} on={s.channels[k]} onChange={(v) => act(() => { s.channels[k] = v; }, `${l} ${v ? "on" : "off"}. Nothing is sent from the demo.`)} /></div>)}
        <h3>Automation log</h3>
        <ul className="log">{s.autoLog.slice().reverse().map((l: any, i: number) => <li key={i}><time>{new Date(l.at).toLocaleTimeString()}</time><span className={l.kind}>{l.text}</span></li>)}</ul>
      </Panel>
    </div>
  </>;
}

export function Health() {
  const { s, T, act } = useT();
  const checks = healthChecks(s, T), ok = checks.filter((c) => c.ok).length;
  const up = Math.round((Date.now() - s.health.started) / 1000);
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      <Kpi label="Sandbox" value="Online" sub="Runs in this browser tab" icon="heart" tone="green" />
      <Kpi label="Checks passing" value={`${ok}/${checks.length}`} sub={s.health.lastRun ? "Last run " + new Date(s.health.lastRun).toLocaleTimeString() : "Not run yet"} icon="shield" tone={ok === checks.length ? "green" : "red"} />
      <Kpi label="Session" value={`${Math.floor(up / 60)}m ${up % 60}s`} sub="Since the last reset" icon="clock" />
      <Kpi label="Records" value={s.tickets.length + s.tools.length + s.qa.length + s.jhas.length + s.reqs.length + s.rentals.length + s.lotos.length + s.punch.length} sub="Across all modules" icon="archive" />
    </div>
    <Panel n="01" title="System health" sub="Data integrity checks on the sandbox" tools={<Btn kind="blue" icon="play" onClick={() => act(() => { s.health.lastRun = Date.now(); s.autoLog.push({ at: Date.now(), kind: "info", text: `Health check: ${ok}/${checks.length} passing.` }); }, `Health check done. ${ok} of ${checks.length} passing.`)}>Run health check</Btn>} className="flush">
      <table className="t"><thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead><tbody>{checks.map((c) => <tr key={c.name}><td>{c.name}</td><td><Badge tone={c.ok ? "green" : "red"}>{c.ok ? "passing" : "attention"}</Badge></td><td className="mut">{c.text}</td></tr>)}</tbody></table>
    </Panel>
  </>;
}
