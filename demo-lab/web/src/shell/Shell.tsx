import { ReactNode } from "react";
import { Icon } from "./ui";
import Footer from "./Footer";

export const DEMOS = [
  { id: "ticket", name: "Tool Ticket System", href: "/demos/ticket/", icon: "ticket" },
  { id: "extract", name: "Doc Extract", href: "/demos/extract/", icon: "doc" },
  { id: "organizer", name: "File Organizer", href: "/demos/organizer/", icon: "folder" },
  { id: "estimating", name: "Steel Estimating", href: "/demos/estimating/", icon: "steel" },
];
export const PROJECTS = [
  { id: "J2041", name: "Pine Hollow Storage", job: "J2041 PineHollow" },
  { id: "J2047", name: "Cedar Run Stair", job: "J2047 CedarRun" },
  { id: "J2052", name: "Mill Pond Canopy", job: "J2052 MillPond" },
];

type Props = {
  demo: string; kicker: string; title: string; sub: string; actions?: ReactNode;
  project: string; onProject: (id: string) => void; nav?: ReactNode; children: ReactNode; toast?: ReactNode;
};

export default function Shell({ demo, kicker, title, sub, actions, project, onProject, nav, children, toast }: Props) {
  const d = DEMOS.find((x) => x.id === demo)!;
  return (
    <div className="app">
      <a className="skip" href="#work">Skip to the workspace</a>
      <aside className="side">
        <a className="logo" href="/" aria-label="GMA Demo Lab home">
          <b>GMA</b><span>Granite Models<br />Automations<small>Demo Lab</small></span>
        </a>
        <nav aria-label="Demo tools" className={`sgrp${nav ? " compact" : ""}`}>
          <h3>Demo tools</h3>
          {DEMOS.map((x) => (
            <a key={x.id} href={x.href} className={x.id === demo ? "on" : ""} aria-current={x.id === demo ? "page" : undefined} title={x.name}>
              <Icon n={x.icon} /><span>{x.name}</span>
            </a>
          ))}
        </nav>
        {nav}
        <div className="sgrp projects">
          <h3>Sample projects</h3>
          {PROJECTS.map((p) => (
            <button key={p.id} type="button" className={p.id === project ? "on" : ""} aria-pressed={p.id === project} onClick={() => onProject(p.id)}>
              <Icon n="folder" /><span>{p.name}</span>
            </button>
          ))}
        </div>
        <div className="widget" aria-hidden="true">
          <h4>GMA Local Automation</h4>
          <div className="wl"><i /><i /><i /><i /></div>
          <p><span className="dot" /> Demo sandbox online</p>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Demo Lab</a><span>/</span><a href={d.href} aria-current="page"><b>{d.name}</b></a><span>/</span><span>Workspace</span>
          </nav>
          <div className="top-r">
            <span className="env"><span className="dot" />Sandbox environment</span>
            <label className="proj"><span className="sr-only">Sample project</span>
              <select value={project} onChange={(e) => onProject(e.target.value)}>
                {PROJECTS.map((p) => <option key={p.id} value={p.id}>{p.name} (sample)</option>)}
              </select>
            </label>
            <span className="av" title="Demo user">DL</span>
          </div>
        </header>
        <main id="work" className="work">
          <div className="head">
            <div>
              <p className="kick">GMA / {kicker} / Interactive demo</p>
              <h1>{title} <em>Workspace</em></h1>
              <p className="sub">{sub} <span className="sample">Sample data</span></p>
            </div>
            {actions && <div className="acts">{actions}</div>}
          </div>
          {children}
        </main>
        <Footer />
      </div>
      {toast}
    </div>
  );
}
