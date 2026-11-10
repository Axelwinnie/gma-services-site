// Labels and sample rows for the File Processor shop replica.
// Destination keys stay in this file. The screen shows the labels only.

export type Bucket = "inbox" | "review" | "filed";
export type Kind = "job" | "upload" | "route";
export type PageId = "inbox" | "review" | "filed" | "activity" | "settings" | "licence";

export const PAGES: PageId[] = ["inbox", "review", "filed", "activity", "settings", "licence"];

export const LEADS: Record<PageId, [string, string]> = {
  inbox: ["Inbox", "New files land here. Drop one in, then check it before it goes to another program."],
  review: ["Review", "These files are waiting on you before they go anywhere."],
  filed: ["Filed", "Files that were sent on, or kept in this shop."],
  activity: ["Activity", "What this program has been doing on this PC."],
  settings: ["Settings", "Where files sit on this PC, and which programs they can go to."],
  licence: ["Licence", "The licence file that sits with this program."],
};

export const WHERE: Record<string, string> = {
  scope_id: "Takeoff",
  doc_automation: "Documents",
  financier: "Bookkeeping",
  archive: "Keep in this shop",
};

export const DOC: Record<string, string> = {
  structural_drawing: "Structural drawing",
  architectural_drawing: "Architectural drawing",
  rfq_bid_package: "Bid package",
  rfq: "Request for quote",
  shop_drawing: "Shop drawing",
  submittal: "Submittal",
  material_schedule: "Material list",
  invoice_po: "Purchase order or invoice",
  invoice: "Invoice",
  purchase_order: "Purchase order",
  contract_proposal: "Contract or proposal",
  general_correspondence: "Letter",
  mill_cert: "Mill certificate",
  rfi: "Question on the job",
  delivery_ticket: "Delivery ticket",
  bid_package: "Bid package",
  unknown: "Not sure yet",
};

export const ACCEPTED = /\.(pdf|docx|xlsx|xls|dwg|dxf|jpg|jpeg|png|tif|tiff)$/i;
export const ACCEPT_ATTR = ".pdf,.docx,.xlsx,.xls,.dwg,.dxf,.jpg,.jpeg,.png,.tif,.tiff";

export type Item = {
  key: string;
  bucket: Bucket;
  name: string;
  state: string;
  where: string;
  whereKey: string;
  when: string;
  kind: Kind;
  docType: string;
  project: string;
  jobNumber: string;
  notes: string;
  note: string;
};

export type Fields = {
  docType: string;
  project: string;
  jobNumber: string;
  notes: string;
  whereKey: string;
};

export const FOLDERS: [string, string][] = [
  ["This PC", "Running"],
  ["New files", "C:\\GMA\\File Processor\\new (sample)"],
  ["Finished files", "C:\\GMA\\File Processor\\finished (sample)"],
  ["Problem files", "C:\\GMA\\File Processor\\problems (sample)"],
  ["Kept here", "C:\\GMA\\File Processor\\kept (sample)"],
];

export const LICENCE_ROWS: [string, string][] = [
  ["Status", "In force"],
  ["Detail", "Sample licence for this demo."],
  ["Shop", "Demo Shop (sample)"],
  ["Issued", "2026-03-01"],
  ["End date", "None"],
];

export const HOURS_OPEN = 6;

export function whereLabel(key: string) {
  if (!key) return "Not chosen yet";
  return WHERE[key] || "Another program";
}

export function docLabel(key: string) {
  if (!key) return "Not sure yet";
  return DOC[key] || "Not sure yet";
}

export function whenLabel(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function fieldsFor(item: Item | null): Fields {
  const whereKey = item && item.whereKey && WHERE[item.whereKey] ? item.whereKey : "archive";
  const docType = item && item.docType && DOC[item.docType] ? item.docType : "unknown";
  return {
    docType,
    project: item?.project || "",
    jobNumber: item?.jobNumber || "",
    notes: item?.notes || "",
    whereKey,
  };
}

export function keptWhere() {
  return { whereKey: "archive", where: WHERE.archive };
}

const SAMPLE: Item[] = [
  {
    key: "job:w12",
    bucket: "inbox",
    name: "PineHollow-W12x26.pdf",
    state: "Waiting",
    where: "In this shop",
    whereKey: "",
    when: "2026-11-10T13:40:00.000Z",
    kind: "job",
    docType: "structural_drawing",
    project: "Pine Hollow Storage",
    jobNumber: "J2041",
    notes: "",
    note: "",
  },
  {
    key: "job:canopy",
    bucket: "inbox",
    name: "MillPond-canopy-drawing.pdf",
    state: "Waiting",
    where: "In this shop",
    whereKey: "",
    when: "2026-11-10T13:51:00.000Z",
    kind: "job",
    docType: "shop_drawing",
    project: "Mill Pond Canopy",
    jobNumber: "J2052",
    notes: "",
    note: "",
  },
  {
    key: "upload:rfi",
    bucket: "review",
    name: "PineHollow-RFI-12.pdf",
    state: "Needs you",
    where: "Documents",
    whereKey: "doc_automation",
    when: "2026-11-10T08:12:00.000Z",
    kind: "upload",
    docType: "rfi",
    project: "Pine Hollow Storage",
    jobNumber: "J2041",
    notes: "",
    note: "Dropped today. Check it before it goes out.",
  },
  {
    key: "upload:invoice",
    bucket: "review",
    name: "CedarRun-invoice-8841.pdf",
    state: "Needs you",
    where: "Bookkeeping",
    whereKey: "financier",
    when: "2026-11-09T15:20:00.000Z",
    kind: "upload",
    docType: "invoice",
    project: "Cedar Run Stair",
    jobNumber: "J2047",
    notes: "",
    note: "Dropped today. Check it before it goes out.",
  },
  {
    key: "route:bolts",
    bucket: "filed",
    name: "MillPond-bolt-list.xlsx",
    state: "Sent",
    where: "Takeoff",
    whereKey: "scope_id",
    when: "2026-11-07T16:05:00.000Z",
    kind: "route",
    docType: "material_schedule",
    project: "Mill Pond Canopy",
    jobNumber: "J2052",
    notes: "",
    note: "",
  },
  {
    key: "upload:pay",
    bucket: "filed",
    name: "PineHollow-pay-app-03.pdf",
    state: "Kept here",
    where: "Keep in this shop",
    whereKey: "archive",
    when: "2026-11-06T09:18:00.000Z",
    kind: "upload",
    docType: "invoice",
    project: "Pine Hollow Storage",
    jobNumber: "J2041",
    notes: "",
    note: "",
  },
];

export function freshItems(): Item[] {
  return SAMPLE.map((item) => ({ ...item }));
}

export function listFor(items: Item[], bucket: Bucket) {
  return items.filter((item) => item.bucket === bucket).sort((a, b) => String(b.when).localeCompare(String(a.when)));
}

export function isToday(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
