// Sample shop for the File Processor demo. Destination names are the
// labels a shop sees. This demo never sends a file anywhere.

export type DestId = "takeoff" | "documents" | "bookkeeping" | "keep";
export type FileStatus = "inbox" | "review" | "filed";
export type PageId = "inbox" | "review" | "filed" | "activity" | "settings" | "licence";

export const PAGES: { id: PageId; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "review", label: "Review" },
  { id: "filed", label: "Filed" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
  { id: "licence", label: "Licence" },
];

export const DESTINATIONS: { id: DestId; label: string; note: string }[] = [
  { id: "takeoff", label: "Takeoff", note: "Steel Estimating on this PC" },
  { id: "documents", label: "Documents", note: "Doc Extract on this PC" },
  { id: "bookkeeping", label: "Bookkeeping", note: "The bookkeeping folder on this PC" },
  { id: "keep", label: "Keep in this shop", note: "Stays in File Processor" },
];

export type ShopFile = {
  id: string;
  name: string;
  jobId: string;
  kind: string;
  size: string;
  arrived: string;
  path: string;
  excerpt: string;
  suggested: DestId;
  status: FileStatus;
  destination: DestId | null;
  filedAt: string | null;
};

export type ActivityRow = { at: string; action: string; detail: string };

export type Settings = { shopName: string; inbox: string; ask: boolean };

export type ShopState = {
  version: 1;
  selectedId: string;
  settings: Settings;
  files: ShopFile[];
  activity: ActivityRow[];
};

export const destLabel = (id: DestId | null) => DESTINATIONS.find((d) => d.id === id)?.label ?? "";

export const statusLabel = (s: FileStatus) => (s === "inbox" ? "Waiting" : s === "review" ? "In review" : "Filed");

const FILES: ShopFile[] = [
  {
    id: "f1",
    name: "PineHollow-W12x26.pdf",
    jobId: "J2041",
    kind: "PDF",
    size: "842 KB",
    arrived: "2026-11-08 13:40",
    path: "C:\\Shops\\Pine Hollow\\Inbox\\PineHollow-W12x26.pdf",
    excerpt: "W12×26 beams along grid B. Pine Hollow Storage, sample takeoff sheet. 18 pieces, 4.2 tons.",
    suggested: "takeoff",
    status: "inbox",
    destination: null,
    filedAt: null,
  },
  {
    id: "f2",
    name: "CedarRun-invoice-8841.pdf",
    jobId: "J2047",
    kind: "PDF",
    size: "210 KB",
    arrived: "2026-11-08 13:44",
    path: "C:\\Shops\\Cedar Run\\Inbox\\CedarRun-invoice-8841.pdf",
    excerpt: "Invoice 8841. Cedar Run Stair, sample. Steel stair and rails, $4,280.00.",
    suggested: "bookkeeping",
    status: "inbox",
    destination: null,
    filedAt: null,
  },
  {
    id: "f3",
    name: "MillPond-canopy-drawing.pdf",
    jobId: "J2052",
    kind: "PDF",
    size: "2.4 MB",
    arrived: "2026-11-08 13:51",
    path: "C:\\Shops\\Mill Pond\\Inbox\\MillPond-canopy-drawing.pdf",
    excerpt: "Shop drawing, Mill Pond Canopy, sheet S2. Sample. Canopy framing at the south entry.",
    suggested: "documents",
    status: "inbox",
    destination: null,
    filedAt: null,
  },
  {
    id: "f4",
    name: "PineHollow-RFI-12.pdf",
    jobId: "J2041",
    kind: "PDF",
    size: "380 KB",
    arrived: "2026-11-09 08:02",
    path: "C:\\Shops\\Pine Hollow\\Inbox\\PineHollow-RFI-12.pdf",
    excerpt: "RFI 12. Anchor bolts at line 4, Pine Hollow Storage. Sample question for the detailer.",
    suggested: "documents",
    status: "review",
    destination: null,
    filedAt: null,
  },
  {
    id: "f5",
    name: "CedarRun-field-notes.txt",
    jobId: "J2047",
    kind: "TXT",
    size: "12 KB",
    arrived: "2026-11-09 08:11",
    path: "C:\\Shops\\Cedar Run\\Inbox\\CedarRun-field-notes.txt",
    excerpt: "Field notes, Cedar Run Stair. Landing height checked on site. Sample. Keep with the job.",
    suggested: "keep",
    status: "review",
    destination: null,
    filedAt: null,
  },
  {
    id: "f6",
    name: "MillPond-bolt-list.xlsx",
    jobId: "J2052",
    kind: "XLSX",
    size: "64 KB",
    arrived: "2026-11-07 15:12",
    path: "C:\\Shops\\Mill Pond\\Inbox\\MillPond-bolt-list.xlsx",
    excerpt: "Bolt list for Mill Pond Canopy. Sample. A325, 3/4 inch, quantities by mark.",
    suggested: "takeoff",
    status: "filed",
    destination: "takeoff",
    filedAt: "2026-11-07 16:05",
  },
  {
    id: "f7",
    name: "PineHollow-pay-app-03.pdf",
    jobId: "J2041",
    kind: "PDF",
    size: "510 KB",
    arrived: "2026-11-06 08:40",
    path: "C:\\Shops\\Pine Hollow\\Inbox\\PineHollow-pay-app-03.pdf",
    excerpt: "Pay application 03, Pine Hollow Storage. Sample. Period ending 31 Oct 2026.",
    suggested: "bookkeeping",
    status: "filed",
    destination: "bookkeeping",
    filedAt: "2026-11-06 09:18",
  },
];

const ACTIVITY: ActivityRow[] = [
  { at: "2026-11-09 08:20", action: "Opened for review", detail: "CedarRun-field-notes.txt" },
  { at: "2026-11-09 08:12", action: "Opened for review", detail: "PineHollow-RFI-12.pdf" },
  { at: "2026-11-08 13:51", action: "Arrived", detail: "MillPond-canopy-drawing.pdf" },
  { at: "2026-11-08 13:44", action: "Arrived", detail: "CedarRun-invoice-8841.pdf" },
  { at: "2026-11-08 13:40", action: "Arrived", detail: "PineHollow-W12x26.pdf" },
  { at: "2026-11-07 16:05", action: "Sent", detail: "MillPond-bolt-list.xlsx to Takeoff" },
  { at: "2026-11-06 09:18", action: "Sent", detail: "PineHollow-pay-app-03.pdf to Bookkeeping" },
];

export function fresh(): ShopState {
  return {
    version: 1,
    selectedId: "f1",
    settings: { shopName: "Demo Shop (sample)", inbox: "C:\\GMA\\File Processor\\Inbox", ask: true },
    files: FILES.map((f) => ({ ...f })),
    activity: ACTIVITY.map((a) => ({ ...a })),
  };
}

export function stamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
