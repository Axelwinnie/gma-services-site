/* The demo logic libraries are plain scripts (shared with the Node tests) that attach to window. */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    GMATickets: any; GMAEstimate: any; GMAShapes: any; GMASamples: any[]; GMAXlsx: { build: (sheets: { name: string; rows: unknown[][] }[]) => Blob };
    GMAOrganizer: any; GMAOrganizerSamples: any[]; GMAZip: { zip: (files: { name: string; data: string }[]) => Blob };
    GMAFields: any; GMAExtractSamples: any[]; pdfjsLib: any; Tesseract: any;
  }
}
export {};
