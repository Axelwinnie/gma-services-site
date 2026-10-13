import { lazy, Suspense, useEffect, useState } from "react";
import { STATIONS, pct } from "./stations";
import Hud from "./Hud";

const Lab3D = lazy(() => import("./Lab3D"));

function want3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 761px)").matches) return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export default function App() {
  const [use3D, setUse3D] = useState(want3D);
  const [hot, setHot] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [going, setGoing] = useState<string | null>(null);

  useEffect(() => {
    const mq = [window.matchMedia("(prefers-reduced-motion: reduce)"), window.matchMedia("(min-width: 761px)")];
    const on = () => setUse3D(want3D());
    mq.forEach((m) => m.addEventListener("change", on));
    return () => mq.forEach((m) => m.removeEventListener("change", on));
  }, []);

  const launch = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!use3D || !ready || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const href = e.currentTarget.href;
    setGoing(id);
    window.setTimeout(() => { window.location.href = href; }, 420);
  };

  return (
    <>
      <a className="skip" href="#stations">Skip to the demos</a>
      <header className="bar">
        <a className="mark" href="/"><span className="full">Granite Models Automations</span><span className="short">GMA</span> <span className="accent">Demo Lab</span></a>
        <Hud hot={hot} />
        <nav className="contact" aria-label="Contact">
          <a className="b b-quiet" href="tel:+19786473933"><span className="full">(978) 647-3933</span><span className="short">Call</span></a>
          <a className="b" href="mailto:granitemodels@gmail.com"><span className="full">granitemodels@gmail.com</span><span className="short">Email</span></a>
        </nav>
      </header>
      <main id="main">
        <h1 className="sr-only">GMA Demo Lab: shop software you can try right now, on made up sample data</h1>
        <section id="stage" className={`stage${use3D ? " is-3d" : ""}${ready ? " is-ready" : ""}`} aria-label="Demo Lab stations">
          {use3D && (
            <Suspense fallback={null}>
              <Lab3D hot={hot} going={going} onHover={setHot} onReady={() => setReady(true)} />
            </Suspense>
          )}
          <ul id="stations" className="hits">
            {STATIONS.map((s, i) => (
              <li key={s.id} style={{ ...pct(s), ["--i" as string]: i }} className={`hit ${s.accent}${hot === s.id ? " on" : ""}`}>
                <a href={s.href} onMouseEnter={() => setHot(s.id)} onMouseLeave={() => setHot(null)}
                   onFocus={() => setHot(s.id)} onBlur={() => setHot(null)} onClick={(e) => launch(e, s.id)}>
                  <span className="live" aria-hidden="true"><i />{s.code} / LIVE</span>
                  <span className="sr-only">{s.name}. {s.blurb} Launch demo.</span>
                </a>
              </li>
            ))}
          </ul>
          {/* the baked sidebar labels in the art are live shortcuts, never dead text */}
          <div className="side" aria-hidden="true">
            {STATIONS.map((s, i) => (
              <a key={s.id} href={s.href} tabIndex={-1} style={{ top: `${((189 + i * 34) / 941) * 100}%` }}
                 onMouseEnter={() => setHot(s.id)} onMouseLeave={() => setHot(null)} onClick={(e) => launch(e, s.id)} />
            ))}
          </div>
        </section>
        <ul className="tiles" aria-label="Demos">
          {STATIONS.map((s) => (
            <li key={s.id}>
              <a className={`tile ${s.accent}`} href={s.href}>
                <span className="t-c">{s.code} / LIVE</span>
                <span className="t-n">{s.name}</span>
                <span className="t-d">{s.blurb}</span>
                <span className="t-b">Launch demo</span>
              </a>
            </li>
          ))}
        </ul>
      </main>
      <footer className="foot"><p>Granite Models Automations. Every demo runs in your browser on made up sample data.</p></footer>
    </>
  );
}
