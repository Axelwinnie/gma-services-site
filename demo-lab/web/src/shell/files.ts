// Real downloads for every export button. Nothing leaves the browser.
export const NOTE = "GMA Demo Lab. Sample data only, made up for the demo. Granite Models Automations, granitemodels@gmail.com";

export function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
const cell = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (rows: unknown[][]) => new Blob([rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"], { type: "text/csv" });
export const json = (o: unknown) => new Blob([JSON.stringify(o, null, 2)], { type: "application/json" });
export const xlsx = (sheets: { name: string; rows: unknown[][] }[]) => window.GMAXlsx.build(sheets);

/* Minimal PDF writer: Helvetica text, auto page breaks, simple column layout. */
export function pdf(title: string, blocks: { heading?: string; lines?: string[]; table?: unknown[][] }[]): Blob {
  const W = 612, H = 792, M = 48, pages: string[] = [];
  let ops: string[] = [], y = H - M;
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7e]/g, "?");
  const flush = () => { pages.push(ops.join("\n")); ops = []; y = H - M; };
  const text = (s: string, x: number, size = 9, bold = false) => ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`);
  const need = (h: number) => { if (y - h < M) flush(); };
  const fit = (s: string, w: number, size: number) => { const max = Math.floor(w / (size * 0.5)); return s.length > max ? s.slice(0, max - 1) + "." : s; };
  need(40); text(title, M, 16, true); y -= 16; text(NOTE, M, 7.5); y -= 10;
  ops.push(`0.976 0.451 0.086 RG 1.5 w ${M} ${y} m ${W - M} ${y} l S 0 0 0 RG`); y -= 18;
  for (const b of blocks) {
    if (b.heading) { need(28); text(b.heading, M, 11, true); y -= 15; }
    for (const l of b.lines || []) { need(14); text(fit(l, W - 2 * M, 9), M, 9); y -= 12; }
    if (b.table && b.table.length) {
      const cols = b.table[0].length, cw = (W - 2 * M) / cols;
      b.table.forEach((r, i) => {
        need(13);
        r.forEach((c, j) => text(fit(c == null ? "" : String(c), cw - 4, 7.5), M + j * cw, 7.5, i === 0));
        y -= 11;
        if (i === 0) { ops.push(`0.6 G 0.5 w ${M} ${y + 7} m ${W - M} ${y + 7} l S 0 G`); }
      });
    }
    y -= 10;
  }
  flush();
  const objs: string[] = [];
  const add = (s: string) => { objs.push(s); return objs.length; };
  add("<< /Type /Catalog /Pages 2 0 R >>"); add("PAGES");
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  pages.forEach((p, i) => {
    const foot = `BT /F1 7 Tf ${M} 24 Td (${esc(`Page ${i + 1} of ${pages.length}. Sample data only.`)}) Tj ET`;
    const body = p + "\n" + foot;
    const c = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
  });
  objs[1] = `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const off: number[] = [];
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}
