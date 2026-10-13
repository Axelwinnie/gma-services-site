import { ReactNode, useEffect, useState } from "react";

const P: Record<string, string> = {
  ticket: "M9 3h6l1 2h3v16H5V5h3zM9 10h6M9 14h6M9 18h4",
  doc: "M6 3h8l5 5v13H6zM14 3v5h5M9 13h7M9 17h7",
  folder: "M3 6h6l2 2h10v11H3z",
  steel: "M5 4h14M5 20h14M12 4v16M8 4v2M16 4v2M8 18v2M16 18v2",
  box: "M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  weight: "M8 8a4 4 0 118 0M5 8h14l2 12H3z",
  cash: "M3 6h18v12H3zM12 9a3 3 0 100 6 3 3 0 000-6",
  clock: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2",
  calc: "M6 3h12v18H6zM8 6h8v4H8zM9 13h1M12 13h1M15 13h1M9 16h1M12 16h1M15 16h1",
  reset: "M4 4v6h6M5 15a7 7 0 102-8L4 10",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  download: "M12 4v12M7 11l5 5 5-5M4 20h16",
  play: "M7 4l12 8-12 8z",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  filter: "M4 5h16l-6 8v6l-4 2v-8z",
  check: "M5 12l5 5 9-10",
  gear: "M12 9a3 3 0 100 6 3 3 0 000-6zM12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  pause: "M8 5v14M16 5v14",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4zM10 20h4",
  heart: "M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  plus: "M12 5v14M5 12h14",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  tag: "M3 12V3h9l9 9-9 9zM7.5 7.5h.01",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  file: "M6 3h8l5 5v13H6zM14 3v5h5",
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 118 0v4",
  wrench: "M14 7a4 4 0 005 5l-8 8-3-3 8-8a4 4 0 01-2-2z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  cart: "M3 4h2l2 11h11l2-8H6M9 20h.01M17 20h.01",
  punch: "M9 11l3 3 8-8M20 12v7H4V5h11",
  orbit: "M12 3a9 4 0 100 18 9 4 0 000-18zM3 12a9 4 0 0018 0",
  pan: "M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3",
  zoom: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4M8 11h6M11 8v6",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  x: "M6 6l12 12M18 6L6 18",
  dots: "M12 6h.01M12 12h.01M12 18h.01",
};
export function Icon({ n, s = 16 }: { n: string; s?: number }) {
  return <svg className="ic" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={P[n] || P.file} /></svg>;
}

export function Btn({ kind = "ghost", icon, children, ...p }: { kind?: "primary" | "ghost" | "blue" | "green" | "red" | "quiet"; icon?: string; children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`btn btn-${kind}`} {...p}>{icon && <Icon n={icon} />}{children}</button>;
}

export function Kpi({ label, value, sub, icon, tone }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string; tone?: "orange" | "blue" | "green" | "red" }) {
  return (
    <div className={`kpi${tone ? " t-" + tone : ""}`}>
      <div><span className="kpi-l">{label}</span><b className="kpi-v">{value}</b>{sub && <span className="kpi-s">{sub}</span>}</div>
      {icon && <span className="kpi-i"><Icon n={icon} s={22} /></span>}
    </div>
  );
}

export function Panel({ n, title, sub, tools, children, className = "" }: { n?: string; title: string; sub?: string; tools?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <header className="ph">
        <div><h2>{n && <span className="pn">{n} /</span>} {title}</h2>{sub && <p>{sub}</p>}</div>
        {tools && <div className="pt">{tools}</div>}
      </header>
      <div className="pb">{children}</div>
    </section>
  );
}

export function Badge({ tone = "gray", children }: { tone?: string; children: ReactNode }) {
  return <span className={`bd bd-${tone}`}>{children}</span>;
}

export function Tabs({ tabs, value, onChange, small }: { tabs: [string, string][]; value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <div className={`tabs${small ? " sm" : ""}`} role="tablist">
      {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`tg${on ? " on" : ""}`} onClick={() => onChange(!on)}><i /></button>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="sb"><Icon n="search" /><span className="sr-only">{placeholder}</span><input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>;
}

export function Field({ label, error, children }: { label: string; error?: boolean; children: ReactNode }) {
  return <label className={`fl${error ? " bad" : ""}`}><span>{label}</span>{children}</label>;
}

/* Toast line for results and validation messages. */
export function useToast() {
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(null), 5200); return () => clearTimeout(id); }, [msg]);
  const node = <div className={`toast${msg ? " on" : ""}${msg?.bad ? " bad" : ""}`} role="status" aria-live="polite">{msg?.t}</div>;
  return { say: (t: string, bad = false) => setMsg({ t, bad }), node };
}

export function Menu({ label, icon, kind = "primary", items }: { label: string; icon?: string; kind?: "primary" | "ghost"; items: [string, () => void][] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <Btn kind={kind} icon={icon} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>{label}</Btn>
      {open && <div className="menu-l" role="menu">{items.map(([l, f]) => <button key={l} type="button" role="menuitem" onClick={() => { setOpen(false); f(); }}>{l}</button>)}</div>}
    </div>
  );
}
