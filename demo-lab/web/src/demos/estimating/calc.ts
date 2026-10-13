/* eslint-disable @typescript-eslint/no-explicit-any */
// Thin layer over the shared estimate.js math (AISC weights x length, $/lb). Nothing here guesses a weight.
export type Settings = { scope: string; grouping: string; rounding: string; accessories: boolean };
export type Rates = { material: string; labor: string; waste: string; shop: string; equip: string; contingency: string };
export const CATS = ["Beam", "Column", "Plate", "Angle", "Channel", "Pipe", "Tube", "Other"];
export const CAT_COLOR: Record<string, string> = { Beam: "#f97316", Column: "#3b82f6", Plate: "#a78bfa", Angle: "#22c55e", Channel: "#eab308", Pipe: "#ef4444", Tube: "#38bdf8", Other: "#94a3b8" };

export function category(r: any) {
  const s = String(r.shape || r.input).toUpperCase(), m = String(r.mark).toUpperCase();
  if (/^PL/.test(s)) return "Plate";
  if (/^L/.test(s)) return "Angle";
  if (/^(C|MC)\d/.test(s)) return "Channel";
  if (/^PIPE/.test(s)) return "Pipe";
  if (/^HSS/.test(s)) return /^(C|COL|P|POST|CP)/.test(m) ? "Column" : "Tube";
  if (/^(W|S|M|HP|WT|ST|MT)\d/.test(s)) return /^(C|COL|CP)\d*/.test(m) && !/^CB/.test(m) ? "Column" : "Beam";
  return "Other";
}
const STEP: Record<string, number> = { exact: 0, "1/8": 1 / 96, "1/2": 1 / 24, "1": 1 / 12 };
const STRUCT = { Beam: 1, Column: 1, Channel: 1, Tube: 1 } as Record<string, number>;

export function run(E: any, text: string, rates: Rates, st: Settings, excluded: number[]) {
  const p = E.parseList(text);
  const step = STEP[st.rounding] || 0;
  let rows = p.rows.map((r: any) => ({ ...r, length_ft: r.length_ft != null && step ? Math.ceil(r.length_ft / step - 1e-9) * step : r.length_ft, cat: category(r) }));
  rows = rows.filter((r: any) => st.scope === "all" || (st.scope === "structural" ? STRUCT[r.cat] : !STRUCT[r.cat]));
  const c = E.compute(rows, { material: rates.material, labor: rates.labor, waste: rates.waste });
  c.rows.forEach((r: any, i: number) => { r.cat = rows[i].cat; r.on = excluded.indexOf(r.n) < 0; });
  const on = c.rows.filter((r: any) => r.on && r.lbs_total != null);
  const shop = +rates.shop || 0, eq = (+rates.equip || 0) / 100, cont = (+rates.contingency || 0) / 100;
  const lbs = on.reduce((a: number, r: any) => a + r.lbs_total, 0);
  const acc = st.accessories ? lbs * 0.02 : 0; // connection hardware allowance, sample
  const matPerLb = (+rates.material || 0) * (1 + (+rates.waste || 0) / 100);
  const material = on.reduce((a: number, r: any) => a + r.material_cost, 0) + acc * matPerLb;
  const labor = on.reduce((a: number, r: any) => a + r.labor_cost, 0) + acc * (+rates.labor || 0);
  const equip = material * eq, subtotal = material + labor + equip, contingency = subtotal * cont;
  const groups: Record<string, { lbs: number; items: number }> = {};
  on.forEach((r: any) => { const k = st.grouping === "mark" ? r.mark : st.grouping === "shape" ? r.shape : r.cat; const g = (groups[k] = groups[k] || { lbs: 0, items: 0 }); g.lbs += r.lbs_total; g.items += r.qty; });
  return {
    rows: c.rows, skipped: p.skipped, groups,
    t: { pieces: on.reduce((a: number, r: any) => a + r.qty, 0), lines: on.length, lbs: lbs + acc, acc, tons: (lbs + acc) / 2000, material, labor, laborHours: shop ? labor / shop : 0, equip, subtotal, contingency, total: subtotal + contingency, perLb: c.totals.per_lb, matPerLb, flagged: c.rows.filter((r: any) => r.lbs_total == null).length },
  };
}
