/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Shell, { PROJECTS } from "../../shell/Shell";
import { Badge, Btn, Field, Icon, Kpi, Menu, Panel, SearchBox, Tabs, Toggle, useToast } from "../../shell/ui";
import { NOTE, csv, json, pdf, save, xlsx } from "../../shell/files";
import { keep, load, wipe } from "../../shell/store";
import { CATS, CAT_COLOR, Rates, Settings, run } from "./calc";
import type { FrameApi } from "./Frame3D";
import { layout } from "./Frame3D";

const Frame3D = lazy(() => import("./Frame3D"));
const E = window.GMAEstimate, SAMPLES = window.GMASamples;
const PROJ_SAMPLE: Record<string, string> = { J2041: "mezz", J2047: "stair", J2052: "canopy" };
const RATES: Rates = { material: "1.10", labor: "1.60", waste: "5", shop: "77", equip: "3", contingency: "5" };
const SET: Settings = { scope: "all", grouping: "type", rounding: "exact", accessories: false };
type St = { text: string; sample: string; rates: Rates; set: Settings; excluded: number[]; files: { name: string; size: number; read: boolean }[]; info: { job: string; client: string; location: string; estimator: string; due: string }; ran: boolean };
const fresh = (sample = "mezz"): St => { const s = SAMPLES.find((x: any) => x.id === sample) || SAMPLES[0]; return { text: s.text, sample: s.id, rates: { ...RATES }, set: { ...SET }, excluded: [], files: [{ name: s.id + "-member-list.csv", size: s.text.length, read: true }, { name: "S-101 framing plan (sample).pdf", size: 2400000, read: false }], info: { job: s.name.replace(" (fictional)", ""), client: "Sample client", location: "Sample town", estimator: "Demo user", due: "" }, ran: true }; };
const f = (n: number, d = 0) => (n == null || isNaN(n) ? "" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const $ = (n: number, d = 0) => (n == null ? "" : "$" + f(n, d));

export default function App() {
  const [s, setS] = useState<St>(() => load("estimating", () => fresh()));
  const [project, setProject] = useState(() => load("project", () => "J2041"));
  const [tab, setTab] = useState("drawings"); const [q, setQ] = useState(""); const [cat, setCat] = useState(""); const [unit, setUnit] = useState("usd");
  const [mode, setMode] = useState("orbit"); const [view, setView] = useState("model"); const [over, setOver] = useState(false);
  const [lastRun, setLastRun] = useState<string>(s.text);
  const { say, node } = useToast();
  const frame = useRef<FrameApi>(null); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { keep("estimating", s); }, [s]);
  const put = (o: Partial<St>) => setS((x) => ({ ...x, ...o }));
  const R = useMemo(() => run(E, lastRun, s.rates, s.set, s.excluded), [lastRun, s.rates, s.set, s.excluded]);
  const t = R.t;
  const rows = R.rows.filter((r: any) => (!cat || r.cat === cat) && (!q || `${r.mark} ${r.shape} ${r.cat} ${r.notes}`.toLowerCase().includes(q.toLowerCase())));
  const job = s.info.job || "Your member list";

  const takeoff = () => { const p = E.parseList(s.text); if (!p.rows.length) { say("No members found. One per line: mark, shape, qty, length.", true); return; } setLastRun(s.text); put({ ran: true }); say(`Takeoff done: ${p.rows.length} lines${p.skipped.length ? `, ${p.skipped.length} skipped` : ""}.`); };
  const loadSample = (id: string) => { const n = fresh(id); n.rates = s.rates; n.set = s.set; setS(n); setLastRun(n.text); say("Loaded " + n.info.job + ". Sample data."); };
  const readFiles = async (list: FileList | File[]) => {
    const arr = Array.from(list), files = [...s.files]; let text = "";
    for (const fl of arr) {
      const ok = /\.(csv|txt|tsv)$/i.test(fl.name) && fl.size < 1e6;
      if (ok) text += (text ? "\n" : "") + (await fl.text());
      files.push({ name: fl.name, size: fl.size, read: ok });
    }
    if (text) { put({ files, text, sample: "" }); setLastRun(text); say("Read the member list from your file. Nothing was uploaded."); }
    else { put({ files }); say("Attached. Drawings and models are listed only, the demo reads CSV or TXT member lists.", false); }
  };
  const header = ["#", "Mark", "Type", "Shape", "Qty", "Length", "lb/ft", "lb each", "lb total", "Tons", "Material $", "Labor $", "Line $", "Flags"];
  const r2 = (n: number, d = 2) => (n == null ? "" : Math.round(n * 10 ** d) / 10 ** d);
  const outRows = () => R.rows.filter((r: any) => r.on).map((r: any) => [r.n, r.mark, r.cat, r.shape, r.qty, E.fmtLength(r.length_ft), r.plf ?? "", r2(r.lbs_each), r2(r.lbs_total), r2(r.tons, 4), r2(r.material_cost), r2(r.labor_cost), r2(r.line_total), r.flags.join(". ")]);
  const summary = (): [string, unknown][] => [["Job", job], ["Client", s.info.client], ["Pieces", t.pieces], ["Total lb", r2(t.lbs)], ["Tons", r2(t.tons, 3)], ["Material $/lb (sample)", s.rates.material], ["Waste %", s.rates.waste], ["Labor $/lb (sample)", s.rates.labor], ["Shop rate $/hr (sample)", s.rates.shop], ["Material $", r2(t.material)], ["Labor $", r2(t.labor)], ["Labor hours", r2(t.laborHours, 1)], ["Equipment and misc $", r2(t.equip)], ["Contingency $", r2(t.contingency)], ["Total $", r2(t.total)], ["Lines with no weight", t.flagged]];
  const ex = (k: string) => {
    if (k === "xlsx") save(xlsx([{ name: "Summary", rows: [["Granite Models Automations, steel estimate (demo)"], [NOTE], [], ...summary()] }, { name: "Members", rows: [header, ...outRows()] }, { name: "Grouped", rows: [["Group", "Pieces", "lb"], ...Object.entries(R.groups).map(([g, v]) => [g, v.items, r2(v.lbs)])] }]), "gma-steel-estimate-demo.xlsx");
    if (k === "pdf") save(pdf("Steel estimate: " + job, [{ heading: "Summary", lines: summary().map(([a, b]) => `${a}: ${b}`) }, { heading: "Members", table: [header.slice(0, 13), ...outRows().map((r: unknown[]) => r.slice(0, 13))] }]), "gma-steel-estimate-demo.pdf");
    if (k === "csv") save(csv([[NOTE], ["Job", job], header, ...outRows()]), "gma-steel-estimate-demo.csv");
    if (k === "json") save(json({ note: NOTE, job, info: s.info, rates: s.rates, settings: s.set, totals: t, members: R.rows, skipped_lines: R.skipped, weight_source: "AISC shape table (v16 values), plate at 490 lb/cu ft" }), "gma-steel-estimate-demo.json");
    say("Downloaded the " + k.toUpperCase() + " export.");
  };
  const rate = (k: keyof Rates) => (e: any) => put({ rates: { ...s.rates, [k]: e.target.value } });
  const setg = (k: keyof Settings, v: any) => put({ set: { ...s.set, [k]: v } });
  const perTon = (n: number) => (t.tons ? n / t.tons : 0);
  const money = (n: number) => (unit === "usd" ? $(n) : $(perTon(n)) + "/ton");
  const L = useMemo(() => layout(R.rows), [R.rows]);
  const dirty = s.text !== lastRun;

  return (
    <Shell demo="estimating" kicker="Steel estimating" title="Steel Estimating" sub="Bring in a member list or drawings, take off steel quantities, and build an estimate with material and labor. Saved in this browser until you reset."
      project={project} onProject={(id) => { setProject(id); keep("project", id); loadSample(PROJ_SAMPLE[id]); }} toast={node}
      actions={<>
        <div className="chip"><span className="dot" /><div><b>Sample data loaded</b><small>{job}</small></div></div>
        <Btn icon="reset" onClick={() => { wipe("estimating"); const n = fresh(); setS(n); setLastRun(n.text); setQ(""); setCat(""); say("Demo reset."); }}>Reset Demo</Btn>
        <Menu kind="ghost" icon="folder" label="Load Sample Project" items={SAMPLES.map((x: any) => [x.name.replace(" (fictional)", " (sample)"), () => loadSample(x.id)])} />
        <Menu icon="download" label="Export Estimate" items={[["Excel (.xlsx)", () => ex("xlsx")], ["PDF", () => ex("pdf")], ["CSV", () => ex("csv")], ["JSON", () => ex("json")]]} />
      </>}>
      <div className="kpis" style={{ ["--n" as string]: 5 }}>
        <Kpi label="Total items" value={f(t.pieces)} sub={`${t.lines} member lines`} icon="box" />
        <Kpi label="Total weight" value={f(t.lbs) + " lbs"} sub={f(t.tons, 2) + " tons"} icon="weight" tone="orange" />
        <Kpi label="Material cost" value={$(t.material)} sub={`$${f(t.matPerLb, 2)}/lb with waste (sample)`} icon="cash" tone="orange" />
        <Kpi label="Labor hours" value={f(t.laborHours, 1)} sub={`At $${s.rates.shop}/hr sample shop rate`} icon="clock" />
        <Kpi label="Total estimate" value={$(t.total)} sub="Material, labor, misc, contingency" icon="calc" tone="green" />
      </div>
      <div className="g-est">
        <Panel n="01" title="Project Inputs" sub="Load drawings or a member list to generate a takeoff">
          <Tabs value={tab} onChange={setTab} tabs={[["drawings", "Drawings"], ["model", "Members"], ["info", "Project"]]} />
          {tab === "drawings" && <>
            <label className={`drop${over ? " over" : ""}`} style={{ marginTop: 10 }} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); readFiles(e.dataTransfer.files); }}>
              <Icon n="upload" s={24} /><b>Drop drawings or a member list here</b><span>or click to browse</span><span className="small">CSV or TXT member lists are read. PDF, DWG, RVT, IFC are listed only.</span>
              <input type="file" multiple className="sr-only" onChange={(e) => { if (e.target.files) readFiles(e.target.files); e.target.value = ""; }} />
            </label>
            <ul className="flist">{s.files.map((x, i) => <li key={i}><span className={`fi ft-${(x.name.split(".").pop() || "").toLowerCase()}`}>{(x.name.split(".").pop() || "").toUpperCase().slice(0, 4)}</span><span className="fnm">{x.name}<small>{x.read ? "read into takeoff" : "listed, not read in demo"}</small></span><span className="mut small">{x.size > 1e6 ? f(x.size / 1e6, 1) + " MB" : f(x.size / 1e3, 0) + " KB"}</span><button type="button" className="btn btn-quiet" aria-label={"Remove " + x.name} onClick={() => put({ files: s.files.filter((_, j) => j !== i) })}><Icon n="x" /></button></li>)}</ul>
          </>}
          {tab === "model" && <Field label="Member list (mark, shape, qty, length). Edit it, then run the takeoff."><textarea className="inp mono" rows={11} value={s.text} onChange={(e) => put({ text: e.target.value, sample: "" })} spellCheck={false} /></Field>}
          {tab === "info" && <div className="form" style={{ marginTop: 10 }}>{(["job", "client", "location", "estimator", "due"] as const).map((k) => <Field key={k} label={k === "due" ? "Bid due" : k[0].toUpperCase() + k.slice(1)}><input type={k === "due" ? "date" : "text"} value={s.info[k]} onChange={(e) => put({ info: { ...s.info, [k]: e.target.value } })} /></Field>)}</div>}
          <h3>Takeoff settings</h3>
          <div className="set">
            <label>Detection scope<select className="inp" value={s.set.scope} onChange={(e) => setg("scope", e.target.value)}><option value="all">All members</option><option value="structural">Structural steel only</option><option value="misc">Misc metals only</option></select></label>
            <label>Member grouping<select className="inp" value={s.set.grouping} onChange={(e) => setg("grouping", e.target.value)}><option value="type">By member type</option><option value="shape">By shape</option><option value="mark">By mark</option></select></label>
            <label>Length rounding<select className="inp" value={s.set.rounding} onChange={(e) => setg("rounding", e.target.value)}><option value="exact">Exact</option><option value="1/8">Up to 1/8"</option><option value="1/2">Up to 1/2"</option><option value="1">Up to 1"</option></select></label>
            <label>Material $/lb (sample)<input className="inp" inputMode="decimal" value={s.rates.material} onChange={rate("material")} /></label>
            <label>Waste %<input className="inp" inputMode="decimal" value={s.rates.waste} onChange={rate("waste")} /></label>
            <label>Labor $/lb (sample)<input className="inp" inputMode="decimal" value={s.rates.labor} onChange={rate("labor")} /></label>
            <label>Shop rate $/hr (sample)<input className="inp" inputMode="decimal" value={s.rates.shop} onChange={rate("shop")} /></label>
            <div className="split"><span>Include connection hardware (2% allowance)</span><Toggle label="Include connection hardware" on={s.set.accessories} onChange={(v) => setg("accessories", v)} /></div>
          </div>
          <Btn kind="blue" icon="play" style={{ width: "100%", marginTop: 12, height: 40 }} onClick={takeoff}>Run Takeoff{dirty ? " (list changed)" : ""}</Btn>
        </Panel>

        <Panel n="02" title="Steel Takeoff & Estimate" sub="Detected members, sizes, quantities and costs. Uncheck a line to leave it out." className="flush"
          tools={<><SearchBox value={q} onChange={setQ} placeholder="Search members, sizes or marks" /><select className="inp" style={{ width: 140 }} aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{CATS.map((c) => <option key={c}>{c}</option>)}</select></>}>
          <div className="tw tk"><table className="t">
            <thead><tr><th><input type="checkbox" aria-label="Include all" checked={!s.excluded.length} onChange={(e) => put({ excluded: e.target.checked ? [] : R.rows.map((r: any) => r.n) })} /></th><th>Type</th><th>Mark</th><th>Size / spec</th><th className="n">Qty</th><th className="n">Length</th><th className="n">Weight (lbs)</th><th className="n">Material</th><th className="n">Labor hrs</th><th className="n">Total</th></tr></thead>
            <tbody>{rows.map((r: any) => <tr key={r.n} className={r.flags.length ? "flag" : ""} style={{ opacity: r.on ? 1 : 0.45 }}>
              <td><input type="checkbox" aria-label={`Include ${r.mark}`} checked={r.on} onChange={(e) => put({ excluded: e.target.checked ? s.excluded.filter((x) => x !== r.n) : [...s.excluded, r.n] })} /></td>
              <td><span className="cat" style={{ color: CAT_COLOR[r.cat] }}><i style={{ background: CAT_COLOR[r.cat] }} />{r.cat}</span></td>
              <td className="mono">{r.mark}</td><td><b>{r.shape}</b>{r.flags.length > 0 && <div className="small" style={{ color: "#fca5a5" }}>{r.flags.join(". ")}</div>}</td>
              <td className="n">{r.qty}</td><td className="n">{E.fmtLength(r.length_ft)}</td><td className="n">{f(r.lbs_total, 0)}</td><td className="n">{$(r.material_cost)}</td>
              <td className="n">{r.labor_cost == null || !+s.rates.shop ? "" : f(r.labor_cost / +s.rates.shop, 1)}</td><td className="n"><b>{$(r.line_total)}</b></td></tr>)}
              {!rows.length && <tr><td colSpan={10} className="empty">No members match. Clear the search or run a takeoff.</td></tr>}</tbody>
          </table></div>
          {R.skipped.length > 0 && <p className="err" style={{ margin: 10 }}>Skipped {R.skipped.length} line(s) with no shape: {R.skipped.map((x: any) => "line " + x.line).join(", ")}.</p>}
          <div className="grp"><h3>Grouped totals</h3><div className="gcards">{Object.entries(R.groups).map(([g, v]) => <div key={g} className="gc" style={{ borderColor: (CAT_COLOR[g] || "#3b82f6") + "88" }}><i style={{ background: CAT_COLOR[g] || "#3b82f6" }} /><b>{g}</b><span>{v.items} items</span><span>{f(v.lbs)} lbs</span></div>)}</div></div>
        </Panel>

        <div className="g-col">
          <Panel n="03" title="3D Model Preview" sub={`${L.bays[0]} x ${L.bays[1]} bays, ${L.stories} level${L.stories > 1 ? "s" : ""}, laid out from the takeoff`} className="flush"
            tools={<><Tabs small value={view} onChange={setView} tabs={[["model", "Model"], ["plan", "Plan"]]} /><Btn kind="quiet" icon="fit" aria-label="Full screen" onClick={() => box.current?.requestFullscreen?.()} /></>}>
            <div className="m3" ref={box}>
              {view === "model" ? <Suspense fallback={<div className="empty">Loading 3D view...</div>}><Frame3D ref={frame} rows={R.rows} mode={mode} /></Suspense> :
                <svg viewBox="-1 -1 12 9" className="plan" role="img" aria-label="Framing plan">{Array.from({ length: L.bays[0] + 1 }).flatMap((_, i) => Array.from({ length: L.bays[1] + 1 }).map((__, j) => { const x = (i * 10) / Math.max(1, L.bays[0]), y = (j * 7) / Math.max(1, L.bays[1]); return <g key={i + "-" + j}>{i < L.bays[0] && <line x1={x} y1={y} x2={x + 10 / L.bays[0]} y2={y} stroke="#f97316" strokeWidth=".08" />}{j < L.bays[1] && <line x1={x} y1={y} x2={x} y2={y + 7 / L.bays[1]} stroke="#eab308" strokeWidth=".06" />}<rect x={x - 0.15} y={y - 0.15} width=".3" height=".3" fill="#3b82f6" /></g>; }))}</svg>}
            </div>
            {view === "model" && <div className="m3t">
              {([["orbit", "Orbit", "orbit"], ["pan", "Pan", "pan"], ["zoom", "Zoom", "zoom"]] as const).map(([k, l, ic]) => <Btn key={k} className={`btn sm${mode === k ? " btn-blue" : ""}`} aria-pressed={mode === k} icon={ic} onClick={() => setMode(k)}>{l}</Btn>)}
              <Btn className="btn sm" icon="fit" onClick={() => frame.current?.fit()}>Fit</Btn>
              <Btn className="btn sm" icon="reset" onClick={() => { setMode("orbit"); frame.current?.reset(); }}>Reset</Btn>
            </div>}
          </Panel>
          <Panel n="04" title="Estimate Summary" tools={<Tabs small value={unit} onChange={setUnit} tabs={[["usd", "USD"], ["ton", "Per ton"]]} />}>
            <dl className="sum">
              <dt><Icon n="weight" /> Material cost</dt><dd className="mut small">{f(t.lbs)} lbs @ ${f(t.matPerLb, 2)}/lb</dd><dd>{money(t.material)}</dd>
              <dt><Icon n="clock" /> Labor cost</dt><dd className="mut small">{f(t.laborHours, 1)} hrs @ ${s.rates.shop}/hr</dd><dd>{money(t.labor)}</dd>
              <dt><Icon n="box" /> Equipment and misc</dt><dd className="mut small"><input className="inp xs" aria-label="Equipment percent" value={s.rates.equip} onChange={rate("equip")} />% of material</dd><dd>{money(t.equip)}</dd>
              <dt className="hr">Subtotal</dt><dd className="hr" /><dd className="hr">{money(t.subtotal)}</dd>
              <dt>Contingency</dt><dd className="mut small"><input className="inp xs" aria-label="Contingency percent" value={s.rates.contingency} onChange={rate("contingency")} />%</dd><dd>{money(t.contingency)}</dd>
            </dl>
            <div className="tot"><span>Total Estimate</span><b>{money(t.total)}</b></div>
            {t.flagged > 0 && <p className="small" style={{ color: "#fca5a5", margin: "6px 0 0" }}>{t.flagged} line(s) have no weight and are left out. Check the flags.</p>}
            <div className="row eq" style={{ marginTop: 10 }}><Btn kind="green" icon="download" style={{ flex: 1 }} onClick={() => ex("xlsx")}>Export to Excel</Btn><Btn kind="red" icon="file" style={{ flex: 1 }} onClick={() => ex("pdf")}>Export to PDF</Btn></div>
            <p className="mut small" style={{ margin: "8px 0 0" }}>Rates are sample numbers. <Badge tone="yellow">Sample data</Badge></p>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
