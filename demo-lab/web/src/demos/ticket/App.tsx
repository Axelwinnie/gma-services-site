/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from "react";
import Shell, { PROJECTS } from "../../shell/Shell";
import { Btn, Icon, useToast } from "../../shell/ui";
import { keep, load, wipe } from "../../shell/store";
import { C, Ctx } from "./ctx";
import { notifications, seedExtras } from "./extras";
import { Board, Dashboard, NewTicket } from "./Maint";
import { Punchlist, QA, QASummary, QATrends, Rentals, Requisitions, Templates } from "./Ops";
import { Health, Notifications, RecordsHub } from "./Records";

const T = window.GMATickets;
const KEY = "ticket";
const fresh = () => seedExtras(T.seed());
const EXTRA = [
  { title: "Mag drill arbor wobbles", equipment: "T-101 Magnetic drill press 1-3/8\"", toolId: "T-101", area: "Fab bay 1", priority: "Normal", job: "J2041 PineHollow", requester: "Marco (fab)", notes: "Runout on the arbor, holes coming out oval." },
  { title: "Need 2 more torque wrenches for bolt-up", equipment: "", area: "Tool crib", priority: "Normal", job: "J2047 CedarRun", requester: "Tess (welding)", notes: "Crews are sharing one and waiting." },
  { title: "Plasma cutter consumables worn", equipment: "T-107 Plasma cutter, hand", toolId: "T-107", area: "Fab bay 2", priority: "Low", job: "", requester: "Marco (fab)", notes: "Cut quality dropping." },
  { title: "Forklift horn not working", equipment: "Forklift 2", area: "Yard", priority: "High", job: "", requester: "Ray (shipping)", notes: "Safety item, needs fixing before next shift." },
  { title: "Laser level out of calibration", equipment: "T-106 Laser level", toolId: "T-106", area: "Office", priority: "Normal", job: "J2052 MillPond", requester: "Dana (office)", notes: "Off by about 1/4 in at 50 ft." },
  { title: "Paint booth fan noisy", equipment: "Paint booth", area: "Paint", priority: "Low", job: "", requester: "Kim (paint)", notes: "Bearing noise on startup." },
];

const NAV: [string, [string, string, string][]][] = [
  ["Maintenance", [["dashboard", "Dashboard", "grid"], ["tickets", "All Tickets", "ticket"], ["new", "New Ticket", "plus"]]],
  ["Operations", [["req", "Requisitions", "cart"], ["punch", "Punchlist", "punch"], ["rent", "Rental", "truck"], ["qa", "QA/QC", "shield"], ["qasum", "QA/QC Summary", "list"], ["qatrend", "QA/QC Trends", "chart"], ["templates", "Templates", "file"]]],
  ["Reports", [["records", "Records Hub", "archive"]]],
  ["System", [["notify", "Notifications", "bell"], ["health", "Health", "heart"]]],
];
const TITLES: Record<string, string> = Object.fromEntries(NAV.flatMap(([, i]) => i.map(([k, l]) => [k, l])));

export default function App() {
  const [s, setS] = useState<any>(() => load(KEY, fresh));
  const [ver, setVer] = useState(0);
  const [view, setView] = useState(() => (location.hash.slice(1).split(":")[0] in TITLES ? location.hash.slice(1).split(":")[0] : "dashboard"));
  const [sub, setSub] = useState(() => location.hash.split(":")[1] || "crib");
  const [sel, setSel] = useState<number | null>(s.tickets[0]?.id ?? null);
  const [me, setMe] = useState<string>(() => load("ticket-me", () => "Dana (office)"));
  const [prefill, setPrefill] = useState<any>(null);
  const [project, setProject] = useState(() => load("project", () => "J2041"));
  const { say, node } = useToast();

  useEffect(() => { s.now = Date.now(); keep(KEY, s); }, [s, ver]);
  useEffect(() => { keep("ticket-me", me); }, [me]);
  useEffect(() => { history.replaceState(null, "", "#" + view + (view === "records" ? ":" + sub : "")); }, [view, sub]);

  const act = useCallback<Ctx["act"]>((fn, ok) => {
    try { s.now = Date.now(); fn(); setVer((v) => v + 1); if (ok) say(typeof ok === "function" ? ok() : ok); return true; }
    catch (e: any) { say(e.message, true); setVer((v) => v + 1); return false; }
  }, [s, say]);
  const go = useCallback((v: string, ticket?: number) => {
    const [a, b] = v.split(":"); setView(a); if (b) setSub(b); if (ticket) setSel(ticket); window.scrollTo(0, 0);
  }, []);
  const ctx = useMemo<Ctx>(() => ({ s, T, me, ver, act, go, say }), [s, me, ver, act, go, say]);

  const reset = () => { wipe(KEY); const n = fresh(); setS(n); setSel(n.tickets[0].id); say("Demo reset to the starting sample shop."); };
  const loadSample = () => act(() => {
    const have = new Set(s.tickets.map((t: any) => t.title));
    let n = 0;
    EXTRA.forEach((e) => { if (have.has(e.title)) return; const t = T.createTicket(s, { ...e, tagOut: false }); t.createdAt = s.now - (n + 1) * 5 * 3600000; n++; });
    s.autoLog.push({ at: s.now, kind: "info", text: `Loaded ${n} more sample tickets.` });
    if (!n) throw new Error("The sample tickets are already loaded. Reset Demo to start over.");
  }, "Loaded more sample tickets.");
  const runAutomation = () => act(() => {
    const lines: string[] = [];
    const MAINT: Record<string, string> = { Paint: "Lou (maintenance)", "Weld bay": "Lou (maintenance)", Yard: "Lou (maintenance)", QA: "Marco (fab)", "Tool crib": "Lou (maintenance)" };
    s.tickets.filter((t: any) => t.status === "New" && !t.assignee).forEach((t: any) => { const who = MAINT[t.area] || "Lou (maintenance)"; T.assign(s, t.id, who, "Automation"); lines.push(`Assigned #${t.id} to ${who}`); });
    T.overdue(s).forEach((tl: any) => lines.push(`Reminder queued for ${tl.holder}: ${tl.id} is late (demo, not sent)`));
    s.rentals.forEach((r: any) => { const a = T.rentalAlert(r, s.now); if (a === "overdue" || a === "call off-rent") lines.push(`Flagged ${r.id} ${r.item}: ${a}`); });
    s.punch.filter((p: any) => p.status !== "Verified" && p.due < s.now).forEach((p: any) => lines.push(`Reminder queued for ${p.assignee}: ${p.id} past due (demo, not sent)`));
    if (!lines.length) lines.push("Nothing to do. Every new ticket already has an owner.");
    lines.forEach((l) => s.autoLog.push({ at: s.now, kind: l.startsWith("Assigned") ? "ok" : l.startsWith("Nothing") ? "info" : "warn", text: l }));
    s.lastAuto = lines.length;
  }, () => `Automation ran: ${s.lastAuto} action(s). See Notifications for the log.`);

  const unread = notifications(s, T).filter((n) => !s.readNotes[n.id]).length;
  const count: Record<string, number> = { tickets: s.tickets.filter((t: any) => t.status !== "Done").length, req: s.reqs.filter((r: any) => r.status === "Requested").length, punch: s.punch.filter((p: any) => p.status !== "Verified").length, notify: unread };

  const nav = (
    <nav className="sgrp ttn" aria-label="Tool Ticket System">
      <p className="brand">TOOL TICKET SYSTEM</p>
      {NAV.map(([g, items]) => <div key={g} className="ttg"><h3>{g}</h3>{items.map(([k, l, ic]) => (
        <a key={k} href={"#" + k} className={view === k ? "on" : ""} aria-current={view === k ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(k); }}>
          <Icon n={ic} /><span>{l}</span>{count[k] ? <b className={`ct${k === "notify" ? " hot" : ""}`}>{count[k]}</b> : null}
        </a>))}</div>)}
    </nav>
  );

  return (
    <C.Provider value={ctx}>
      <Shell demo="ticket" kicker="Tool management" title="Tool Ticket System" sub={`${TITLES[view]}. Track, assign and resolve tool and equipment requests across the shop. Saved in this browser until you reset.`}
        project={project} onProject={(id) => { setProject(id); keep("project", id); say("Sample project: " + PROJECTS.find((p) => p.id === id)!.name + "."); }} nav={nav} toast={node}
        actions={<>
          <label className="actas"><span>Acting as</span><select value={me} onChange={(e) => { setMe(e.target.value); say("You're now " + e.target.value + "."); }}>{s.people.map((p: string) => <option key={p}>{p}</option>)}</select></label>
          <Btn icon="reset" onClick={reset}>Reset Demo</Btn>
          <Btn icon="upload" onClick={loadSample}>Load Sample Data</Btn>
          <Btn kind="primary" icon="bolt" onClick={runAutomation}>Run Automation</Btn>
        </>}>
        {view === "dashboard" && <Dashboard sel={sel} setSel={setSel} />}
        {view === "tickets" && <Board onOpen={(id) => go("dashboard", id)} />}
        {view === "new" && <NewTicket key={JSON.stringify(prefill)} prefill={prefill} onDone={(id) => { setPrefill(null); go("dashboard", id); }} />}
        {view === "req" && <Requisitions />}
        {view === "punch" && <Punchlist />}
        {view === "rent" && <Rentals />}
        {view === "qa" && <QA />}
        {view === "qasum" && <QASummary />}
        {view === "qatrend" && <QATrends />}
        {view === "templates" && <Templates onUse={(_k, body) => { setPrefill(body); go("new"); say("Template loaded into a new ticket. Check it and open it."); }} />}
        {view === "records" && <RecordsHub sub={sub} setSub={setSub} />}
        {view === "notify" && <Notifications />}
        {view === "health" && <Health />}
      </Shell>
    </C.Provider>
  );
}
