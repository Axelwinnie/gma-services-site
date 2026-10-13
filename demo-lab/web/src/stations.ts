// Scene art and where each tool sits on it, in pixels of the source image.
// To swap the art: change SCENE, then fix the boxes below.
export const SCENE = {
  w: 1672,
  h: 941,
  large: "/assets/lab-scene.avif.svg",
  largeWebp: "/assets/lab-scene.webp.svg",
  small: "/assets/lab-scene-960.avif.svg",
};

export type Station = {
  id: string; code: string; name: string; blurb: string; href: string;
  accent: "orange" | "blue"; box: [number, number, number, number]; // x0, y0, x1, y1
};

export const STATIONS: Station[] = [
  { id: "ticket", code: "TKT", name: "Tool Ticket System", blurb: "Tickets, tool crib, QA/QC, JHAs, rentals and lockout/tagout.", href: "/demos/ticket/", accent: "orange", box: [124, 414, 500, 787] },
  { id: "extract", code: "DOC", name: "Doc Extract", blurb: "Pull fields off PDFs, drawings and invoices.", href: "/demos/extract/", accent: "blue", box: [523, 414, 873, 787] },
  { id: "organizer", code: "ORG", name: "File Organizer", blurb: "Turn a messy pile of files into named job folders.", href: "/demos/organizer/", accent: "blue", box: [893, 414, 1249, 787] },
  { id: "estimating", code: "EST", name: "Steel Estimating", blurb: "Weights and tons from a member list.", href: "/demos/estimating/", accent: "orange", box: [1270, 414, 1643, 787] },
];

export const pct = (s: Station) => ({
  left: `${(s.box[0] / SCENE.w) * 100}%`,
  top: `${(s.box[1] / SCENE.h) * 100}%`,
  width: `${((s.box[2] - s.box[0]) / SCENE.w) * 100}%`,
  height: `${((s.box[3] - s.box[1]) / SCENE.h) * 100}%`,
});
