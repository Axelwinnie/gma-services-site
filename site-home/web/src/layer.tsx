import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Station } from "./stations";

const Scene3D = lazy(() => import("./Scene3D"));

function want3D() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (!window.matchMedia("(min-width: 761px)").matches) return false;
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

// The stations are real links in the HTML (they work with no JS). This only adds the 3D layer and hover state.
export function Layer({ stage, src, stations, onClick }: { stage: HTMLElement; src: string; stations: Station[]; onClick?: (a: HTMLAnchorElement, e: MouseEvent) => boolean }) {
  const [on, setOn] = useState(want3D);
  const [hot, setHot] = useState<string | null>(null);
  const [going, setGoing] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const mq = [window.matchMedia("(prefers-reduced-motion: reduce)"), window.matchMedia("(min-width: 761px)")];
    const f = () => setOn(want3D());
    mq.forEach((m) => m.addEventListener("change", f));
    const links = [...stage.querySelectorAll<HTMLAnchorElement>("a[data-st]")];
    const offs = links.map((a) => {
      const id = a.dataset.st!;
      const enter = () => { setHot(id); a.parentElement?.classList.add("on"); };
      const leave = () => { setHot((h) => (h === id ? null : h)); a.parentElement?.classList.remove("on"); };
      const click = (e: MouseEvent) => {
        if (onClick && onClick(a, e)) return;
        if (a.getAttribute("href")!.startsWith("#") || !stage.classList.contains("is-ready") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === "_blank" || a.href.startsWith("mailto:")) return;
        e.preventDefault(); setGoing(id); window.setTimeout(() => { window.location.href = a.href; }, 380);
      };
      a.addEventListener("mouseenter", enter); a.addEventListener("mouseleave", leave);
      a.addEventListener("focus", enter); a.addEventListener("blur", leave); a.addEventListener("click", click);
      return () => { a.removeEventListener("mouseenter", enter); a.removeEventListener("mouseleave", leave); a.removeEventListener("focus", enter); a.removeEventListener("blur", leave); a.removeEventListener("click", click); };
    });
    const back = () => setGoing(null); // coming back with the browser Back button
    window.addEventListener("pageshow", back);
    return () => { offs.forEach((o) => o()); mq.forEach((m) => m.removeEventListener("change", f)); window.removeEventListener("pageshow", back); };
  }, [stage]);
  useEffect(() => { stage.classList.toggle("is-3d", on); stage.classList.toggle("is-ready", on && ready); }, [on, ready, stage]);
  return on ? <Suspense fallback={null}><Scene3D hot={hot} going={going} src={src} stations={stations} onReady={() => setReady(true)} /></Suspense> : null;
}

export function mount(src: string, stations: Station[], onClick?: (a: HTMLAnchorElement, e: MouseEvent) => boolean) {
  const stage = document.getElementById("stage")!;
  createRoot(document.getElementById("scene3d")!).render(<Layer stage={stage} src={src} stations={stations} onClick={onClick} />);
}
