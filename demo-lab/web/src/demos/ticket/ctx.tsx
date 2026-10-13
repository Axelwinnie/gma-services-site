/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState } from "react";

export type Ctx = {
  s: any; T: any; me: string; ver: number;
  act: (fn: () => unknown, ok?: string | (() => string)) => boolean;
  go: (view: string, ticket?: number) => void;
  say: (t: string, bad?: boolean) => void;
};
export const C = createContext<Ctx>(null as unknown as Ctx);
export const useT = () => useContext(C);

export const JOBS = ["J2041 PineHollow", "J2047 CedarRun", "J2052 MillPond"];
export const VENDORS = ["Northfield Steel Supply", "Kettle Brook Coatings", "Blue Ledge Building Supply"];
export const money = (n: number) => "$" + Math.round(n).toLocaleString();
export const when = (ms: number) => { const d = new Date(ms); return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
export const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export const STATUS_TONE: Record<string, string> = { New: "orange", Assigned: "purple", "In progress": "blue", "Waiting on parts": "gray", Done: "green" };
export const PRIO_TONE = (p: string) => (p.indexOf("Down") === 0 ? "red" : p === "High" ? "red" : p === "Normal" ? "orange" : "green");

/* Local form state with inline validation from the model's error.fields. */
export function useForm<V extends Record<string, any>>(init: V) {
  const [v, setV] = useState<V>(init);
  const [bad, setBad] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  return {
    v, msg, bad: (k: string) => bad.indexOf(k) >= 0,
    set: (k: keyof V) => (e: { target: { value: string; checked?: boolean; type?: string } }) => setV((o) => ({ ...o, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value })),
    put: (o: Partial<V>) => setV((x) => ({ ...x, ...o })),
    reset: () => { setV(init); setBad([]); setMsg(""); },
    run: (fn: () => void) => {
      try { fn(); setBad([]); setMsg(""); return true; }
      catch (e: any) {
        setBad(e.fields || []); setMsg(e.message);
        const first = (e.fields || [])[0];
        if (first) setTimeout(() => (document.querySelector(`[data-f="${first}"]`) as HTMLElement | null)?.focus(), 0);
        return false;
      }
    },
  };
}
