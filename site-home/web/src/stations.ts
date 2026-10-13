// Landing art and where each clickable thing sits on it, in pixels of the baked image (1672 x 941).
export const SCENE = { w: 1672, h: 941 };
export const LAND_SRC = "/assets/home/land-scene.webp.svg";
export const PROD_SRC = "/assets/home/prod-scene.webp.svg";

export type Station = { id: string; box: [number, number, number, number]; accent: string; lift: boolean };

export const LAND: Station[] = [
  { id: "programs", box: [96, 524, 430, 693], accent: "#f97316", lift: true },
  { id: "workflows", box: [474, 538, 813, 684], accent: "#3b82f6", lift: true },
  { id: "dashboards", box: [852, 538, 1225, 690], accent: "#22c55e", lift: true },
  { id: "answering", box: [1241, 528, 1587, 690], accent: "#a855f7", lift: true },
  { id: "lab", box: [607, 836, 1039, 908], accent: "#f97316", lift: false },
  { id: "email", box: [163, 852, 552, 908], accent: "#f97316", lift: false },
  { id: "site", box: [1123, 852, 1499, 908], accent: "#f97316", lift: false },
];

export const PROD: Station[] = [
  { id: "ticket", box: [37, 612, 429, 812], accent: "#f97316", lift: true },
  { id: "estimating", box: [474, 612, 817, 812], accent: "#3b82f6", lift: true },
  { id: "extract", box: [857, 612, 1194, 812], accent: "#22c55e", lift: true },
  { id: "organizer", box: [1249, 600, 1633, 815], accent: "#a855f7", lift: true },
  { id: "ticket-buy", box: [70, 815, 370, 880], accent: "#f97316", lift: false },
  { id: "estimating-buy", box: [510, 818, 780, 878], accent: "#3b82f6", lift: false },
  { id: "extract-buy", box: [895, 818, 1160, 875], accent: "#22c55e", lift: false },
  { id: "organizer-buy", box: [1295, 822, 1600, 885], accent: "#a855f7", lift: false },
];
