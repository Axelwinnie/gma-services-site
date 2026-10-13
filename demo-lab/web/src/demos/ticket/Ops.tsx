/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Badge, Btn, Field, Kpi, Panel, SearchBox } from "../../shell/ui";
import { JOBS, VENDORS, day, money, useForm, useT, when } from "./ctx";
import { PUNCH_STATUSES, createPunch, movePunch } from "./extras";

const REQ_TONE: Record<string, string> = { Requested: "orange", Approved: "blue", Rejected: "red", Ordered: "purple", Received: "green" };
const QA_TONE: Record<string, string> = { open: "gray", hold: "yellow", fail: "red", "ready to sign": "blue", "signed off": "green" };
const TL = ({ id }: { id: number }) => { const { go } = useT(); return <button type="button" className="lnk" onClick={() => go("dashboard", id)}>ticket #{id}</button>; };

export function Requisitions() {
  const { s, T, me, act } = useT();
  const f = useForm({ item: "", qty: "", job: "", vendor: "" });
  const [why, setWhy] = useState<Record<string, string>>({}); const [whyBad, setWhyBad] = useState("");
  const by = (st: string) => s.reqs.filter((r: any) => r.status === st).length;
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      <Kpi label="To approve" value={by("Requested")} sub="Waiting on the office" icon="cart" tone="orange" />
      <Kpi label="Approved" value={by("Approved")} sub="PO number issued" icon="check" />
      <Kpi label="On order" value={by("Ordered")} sub="With the vendor" icon="truck" />
      <Kpi label="Received" value={by("Received")} sub="In the shop" icon="box" tone="green" />
    </div>
    <Panel n="01" title="Request material or parts" sub={`Requested by ${me}`}>
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = T.createReq(s, { item: f.v.item.trim(), qty: f.v.qty, job: f.v.job, vendor: f.v.vendor, by: me }).id; })) { act(() => 0, id + " sent for approval."); f.reset(); } }}>
        <Field label="Item *" error={f.bad("item")}><input data-f="item" value={f.v.item} onChange={f.set("item")} placeholder="HSS4x4x1/4 x 20 ft" /></Field>
        <Field label="Qty *" error={f.bad("qty")}><input data-f="qty" inputMode="numeric" value={f.v.qty} onChange={f.set("qty")} /></Field>
        <Field label="Job"><select value={f.v.job} onChange={f.set("job")}><option value="">No job</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Vendor *" error={f.bad("vendor")}><select data-f="vendor" value={f.v.vendor} onChange={f.set("vendor")}><option value="">Vendor...</option>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Btn kind="primary" type="submit" icon="plus">Request it</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <Panel n="02" title="Requisitions" className="flush">
      <div className="tw"><table className="t">
        <thead><tr><th>ID</th><th>Item</th><th className="n">Qty</th><th>Job</th><th>Vendor</th><th>By</th><th>PO</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{s.reqs.map((r: any) => <tr key={r.id}>
          <td className="mono">{r.id}</td><td>{r.item}</td><td className="n">{r.qty}</td><td>{r.job}</td><td>{r.vendor}</td><td>{r.by}</td><td className="mono">{r.po}</td>
          <td><Badge tone={REQ_TONE[r.status]}>{r.status}</Badge>{r.note && <div className="mut small">{r.note}</div>}</td>
          <td><div className="row">
            {r.status === "Requested" && <>
              <Btn kind="green" className="btn btn-green sm" onClick={() => act(() => T.approveReq(s, r.id, me), () => `${r.id} approved, PO ${r.po}.`)}>Approve</Btn>
              <input className={`inp${whyBad === r.id ? " bad" : ""}`} style={{ width: 150, height: 28 }} aria-label={`Reason for rejecting ${r.id}`} aria-invalid={whyBad === r.id} placeholder="Reason if rejecting" value={why[r.id] || ""} onChange={(e) => setWhy({ ...why, [r.id]: e.target.value })} />
              <Btn className="btn btn-red sm" onClick={() => { try { T.rejectReq(s, r.id, me, (why[r.id] || "").trim()); setWhyBad(""); act(() => 0, r.id + " rejected."); } catch (e: any) { setWhyBad(r.id); act(() => { throw e; }); } }}>Reject</Btn>
            </>}
            {r.status === "Approved" && <Btn className="btn btn-blue sm" onClick={() => act(() => T.orderReq(s, r.id), `${r.id} ordered from ${r.vendor}.`)}>Mark ordered</Btn>}
            {r.status === "Ordered" && <Btn className="btn btn-green sm" onClick={() => act(() => T.receiveReq(s, r.id, me), `${r.id} received.${r.ticket ? " Note added to ticket #" + r.ticket + "." : ""}`)}>Mark received</Btn>}
            {r.ticket && <TL id={r.ticket} />}
          </div></td></tr>)}</tbody>
      </table></div>
    </Panel>
  </>;
}

export function Punchlist() {
  const { s, me, act } = useT();
  const f = useForm({ job: "", location: "", item: "", assignee: "", days: "3" });
  const [q, setQ] = useState(""); const [st, setSt] = useState(""); const [who, setWho] = useState("");
  const rows = s.punch.filter((p: any) => (!st || p.status === st) && (!who || p.assignee === who) && (!q || `${p.id} ${p.job} ${p.location} ${p.item}`.toLowerCase().includes(q.toLowerCase())));
  const tone: Record<string, string> = { Open: "orange", "In progress": "blue", "Ready to verify": "purple", Verified: "green" };
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      {PUNCH_STATUSES.map((x) => <Kpi key={x} label={x} value={s.punch.filter((p: any) => p.status === x).length} sub={x === "Open" ? `${s.punch.filter((p: any) => p.status !== "Verified" && p.due < s.now).length} past due` : x === "Verified" ? "Checked by someone else" : "Punch items"} icon="punch" tone={x === "Verified" ? "green" : x === "Open" ? "orange" : undefined} />)}
    </div>
    <Panel n="01" title="Add a punch item" sub="Field and shop punch items with an owner and a due date.">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = createPunch(s, f.v).id; })) { act(() => 0, id + " added to the punchlist."); f.reset(); } }}>
        <Field label="Job *" error={f.bad("job")}><select data-f="job" value={f.v.job} onChange={f.set("job")}><option value="">Job...</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Location *" error={f.bad("location")}><input data-f="location" value={f.v.location} onChange={f.set("location")} placeholder="Grid B/3, stair top" /></Field>
        <Field label="What needs doing *" error={f.bad("item")}><input data-f="item" value={f.v.item} onChange={f.set("item")} placeholder="Touch up primer" /></Field>
        <Field label="Who's on it *" error={f.bad("assignee")}><select data-f="assignee" value={f.v.assignee} onChange={f.set("assignee")}><option value="">Pick a person</option>{s.people.map((p: string) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Due in days *" error={f.bad("days")}><input data-f="days" inputMode="numeric" value={f.v.days} onChange={f.set("days")} /></Field>
        <Btn kind="primary" type="submit" icon="plus">Add item</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <Panel n="02" title="Punchlist" className="flush" tools={<>
      <SearchBox value={q} onChange={setQ} placeholder="Search punch items" />
      <select className="inp" style={{ width: 150 }} aria-label="Status" value={st} onChange={(e) => setSt(e.target.value)}><option value="">All statuses</option>{PUNCH_STATUSES.map((x) => <option key={x}>{x}</option>)}</select>
      <select className="inp" style={{ width: 160 }} aria-label="Assignee" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{s.people.map((p: string) => <option key={p}>{p}</option>)}</select>
    </>}>
      <div className="tw"><table className="t">
        <thead><tr><th>ID</th><th>Job</th><th>Location</th><th>Item</th><th>Assignee</th><th>Due</th><th>Status</th><th>Move to</th></tr></thead>
        <tbody>{rows.map((p: any) => { const late = p.status !== "Verified" && p.due < s.now; return <tr key={p.id} className={late ? "flag" : ""}>
          <td className="mono">{p.id}</td><td>{p.job}</td><td>{p.location}</td><td>{p.item}</td>
          <td><select className="inp" aria-label={`Assignee for ${p.id}`} value={p.assignee} onChange={(e) => act(() => { p.assignee = e.target.value; }, `${p.id} reassigned to ${e.target.value}.`)}>{s.people.map((x: string) => <option key={x}>{x}</option>)}</select></td>
          <td>{day(p.due)}{late && <div><Badge tone="red">past due</Badge></div>}</td>
          <td><Badge tone={tone[p.status]}>{p.status}</Badge>{p.verifiedBy && <div className="mut small">by {p.verifiedBy}</div>}</td>
          <td><select className="inp" aria-label={`Move ${p.id}`} value={p.status} onChange={(e) => act(() => movePunch(s, p.id, e.target.value, me), `${p.id} is now ${e.target.value}.`)}>{PUNCH_STATUSES.map((x) => <option key={x}>{x}</option>)}</select></td>
        </tr>; })}{!rows.length && <tr><td colSpan={8} className="empty">No punch items match.</td></tr>}</tbody>
      </table></div>
    </Panel>
  </>;
}

export function Rentals() {
  const { s, T, act } = useT();
  const f = useForm({ item: "", vendor: "", job: "", days: "", rate: "" });
  const live = s.rentals.filter((r: any) => !r.offAt);
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      <Kpi label="On rent" value={live.length} sub="Units out now" icon="truck" />
      <Kpi label="Past due back" value={live.filter((r: any) => T.rentalAlert(r, s.now) === "overdue").length} sub="Call these off" icon="clock" tone="red" />
      <Kpi label="Due within a day" value={live.filter((r: any) => T.rentalAlert(r, s.now) === "call off-rent").length} sub="Call off-rent today" icon="bell" tone="orange" />
      <Kpi label="Running total" value={money(live.reduce((a: number, r: any) => a + T.rentalCost(r, s.now), 0))} sub="At sample daily rates" icon="cash" />
    </div>
    <Panel n="01" title="Put equipment on rent" sub="Rates here are sample numbers for the demo.">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = T.createRental(s, { item: f.v.item.trim(), vendor: f.v.vendor, job: f.v.job, days: f.v.days.trim(), rate: f.v.rate.trim() }).id; })) { act(() => 0, id + " on rent."); f.reset(); } }}>
        <Field label="What's rented *" error={f.bad("item")}><input data-f="item" value={f.v.item} onChange={f.set("item")} placeholder="26 ft scissor lift" /></Field>
        <Field label="Vendor *" error={f.bad("vendor")}><select data-f="vendor" value={f.v.vendor} onChange={f.set("vendor")}><option value="">Vendor...</option>{VENDORS.map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Job"><select value={f.v.job} onChange={f.set("job")}><option value="">No job</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Days *" error={f.bad("days")}><input data-f="days" inputMode="numeric" value={f.v.days} onChange={f.set("days")} /></Field>
        <Field label="Sample $/day *" error={f.bad("rate")}><input data-f="rate" inputMode="decimal" value={f.v.rate} onChange={f.set("rate")} /></Field>
        <Btn kind="primary" type="submit" icon="plus">Put on rent</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <Panel n="02" title="Rental equipment" sub="Sample rates" className="flush">
      <div className="tw"><table className="t">
        <thead><tr><th>ID</th><th>Item</th><th>Vendor</th><th>Job</th><th>On rent</th><th>Due back</th><th className="n">Days</th><th className="n">Sample $/day</th><th className="n">Total (sample)</th><th>Alert</th><th></th></tr></thead>
        <tbody>{s.rentals.map((r: any) => { const al = T.rentalAlert(r, s.now); return <tr key={r.id} className={al === "overdue" ? "flag" : ""}>
          <td className="mono">{r.id}</td><td>{r.item}</td><td>{r.vendor}</td><td>{r.job}</td><td>{day(r.onRent)}</td><td>{day(r.dueBack)}</td>
          <td className="n">{T.rentalDays(r, s.now)}</td><td className="n">{money(r.rate)}</td><td className="n">{money(T.rentalCost(r, s.now))}</td>
          <td>{al && <Badge tone={al === "overdue" ? "red" : al === "off rent" ? "green" : "yellow"}>{al}</Badge>}</td>
          <td>{!r.offAt && <Btn className="btn sm" onClick={() => act(() => T.offRent(s, r.id), `${r.item} is off rent. The total stops here.`)}>Called off-rent</Btn>}</td>
        </tr>; })}</tbody>
      </table></div>
    </Panel>
  </>;
}

export function QA() {
  const { s, T, me, act } = useT();
  const f = useForm({ job: "", part: "" });
  return <>
    <Panel n="01" title="New inspection" sub="Fit-up, weld visual, dimensions and coating. Every check has to pass before sign-off.">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); let id = ""; if (f.run(() => { id = T.createQa(s, { job: f.v.job, part: f.v.part.trim() }).id; })) { act(() => 0, id + " started."); f.reset(); } }}>
        <Field label="Job *" error={f.bad("job")}><select data-f="job" value={f.v.job} onChange={f.set("job")}><option value="">Job...</option>{JOBS.map((j) => <option key={j}>{j}</option>)}</select></Field>
        <Field label="Part *" error={f.bad("part")}><input data-f="part" value={f.v.part} onChange={f.set("part")} placeholder="Beam B7" /></Field>
        <Btn kind="primary" type="submit" icon="plus">New inspection</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
    <div className="g-2">
      {s.qa.map((q: any) => { const st = T.qaState(q); return <Panel key={q.id} title={`${q.id} ${q.part}`} sub={q.job} tools={<Badge tone={QA_TONE[st]}>{st}</Badge>}>
        <table className="t"><tbody>{q.checks.map((c: any, i: number) => <tr key={c.item}>
          <td>{c.item}</td>
          <td style={{ width: 130 }}>{q.signedBy ? <Badge tone={c.result === "pass" ? "green" : c.result === "fail" ? "red" : "yellow"}>{c.result}</Badge> :
            <select className="inp" aria-label={`${q.id} ${c.item} result`} value={c.result} onChange={(e) => act(() => T.setCheck(s, q.id, i, e.target.value))}><option value="">Not checked</option><option value="pass">pass</option><option value="fail">fail</option><option value="hold">hold</option></select>}</td>
          <td>{q.signedBy ? c.note : <input className="inp" aria-label={`${q.id} ${c.item} note`} defaultValue={c.note} onBlur={(e) => { c.note = e.target.value; }} placeholder="Note" />}</td>
        </tr>)}</tbody></table>
        <div className="row" style={{ marginTop: 8 }}>
          {q.signedBy ? <span className="mut small">Signed off by {q.signedBy} {when(q.signedAt)}.</span> : <Btn kind="green" className="btn btn-green sm" onClick={() => act(() => T.signOff(s, q.id, me), `${q.id} signed off by ${me}.`)}>Sign off</Btn>}
          {q.ncr ? <span className="small">{q.ncr} opened, rework on <TL id={s.ncrs.find((n: any) => n.id === q.ncr).ticket} /></span> :
            (st === "fail" || st === "hold") && <Btn className="btn btn-red sm" onClick={() => act(() => T.raiseNcr(s, q.id, me), () => `${q.ncr} written up. Rework ticket is on the board.`)}>Write up NCR</Btn>}
        </div>
      </Panel>; })}
    </div>
  </>;
}

export function QASummary() {
  const { s, T } = useT();
  const by: Record<string, number> = { open: 0, hold: 0, fail: 0, "ready to sign": 0, "signed off": 0 }; s.qa.forEach((q: any) => by[T.qaState(q)]++);
  const jobs: Record<string, any> = {}; s.qa.forEach((q: any) => { const j = (jobs[q.job] = jobs[q.job] || { total: 0, signed: 0, issues: 0 }); j.total++; const st = T.qaState(q); if (st === "signed off") j.signed++; if (st === "hold" || st === "fail") j.issues++; });
  const checks: Record<string, { pass: number; other: number }> = {}; s.qa.forEach((q: any) => q.checks.forEach((c: any) => { const k = (checks[c.item] = checks[c.item] || { pass: 0, other: 0 }); if (c.result === "pass") k.pass++; else if (c.result) k.other++; }));
  return <>
    <div className="kpis" style={{ ["--n" as string]: 5 }}>
      <Kpi label="Inspections" value={s.qa.length} sub="In this sandbox" icon="shield" />
      <Kpi label="Signed off" value={by["signed off"]} sub="Ready to ship" icon="check" tone="green" />
      <Kpi label="Ready to sign" value={by["ready to sign"]} sub="All checks passed" icon="check" />
      <Kpi label="On hold or failed" value={by.hold + by.fail} sub="Needs rework or a look" icon="pause" tone="red" />
      <Kpi label="Open NCRs" value={s.ncrs.filter((n: any) => n.status === "Open").length} sub="Rework tickets open" icon="ticket" tone="orange" />
    </div>
    <div className="g-2">
      <Panel n="01" title="By job" className="flush"><table className="t"><thead><tr><th>Job</th><th className="n">Inspections</th><th className="n">Signed off</th><th className="n">Hold or fail</th></tr></thead>
        <tbody>{Object.keys(jobs).map((j) => <tr key={j}><td>{j}</td><td className="n">{jobs[j].total}</td><td className="n">{jobs[j].signed}</td><td className="n">{jobs[j].issues}</td></tr>)}</tbody></table></Panel>
      <Panel n="02" title="Check results" sub="Passed out of checked, by check type"><div className="bars">{Object.keys(checks).map((k) => { const c = checks[k], n = c.pass + c.other; return <div key={k}><span>{k}</span><em><i style={{ width: (n ? (100 * c.pass) / n : 0) + "%" }} /></em><b>{c.pass}/{n}</b></div>; })}</div></Panel>
      <Panel n="03" title="NCRs" className="flush"><table className="t"><thead><tr><th>NCR</th><th>Part</th><th>Job</th><th>What</th><th>Rework</th></tr></thead>
        <tbody>{s.ncrs.map((n: any) => <tr key={n.id}><td className="mono">{n.id}</td><td>{n.part}</td><td>{n.job}</td><td>{n.desc}</td><td><TL id={n.ticket} /></td></tr>)}{!s.ncrs.length && <tr><td colSpan={5} className="empty">No NCRs yet. Fail or hold a check on QA/QC and write one up.</td></tr>}</tbody></table></Panel>
    </div>
  </>;
}

export function Trend({ title, data, keys }: { title: string; data: any[]; keys: [string, string, string][] }) {
  const W = 520, H = 160, P = 26, max = Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k[0]])));
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1), y = (v: number) => H - P - (v * (H - 2 * P)) / max;
  return <figure className="trend"><figcaption>{title} <span className="row">{keys.map(([, l, c]) => <span key={l} className="lg"><i style={{ background: c }} />{l}</span>)}</span></figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      {[0, 0.5, 1].map((g) => <line key={g} x1={P} x2={W - P} y1={y(max * g)} y2={y(max * g)} stroke="#1b2737" />)}
      {keys.map(([k, , c]) => <g key={k}><polyline fill="none" stroke={c} strokeWidth="2" points={data.map((d, i) => `${x(i)},${y(d[k])}`).join(" ")} />{data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d[k])} r="2.5" fill={c}><title>{`${d.label}: ${d[k]}`}</title></circle>)}</g>)}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 6} fill="#64748b" fontSize="9" textAnchor="middle">{d.label}</text>)}
      <text x={4} y={y(max) + 3} fill="#64748b" fontSize="9">{max}</text>
    </svg></figure>;
}

export function weekly(s: any, T: any) {
  const W = 7 * 86400000, start = s.now - W;
  const cur = { inspections: s.qa.length, passed: s.qa.filter((q: any) => T.qaState(q) === "signed off" || T.qaState(q) === "ready to sign").length, held: s.qa.filter((q: any) => T.qaState(q) === "hold").length, failed: s.qa.filter((q: any) => T.qaState(q) === "fail").length,
    opened: s.tickets.filter((t: any) => t.createdAt > start).length, closed: s.tickets.filter((t: any) => t.status === "Done" && t.log[t.log.length - 1].at > start).length };
  return s.history.map((h: any, i: number) => ({ ...(i === s.history.length - 1 ? cur : h), label: i === s.history.length - 1 ? "This wk" : new Date(h.week).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) }));
}

export function QATrends() {
  const { s, T } = useT();
  const d = weekly(s, T);
  const last = d[d.length - 1], prev = d[d.length - 2];
  const rate = (r: any) => (r.inspections ? Math.round((100 * r.passed) / r.inspections) : 0);
  return <>
    <div className="kpis" style={{ ["--n" as string]: 4 }}>
      <Kpi label="Inspections this week" value={last.inspections} sub={`${prev.inspections} the week before`} icon="shield" />
      <Kpi label="Pass rate this week" value={rate(last) + "%"} sub={`${rate(prev)}% the week before`} icon="chart" tone="green" />
      <Kpi label="Held this week" value={last.held} sub="Inspections on hold" icon="pause" tone="orange" />
      <Kpi label="Failed this week" value={last.failed} sub="Rework needed" icon="x" tone="red" />
    </div>
    <div className="g-2">
      <Panel n="01" title="QA/QC trend" sub="Last 8 weeks. Older weeks are sample history, this week is live."><Trend title="Inspections per week" data={d} keys={[["inspections", "Inspected", "#60a5fa"], ["passed", "Passed", "#22c55e"], ["held", "Held", "#eab308"], ["failed", "Failed", "#ef4444"]]} /></Panel>
      <Panel n="02" title="Ticket trend" sub="Opened vs closed. Older weeks are sample history."><Trend title="Tickets per week" data={d} keys={[["opened", "Opened", "#f97316"], ["closed", "Closed", "#22c55e"]]} /></Panel>
    </div>
  </>;
}

export function Templates({ onUse }: { onUse: (kind: string, body: any) => void }) {
  const { s, T, act } = useT();
  const [k, setK] = useState("All");
  const f = useForm({ kind: "Ticket", name: "", title: "", priority: "Normal" });
  const list = s.templates.filter((t: any) => k === "All" || t.kind === k);
  return <>
    <Panel n="01" title="Templates" sub="Ticket, QA and JHA templates. Use one to start a new record already filled in." tools={<div className="tabs sm">{["All", "Ticket", "QA", "JHA"].map((x) => <button key={x} type="button" className={k === x ? "on" : ""} aria-pressed={k === x} onClick={() => setK(x)}>{x}</button>)}</div>} className="flush">
      <table className="t"><thead><tr><th>ID</th><th>Kind</th><th>Name</th><th>What it fills in</th><th></th></tr></thead>
        <tbody>{list.map((t: any) => <tr key={t.id}><td className="mono">{t.id}</td><td><Badge tone={t.kind === "Ticket" ? "orange" : t.kind === "QA" ? "blue" : "purple"}>{t.kind}</Badge></td><td>{t.name}</td>
          <td className="mut small">{t.kind === "Ticket" ? `${t.body.title}, ${t.body.priority}` : t.kind === "QA" ? t.body.checks.join(", ") : `${t.body.steps.length} steps, PPE: ${t.body.ppe.join(", ")}`}</td>
          <td><div className="row"><Btn kind="blue" className="btn btn-blue sm" onClick={() => {
            if (t.kind === "Ticket") onUse("Ticket", t.body);
            else if (t.kind === "QA") act(() => T.createQa(s, { job: "J2041 PineHollow", part: t.body.part + " (from " + t.id + ")" }), "Inspection started from " + t.id + ". It's on QA/QC.");
            else act(() => { const j = T.createJha(s, { task: t.body.task, ppe: t.body.ppe.slice() }); t.body.steps.forEach((st: any) => T.addStep(s, j.id, { ...st })); }, "JHA started from " + t.id + ". It's in Records Hub.");
          }}>Use</Btn><Btn className="btn sm" onClick={() => act(() => { s.templates = s.templates.filter((x: any) => x !== t); }, t.id + " removed.")}>Remove</Btn></div></td></tr>)}</tbody></table>
    </Panel>
    <Panel n="02" title="Save a ticket template">
      <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); if (f.run(() => { const miss = [["name", "template name"], ["title", "ticket title"]].filter(([x]) => !String((f.v as any)[x]).trim()); if (miss.length) { const er: any = new Error("Fill in " + miss.map((m) => m[1]).join(", ") + "."); er.fields = miss.map((m) => m[0]); throw er; } })) { act(() => { s.templates.unshift({ id: "TPL-" + s.nextTpl++, kind: "Ticket", name: f.v.name.trim(), body: { title: f.v.title.trim(), area: "", priority: f.v.priority, notes: "" } }); }, "Template saved."); f.reset(); } }}>
        <Field label="Template name *" error={f.bad("name")}><input data-f="name" value={f.v.name} onChange={f.set("name")} /></Field>
        <Field label="Ticket title *" error={f.bad("title")}><input data-f="title" value={f.v.title} onChange={f.set("title")} /></Field>
        <Field label="Priority"><select value={f.v.priority} onChange={f.set("priority")}>{T.PRIORITIES.map((p: string) => <option key={p}>{p}</option>)}</select></Field>
        <Btn kind="primary" type="submit" icon="plus">Save template</Btn>
        {f.msg && <p className="err wide" role="alert">{f.msg}</p>}
      </form>
    </Panel>
  </>;
}
