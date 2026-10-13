import { useEffect, useState } from "react";
import { STATIONS } from "./stations";

const LINES = ["Sandbox online", "4 demos live", "Resets on reload", "Fake data only"];

// Animated status readout. Every line is true: no invented figures.
export default function Hud({ hot }: { hot: string | null }) {
  const [n, setN] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setInterval(() => {
      setSecs((s) => s + 1);
      if (!reduce) setN((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, []);
  const st = STATIONS.find((s) => s.id === hot);
  const line = st ? `${st.code} / ${st.name}` : LINES[Math.floor(n / 3) % LINES.length];
  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  return (
    <p className="readout" aria-hidden="true">
      <span className="dot" />
      <span className="line" key={line}>{line}</span>
      <span className="sep">/</span>
      <span className="clock">Session {mm}:{ss}</span>
    </p>
  );
}
