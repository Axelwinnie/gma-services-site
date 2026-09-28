import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const tradeDashboards = [
  "landscape-dashboard",
  "hvac-dashboard",
  "plumbing-dashboard",
  "construction-dashboard",
  "mechanic-dashboard",
  "paving-dashboard",
  "logging-dashboard",
  "painting-dashboard",
  "electrical-dashboard",
  "insulation-dashboard",
  "sealcoat-dashboard",
  "concrete-dashboard",
  "pool-pond-dashboard",
  "excavation-dashboard",
  "hardscape-dashboard",
  "fencing-dashboard",
  "septic-dashboard",
  "irrigation-dashboard",
  "striping-dashboard",
];

const projectSlugs = [
  "lead-hunter-pro",
  "granite-tester",
  "file-processor",
  "landscape-dashboard",
  "empire-dashboard",
  "sales-pipeline",
  "email-campaign",
  "steel-dashboard",
  "hvac-dashboard",
  "plumbing-dashboard",
  "construction-dashboard",
  "mechanic-dashboard",
  "paving-dashboard",
  "logging-dashboard",
  "painting-dashboard",
  "electrical-dashboard",
  "insulation-dashboard",
  "sealcoat-dashboard",
  "concrete-dashboard",
  "pool-pond-dashboard",
  "excavation-dashboard",
  "hardscape-dashboard",
  "fencing-dashboard",
  "septic-dashboard",
  "irrigation-dashboard",
  "striping-dashboard",
  "quote-generator",
  "proposal-generator",
  "referral-tracker",
  "social-media",
  "review-manager",
  "design-studio",
  "super-admin",
  "omniverse-apex",
  "ironworks-engine",
  "iot-sensor-hub",
  "iot-fleet-tracker",
  "smart-shop",
  "robo-dispatch",
  "robo-inspection",
  "robo-arm-controller",
  "analytics-dashboard",
  "appointment-scheduler",
  "budget-tracker",
  "business-dashboard",
  "content-calendar",
  "contract-manager",
  "customer-support-bot",
  "document-organizer",
  "employee-directory",
  "expense-tracker",
  "goal-tracker",
  "hr-onboarding",
  "inventory-manager",
  "invoice-automation",
  "job-scheduler",
  "knowledge-base",
  "meeting-notes",
  "project-tracker",
  "survey-builder",
  "time-tracker",
  "vendor-manager",
  "ai-answering-service",
  "document-automation",
  "ai-review-reputation",
  "ecommerce-return-bot",
  "safety-compliance-bot",
  "scope-identifier",
  "bidding-system",
];

const quoteSlugs = new Set(["quote-generator", "proposal-generator", "bidding-system"]);
const followSlugs = new Set(["email-campaign", "appointment-scheduler"]);
const docSlugs = {
  "document-automation": "/ai-document-packs/",
  "document-organizer": "/document-intake/",
  "file-processor": "/document-intake/",
};

function projectDestination(slug) {
  if (slug === "steel-dashboard" || slug === "scope-identifier") return "/steel-estimating/";
  if (quoteSlugs.has(slug)) return "/quote-proposal-automation/";
  if (followSlugs.has(slug)) return "/lead-follow-up/";
  if (docSlugs[slug]) return docSlugs[slug];
  if (tradeDashboards.includes(slug)) return "/trade-office-workflow/";
  return "/custom-workflow-systems/";
}

const pageRedirects = [
  ["/story", "/about/"],
  ["/systems", "/custom-workflow-systems/"],
  ["/solutions", "/workflow-automation/"],
  ["/process", "/how-it-works/"],
  ["/roadmap", "/how-it-works/"],
  ["/pricing", "/workflow-automation/"],
  ["/tools", "/custom-workflow-systems/"],
  ["/demo-videos", "/demos/"],
  ["/granite-trades-network", "/contact/"],
  ["/opportunities", "/contact/"],
  ["/build-with-us", "/contact/"],
  ["/leads", "/contact/"],
  ["/trades/landscaping", "/trade-office-workflow/"],
  ["/estimate", "/steel-estimating/"],
  ["/steel", "/steel-estimating/"],
  ["/pay", "/steel-estimating/"],
  ["/checkout", "/steel-estimating/"],
  ["/store", "/custom-workflow-systems/"],
  ["/product", "/custom-workflow-systems/"],
  ["/success", "/order-received/"],
  ["/thanks", "/order-received/"],
  ["/thank-you", "/order-received/"],
  ["/checkout/success", "/order-received/"],
  ["/payment-success", "/order-received/"],
  ["/cancel", "/payment-cancelled/"],
  ["/checkout/cancel", "/payment-cancelled/"],
  ["/api/chat", "/contact/"],
  ["/api/products", "/custom-workflow-systems/"],
  ["/api/checkout", "/steel-estimating/"],
  ["/api/store/stats", "/custom-workflow-systems/"],
  ["/videos", "/demos/"],
  ["/static", "/"],
];

const splatRedirects = [
  ["/videos/*", "/demos/"],
  ["/static/*", "/"],
  ["/product/*", "/custom-workflow-systems/"],
  ["/trades/*", "/trade-office-workflow/"],
  ["/api/*", "/contact/"],
];

export function legacyRedirectRules() {
  const rules = [];
  for (const [from, to] of pageRedirects) rules.push({ from, to, splat: false });
  for (const slug of projectSlugs) rules.push({ from: `/project/${slug}`, to: projectDestination(slug), splat: false });
  for (const [from, to] of splatRedirects) rules.push({ from, to, splat: true });
  return rules;
}

function stubHtml(domain, destination) {
  const target = destination.startsWith("http") ? destination : destination;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta http-equiv="refresh" content="0; url=${target}">
  <link rel="canonical" href="${domain}${target === "/" ? "/" : target}">
  <title>Page moved</title>
</head>
<body data-legacy-redirect="1">
  <p>This page moved. <a href="${target}">Continue</a></p>
</body>
</html>
`;
}

export function writeLegacyRedirects({ publicDir, siteRoot, domain }) {
  const rules = legacyRedirectRules();
  const lines = [];
  const rows = [];
  for (const rule of rules) {
    const sources = rule.splat || rule.from === "/" ? [rule.from] : [rule.from, `${rule.from}/`];
    for (const source of sources) {
      lines.push(`${source} ${rule.to} 301`);
      rows.push(`| \`${source}\` | \`${rule.to}\` | Redirect | 301 |`);
    }
    if (rule.splat) continue;
    const rel = rule.from.replace(/^\/+/, "");
    const file = join(publicDir, rel, "index.html");
    if (existsSync(file)) {
      const existing = readFileSync(file, "utf8");
      if (!existing.includes('data-legacy-redirect="1"')) {
        throw new Error(`Refusing to overwrite a real page with a redirect stub: ${rule.from}`);
      }
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, stubHtml(domain, rule.to));
  }
  writeFileSync(join(publicDir, "_redirects"), `${lines.join("\n")}\n`);
  const markdown = `# Render redirects for the services site

Enter these on the **static site** that publishes branch \`services-site\`. In Redirects/Rewrites, set Action to Redirect and the status to 301.

Do not add them to a service that deploys \`main\`. \`main\` stays the previous app until you point \`granitemodels.store\` at this static site.

Each old path also has a meta-refresh HTML file under \`public/\`, so the move still works before the dashboard rules are saved. Paths ending in \`*\` are dashboard rules only.

| Source | Destination | Action | Status |
| --- | --- | --- | --- |
${rows.join("\n")}
`;
  writeFileSync(join(siteRoot, "render-redirects.md"), markdown);
}
