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
  btn: [number, number, number, number]; // the painted Launch Demo button, same units
};

export const STATIONS: Station[] = [
  { id: "ticket", code: "TKT", name: "Tool Ticket System", blurb: "Tickets, tool crib, QA/QC, JHAs, rentals and lockout/tagout.", href: "/demos/ticket/", accent: "orange", box: [124, 414, 500, 787], btn: [227, 742, 404, 777] },
  { id: "extract", code: "DOC", name: "Doc Extract", blurb: "Pull fields off PDFs, drawings and invoices.", href: "/demos/extract/", accent: "blue", box: [523, 414, 873, 787], btn: [614, 742, 789, 777] },
  { id: "organizer", code: "ORG", name: "File Organizer", blurb: "Turn a messy pile of files into named job folders.", href: "/demos/organizer/", accent: "blue", box: [893, 414, 1249, 787], btn: [987, 742, 1162, 777] },
  { id: "estimating", code: "EST", name: "Steel Estimating", blurb: "Weights and tons from a member list.", href: "/demos/estimating/", accent: "orange", box: [1270, 414, 1643, 787], btn: [1368, 742, 1543, 777] },
];

export const pct = (s: Station) => ({
  left: `${(s.box[0] / SCENE.w) * 100}%`,
  top: `${(s.box[1] / SCENE.h) * 100}%`,
  width: `${((s.box[2] - s.box[0]) / SCENE.w) * 100}%`,
  height: `${((s.box[3] - s.box[1]) / SCENE.h) * 100}%`,
});

// Launch Demo button position inside its station box, in % of the box
export const btnPct = (s: Station) => {
  const bw = s.box[2] - s.box[0], bh = s.box[3] - s.box[1];
  return { left: `${((s.btn[0] - s.box[0]) / bw) * 100}%`, top: `${((s.btn[1] - s.box[1]) / bh) * 100}%`, width: `${((s.btn[2] - s.btn[0]) / bw) * 100}%`, height: `${((s.btn[3] - s.btn[1]) / bh) * 100}%` };
};
