/* eslint-disable @typescript-eslint/no-explicit-any */
// Demo data persists in localStorage until Reset Demo. Nothing is sent anywhere.
export function load<T>(key: string, fresh: () => T): T {
  try { const raw = localStorage.getItem("gma-demo:" + key); if (raw) return JSON.parse(raw) as T; } catch { /* private mode or bad data: start fresh */ }
  return fresh();
}
export function keep(key: string, v: unknown) {
  try { localStorage.setItem("gma-demo:" + key, JSON.stringify(v)); return true; } catch { return false; }
}
export function wipe(key: string) { try { localStorage.removeItem("gma-demo:" + key); } catch { /* ignore */ } }
/* File attachments are kept as small data URLs so they survive a reload. */
export function readSmall(file: File, max = 350000): Promise<string | null> {
  return new Promise((ok) => { if (file.size > max) return ok(null); const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ok(null); r.readAsDataURL(file); });
}
