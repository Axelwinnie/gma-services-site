/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import Shell from "../../shell/Shell";
import { Badge, Btn, Icon, Kpi, Menu, Panel, SearchBox, useToast } from "../../shell/ui";
import { NOTE, csv, json, pdf, save, xlsx } from "../../shell/files";
import { keep, load, readSmall, wipe } from "../../shell/store";

const P = window.GMAFields, S = window.GMAExtractSamples;
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/";
const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const CONF: Record<string, [string, string]> = { high: ["found", "green"], medium: ["check", "yellow"], low: ["not sure", "red"], missing: ["not on doc", "gray"], edited: ["edited", "blue"] };
type Doc = { id: string; name: string; source: string; text: string; image: string | null; fields: any; line_items: any[]; status: "Draft" | "Approved" | "Rejected"; at: number; note?: string };
type St = { cur: Doc | null; queue: Doc[]; n: number };
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[,$\s]/g, "")); return isFinite(n) ? n : null; };
const fromSample = (s: any, n: number): Doc => { const r = JSON.parse(JSON.stringify(s.result)); return { id: "DOC-" + n, name: s.name, source: "sample (precomputed)", text: s.text, image: "/demos/extract/" + s.image, fields: r.fields, line_items: r.line_items, status: "Draft", at: Date.now() }; };
const fresh = (): St => ({ cur: fromSample(S[0], 101), queue: [], n: 102 });
const scriptOnce = (src: string) => new Promise<void>((ok, bad) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = () => ok(); s.onerror = () => bad(new Error("Couldn't load " + src)); document.head.appendChild(s); });

function checks(d: Doc) {
  const out: { ok: boolean; text: string }[] = [];
  const sum = d.line_items.reduce((a, l) => a + (num(l.amount) || 0), 0), sub = num(d.fields.subtotal?.value), tax = num(d.fields.tax?.value), tot = num(d.fields.total?.value);
  d.line_items.forEach((l, i) => { const q = num(l.qty), u = num(l.unit_price), a = num(l.amount); if (q != null && u != null && a != null && Math.abs(q * u - a) > 0.02) out.push({ ok: false, text: `Line ${i + 1}: ${q} x ${u.toFixed(2)} is ${(q * u).toFixed(2)}, amount says ${a.toFixed(2)}.` }); });
  if (sub != null && d.line_items.length) out.push(Math.abs(sum - sub) > 0.02 ? { ok: false, text: `Line items add up to ${sum.toFixed(2)}, subtotal says ${sub.toFixed(2)}.` } : { ok: true, text: "Line items add up to the subtotal." });
  if (sub != null && tot != null) { const e = sub + (tax || 0); out.push(Math.abs(e - tot) > 0.02 ? { ok: false, text: `Subtotal plus tax is ${e.toFixed(2)}, total says ${tot.toFixed(2)}.` } : { ok: true, text: "Subtotal plus tax matches the total." }); }
  const req = ["doc_type", "vendor", "doc_number", "date"].filter((k) => !String(d.fields[k]?.value || "").trim());
  out.push(req.length ? { ok: false, text: "Missing: " + req.map((k) => P.LABELS[k]).join(", ") + "." } : { ok: true, text: "Doc type, vendor, number and date are filled in." });
  return out;
}

export default function App() {
  const [s, setS] = useState<St>(() => load("extract", fresh));
  const [project, setProject] = useState(() => load("project", () => "J2041"));
  const [busy, setBusy] = useState(""); const [over, setOver] = useState(false); const [q, setQ] = useState(""); const [why, setWhy] = useState(""); const [whyBad, setWhyBad] = useState(false);
  const { say, node } = useToast();
  useEffect(() => { keep("extract", s); }, [s]);
  const d = s.cur;
  const setDoc = (fn: (x: Doc) => void) => setS((st) => { if (!st.cur) return st; const c: Doc = JSON.parse(JSON.stringify(st.cur)); fn(c); return { ...st, cur: c }; });

  const readPdf = async (file: File) => {
    await scriptOnce(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
    const pdfDoc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise, page = await pdfDoc.getPage(1);
    const vp = page.getViewport({ scale: 1.4 }), cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
    const texts: string[] = [];
    for (let i = 1; i <= Math.min(pdfDoc.numPages, 5); i++) { const tc = await (await pdfDoc.getPage(i)).getTextContent(); const rows: Record<number, any[]> = {}; tc.items.forEach((it: any) => { const y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push(it); }); texts.push(Object.keys(rows).map(Number).sort((a, b) => b - a).map((y) => rows[y].sort((a, b) => a.transform[4] - b.transform[4]).map((x) => x.str).join(" ").replace(/\s+/g, " ").trim()).filter(Boolean).join("\n")); }
    const img = cv.toDataURL("image/jpeg", 0.6), text = texts.join("\n");
    if (text.replace(/\s/g, "").length > 40) return { text, how: "PDF text layer", img };
    setBusy("No text layer, looks like a scan. Running OCR on page 1...");
    return { text: await ocr(cv), how: "OCR of scanned PDF page 1", img };
  };
  const ocr = async (src: any) => { await scriptOnce(TESS); const r = await window.Tesseract.recognize(src, "eng", { logger: (m: any) => m.status === "recognizing text" && setBusy("Reading the image... " + Math.round(m.progress * 100) + "%") }); return r.data.text as string; };
  const handle = async (file?: File) => {
    if (!file) return;
    if (file.size > 15e6) { say("That file is over 15 MB. Send it to us instead.", true); return; }
    setBusy("Reading " + file.name + "...");
    try {
      const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
      const r = isPdf ? await readPdf(file) : { text: await ocr(file), how: "OCR", img: await readSmall(file, 600000) };
      const res = P.parse(r.text);
      if (/OCR/.test(r.how)) { Object.values(res.fields).forEach((f: any) => { if (f.confidence === "high") f.confidence = "medium"; }); res.line_items.forEach((l: any) => { if (l.confidence === "high") l.confidence = "medium"; }); }
      setS((st) => ({ ...st, n: st.n + 1, cur: { id: "DOC-" + st.n, name: file.name, source: r.how, text: r.text, image: r.img && r.img.length < 700000 ? r.img : null, fields: res.fields, line_items: res.line_items, status: "Draft", at: Date.now() } }));
      say("Done. Read with " + r.how + ". Check every field before you use it.");
    } catch (e: any) { say("Couldn't read that file. " + (e?.message || ""), true); }
    setBusy("");
  };
  const loadSample = (id: string) => { const smp = S.find((x: any) => x.id === id); setS((st) => ({ ...st, n: st.n + 1, cur: fromSample(smp, st.n) })); say("Sample loaded. These results are saved with the page so they always come out the same."); };
  const flat = (x: Doc) => [["Field", "Value", "Check"], ...Object.keys(P.LABELS).map((k) => [P.LABELS[k], x.fields[k]?.value ?? "", x.fields[k]?.confidence ?? ""])];
  const items = (x: Doc) => [["Qty", "Unit", "Description", "Unit price", "Amount", "Check"], ...x.line_items.map((l) => [l.qty, l.unit, l.description, l.unit_price, l.amount, l.confidence])];
  const ex = (k: string, x = d) => {
    if (!x) return; const base = "gma-doc-extract-" + x.id.toLowerCase();
    if (k === "csv") save(csv([[NOTE], ["Source", x.name], ...flat(x), [], ...items(x)]), base + ".csv");
    if (k === "xlsx") save(xlsx([{ name: "Fields", rows: [[NOTE], ["Source", x.name], [], ...flat(x)] }, { name: "Line items", rows: items(x) }]), base + ".xlsx");
    if (k === "json") save(json({ note: NOTE, id: x.id, source: x.name, read_with: x.source, status: x.status, fields: x.fields, line_items: x.line_items, checks: checks(x), raw_text: x.text }), base + ".json");
    if (k === "pdf") save(pdf("Doc Extract: " + x.name, [{ heading: "Fields", table: flat(x) }, { heading: "Line items", table: items(x) }, { heading: "Checks", lines: checks(x).map((c) => (c.ok ? "OK  " : "CHECK  ") + c.text) }]), base + ".pdf");
    say("Downloaded " + k.toUpperCase() + ".");
  };
  const decide = (status: "Approved" | "Rejected") => {
    if (!d) return;
    if (status === "Rejected" && !why.trim()) { setWhyBad(true); say("Say why it's rejected.", true); return; }
    const bad = checks(d).filter((c) => !c.ok);
    if (status === "Approved" && bad.length) { say("Fix the checks first: " + bad[0].text, true); return; }
    setWhyBad(false); setWhy("");
    setS((st) => ({ ...st, queue: [{ ...st.cur!, status, at: Date.now(), note: status === "Rejected" ? why.trim() : "" }, ...st.queue.filter((x) => x.id !== st.cur!.id)], cur: { ...st.cur!, status } }));
    say(`${d.id} ${status.toLowerCase()} and saved to the processed list.`);
  };

  const ck = d ? checks(d) : [];
  const fieldsFound = d ? Object.values(d.fields).filter((f: any) => f.confidence === "high" || f.confidence === "edited").length : 0;
  const toCheck = d ? Object.values(d.fields).filter((f: any) => f.confidence === "medium" || f.confidence === "low").length + d.line_items.filter((l) => l.confidence === "medium" || l.confidence === "low").length : 0;
  const queue = s.queue.filter((x) => !q || `${x.id} ${x.name} ${x.fields.vendor?.value} ${x.fields.doc_number?.value}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Shell demo="extract" kicker="Document intake" title="Doc Extract" sub="Pull vendor, numbers, dates, line items and totals off invoices, quotes and delivery tickets, then review, approve and export. Saved in this browser until you reset."
      project={project} onProject={(id) => { setProject(id); keep("project", id); say("Sample project set. Load a sample doc to work on it."); }} toast={node}
      actions={<>
        <Menu kind="ghost" icon="file" label="Load Sample Doc" items={S.map((x: any) => [x.name.replace(" (fictional)", " (sample)"), () => loadSample(x.id)])} />
        <Btn icon="reset" onClick={() => { wipe("extract"); setS(fresh()); setWhy(""); say("Demo reset."); }}>Reset Demo</Btn>
        <Menu icon="download" label="Export" items={[["Excel (.xlsx)", () => ex("xlsx")], ["PDF", () => ex("pdf")], ["CSV", () => ex("csv")], ["JSON", () => ex("json")]]} />
      </>}>
      <div className="kpis" style={{ ["--n" as string]: 4 }}>
        <Kpi label="Fields found" value={`${fieldsFound}/${Object.keys(P.LABELS).length}`} sub="Read clearly or edited" icon="doc" />
        <Kpi label="Needs a check" value={toCheck} sub="Fields and lines marked check or not sure" icon="search" tone="orange" />
        <Kpi label="Line items" value={d?.line_items.length ?? 0} sub={d ? "$" + d.line_items.reduce((a, l) => a + (num(l.amount) || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 }) + " total" : ""} icon="list" />
        <Kpi label="Totals check" value={ck.length ? (ck.every((c) => c.ok) ? "Passing" : ck.filter((c) => !c.ok).length + " issue(s)") : "No doc"} sub={`${s.queue.length} processed so far`} icon="check" tone={ck.every((c) => c.ok) ? "green" : "red"} />
      </div>
      <div className="g-ex">
        <Panel n="01" title="Document Input" sub="PDF, JPG, PNG or TIFF. Read in your browser, never uploaded.">
          <label className={`drop${over ? " over" : ""}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files[0]); }}>
            <Icon n="upload" s={24} /><b>Drop a document here</b><span>or click to browse</span>
            <input type="file" accept=".pdf,image/*,.tif,.tiff" className="sr-only" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {busy && <p className="busy" role="status">{busy}</p>}
          <div className="samples">{S.map((x: any) => <button key={x.id} type="button" className={d?.name === x.name ? "on" : ""} onClick={() => loadSample(x.id)}><Icon n="file" />{x.name.replace(" (fictional)", "")}<Badge tone="yellow">sample</Badge></button>)}</div>
          <div className="pv">{d?.image ? <img src={d.image} alt={"Preview of " + d.name} /> : <p className="mut small">{d ? "No preview for this file." : "Nothing loaded."}</p>}</div>
        </Panel>
        {d ? <div className="g-col">
          <Panel n="02" title="Extracted Fields" sub={`${d.id}, ${d.name}. Read with ${d.source}.`} tools={<Badge tone={d.status === "Approved" ? "green" : d.status === "Rejected" ? "red" : "gray"}>{d.status}</Badge>} className="flush">
            <table className="t"><thead><tr><th>Field</th><th>Value</th><th>Check</th></tr></thead>
              <tbody>{Object.keys(P.LABELS).map((k) => { const fl = d.fields[k] || { value: "", confidence: "missing" }; return <tr key={k}><td className="mut">{P.LABELS[k]}</td>
                <td><input className="inp" aria-label={P.LABELS[k]} value={fl.value ?? ""} onChange={(e) => setDoc((x) => { x.fields[k] = { ...(x.fields[k] || {}), value: e.target.value, confidence: "edited" }; x.status = "Draft"; })} /></td>
                <td title={fl.note || ""}><Badge tone={CONF[fl.confidence]?.[1] || "gray"}>{CONF[fl.confidence]?.[0] || fl.confidence}</Badge></td></tr>; })}</tbody></table>
          </Panel>
          <Panel n="03" title="Line Items" tools={<Btn className="btn sm" icon="plus" onClick={() => setDoc((x) => { x.line_items.push({ qty: "", unit: "EA", description: "", unit_price: "", amount: "", confidence: "edited" }); x.status = "Draft"; })}>Add line</Btn>} className="flush">
            <div className="tw"><table className="t"><thead><tr><th>Qty</th><th>Unit</th><th>Description</th><th>Unit price</th><th>Amount</th><th>Check</th><th></th></tr></thead>
              <tbody>{d.line_items.map((l, i) => <tr key={i}>{(["qty", "unit", "description", "unit_price", "amount"] as const).map((k) => <td key={k} style={k === "description" ? { minWidth: 180 } : { width: k === "unit" ? 60 : 90 }}><input className="inp" aria-label={`Line ${i + 1} ${k}`} value={l[k] ?? ""} onChange={(e) => setDoc((x) => { x.line_items[i][k] = e.target.value; x.line_items[i].confidence = "edited"; x.status = "Draft"; })} /></td>)}
                <td><Badge tone={CONF[l.confidence]?.[1] || "gray"}>{CONF[l.confidence]?.[0] || l.confidence}</Badge></td>
                <td><button type="button" className="btn btn-quiet" aria-label={`Remove line ${i + 1}`} onClick={() => setDoc((x) => { x.line_items.splice(i, 1); x.status = "Draft"; })}><Icon n="x" /></button></td></tr>)}
                {!d.line_items.length && <tr><td colSpan={7} className="empty">No line items found. Add one if the doc has them.</td></tr>}</tbody></table></div>
          </Panel>
        </div> : <Panel n="02" title="Extracted Fields"><p className="empty">Load a sample or drop a document.</p></Panel>}
        <div className="g-col">
          <Panel n="04" title="Review & Approve" sub="Checks rerun as you edit">
            <ul className="cks">{ck.map((c, i) => <li key={i} className={c.ok ? "ok" : "no"}><Icon n={c.ok ? "check" : "x"} />{c.text}</li>)}</ul>
            <div className="row" style={{ marginTop: 10 }}><Btn kind="green" icon="check" style={{ flex: 1 }} disabled={!d} onClick={() => decide("Approved")}>Approve</Btn></div>
            <div className="row" style={{ marginTop: 8 }}><input className={`inp${whyBad ? " bad" : ""}`} aria-invalid={whyBad} aria-label="Reason for rejecting" placeholder="Reason if rejecting" value={why} onChange={(e) => setWhy(e.target.value)} style={{ flex: 1 }} /><Btn kind="red" disabled={!d} onClick={() => decide("Rejected")}>Reject</Btn></div>
            <div className="row eq" style={{ marginTop: 10 }}>{(["xlsx", "pdf", "csv", "json"] as const).map((k) => <Btn key={k} className="btn sm" icon="download" disabled={!d} onClick={() => ex(k)}>{k.toUpperCase()}</Btn>)}</div>
          </Panel>
          <Panel n="05" title="Raw Text" sub="What the reader saw" className="flush"><pre className="raw">{d?.text || ""}</pre></Panel>
        </div>
      </div>
      <Panel n="06" title="Processed Documents" sub="Approved and rejected docs, saved in this browser" className="flush" tools={<SearchBox value={q} onChange={setQ} placeholder="Search processed docs" />}>
        <div className="tw"><table className="t"><thead><tr><th>ID</th><th>Document</th><th>Vendor</th><th>Doc number</th><th className="n">Total</th><th>Status</th><th>When</th><th></th></tr></thead>
          <tbody>{queue.map((x) => <tr key={x.id}><td className="mono">{x.id}</td><td>{x.name}</td><td>{x.fields.vendor?.value}</td><td>{x.fields.doc_number?.value}</td><td className="n">{x.fields.total?.value}</td>
            <td><Badge tone={x.status === "Approved" ? "green" : "red"}>{x.status}</Badge>{x.note && <div className="mut small">{x.note}</div>}</td><td className="mut">{new Date(x.at).toLocaleString()}</td>
            <td><div className="row"><Btn className="btn sm" onClick={() => { setS((st) => ({ ...st, cur: JSON.parse(JSON.stringify(x)) })); say(x.id + " reopened for editing."); }}>Reopen</Btn><Btn className="btn sm" icon="download" onClick={() => ex("xlsx", x)}>XLSX</Btn><Btn kind="quiet" aria-label={"Delete " + x.id} onClick={() => setS((st) => ({ ...st, queue: st.queue.filter((y) => y.id !== x.id) }))}>Delete</Btn></div></td></tr>)}
            {!queue.length && <tr><td colSpan={8} className="empty">Nothing processed yet. Approve or reject a document above.</td></tr>}</tbody></table></div>
      </Panel>
    </Shell>
  );
}
