import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { legacyRedirectRules } from "./legacy-redirects.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(scriptsDir, "..");
const publicDir = join(siteRoot, "public");

const built = spawnSync(process.execPath, [join(scriptsDir, "build.mjs")], { stdio: "inherit" });
if (built.status !== 0) process.exit(built.status ?? 1);

const errors = [];
const files = walk(publicDir).filter((file) => file.endsWith(".html"));
if (files.length === 0) errors.push("No HTML files were built.");

const allowlistedNegations = [
  "no guaranteed savings",
  "not a guarantee",
  "not guaranteed",
  "aren't guaranteed",
  "isn't guaranteed",
  "don't guarantee",
  "do not guarantee",
  "no guarantee",
];

const banned = [
  "cinematic",
  "guaranteed",
  "guarantee",
  "10x",
  "replace your staff",
  "testimonial",
  "design studio",
  "6095",
  "localhost",
  "text-to-video",
  "from a prompt",
  "prompt alone",
  "lead list",
  "lead lists",
  "selling leads",
  "sell leads",
  "leads for sale",
  "buy leads",
  "join the list",
  "24/7",
  "around the clock",
  "provisional",
  "$750",
];

const requiredBrand = "Granite Models Automations";
const demoLabel = "Internal GMA demonstration using fictional sample data. Not a customer result.";
const draftLabel = "DRAFT — pending Jon's approval";

const siteConfig = JSON.parse(readFileSync(join(siteRoot, "site.config.json"), "utf8"));
const launch = process.env.LAUNCH === "true" || siteConfig.LAUNCH === true;
const formEnabled = process.env.FORM_ENABLED === "true" || siteConfig.FORM_ENABLED === true;
const workflowDollars = ["$249", "$499+", "$1,200"];
const adsDollars = ["$99"];
const packDollars = ["$79", "$99", "$149", "$179", "$249", "$299", "$399", "$499"];
const approvedDollars = new Set([...workflowDollars, ...adsDollars, ...packDollars]);

for (const file of files) {
  const html = readFileSync(file, "utf8");
  const label = relative(publicDir, file);
  if (html.includes('data-legacy-redirect="1"')) {
    checkRedirectStub(label, html);
    continue;
  }
  checkBanned(label, html);
  checkNoindex(label, html);
  checkImages(label, html);
  checkLinks(file, html);
  checkJsonLd(label, html);
  checkBrand(label, html);
  checkPhone(label, html);
  checkDemoLabel(label, html);
  checkDraft(label, html);
  checkInbox(label, html);
  checkPayments(label, html);
  checkLogo(label, html);
  checkVisibleTodo(label, html);
  checkStripeLinks(label, html);
  checkPrices(label, html);
  checkSampleScreen(label, html);
  checkAdSlot(label, html);
  checkAdsOffer(label, html);
  checkWebsitesStaySoon(label, html);
}

checkSitemap();
checkAdsJsonLd();

checkPackProducts();
checkSteelSite();
checkDomain();
checkLegacyRedirects();
checkLogoPlate();
checkLaunchFiles();
checkTelLinksStayVisible();

if (errors.length) {
  console.error(`\n${errors.length} check(s) failed:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Checked ${files.length} pages. No failures.`);

function checkBanned(label, html) {
  let text = html.toLowerCase();
  for (const phrase of allowlistedNegations) text = text.replaceAll(phrase, " ");
  for (const phrase of banned) {
    if (text.includes(phrase)) errors.push(`${label}: banned phrase "${phrase}"`);
  }
}

function checkBrand(label, html) {
  if (siteConfig.BRAND !== requiredBrand) errors.push(`BRAND must be "${requiredBrand}"`);
  if (!html.includes(requiredBrand)) errors.push(`${label}: missing brand "${requiredBrand}"`);
  if (html.includes("Granite Model Automations")) errors.push(`${label}: old brand "Granite Model Automations"`);
  if (html.includes("Granite Models & Automation")) errors.push(`${label}: old brand "Granite Models & Automation"`);
}

function checkPhone(label, html) {
  const display = "(978) 647-3933";
  const e164 = "+19786473933";
  const phoneNote = "automated answering service that routes to me.";
  if (siteConfig.PHONE_DISPLAY !== display) errors.push(`PHONE_DISPLAY must be ${display}`);
  if (siteConfig.PHONE_E164 !== e164) errors.push(`PHONE_E164 must be ${e164}`);
  if (siteConfig.PHONE_NOTE !== phoneNote) errors.push(`PHONE_NOTE must be "${phoneNote}"`);
  if (!html.includes(requiredBrand)) errors.push(`${label}: missing brand "${requiredBrand}"`);
  const exactTel = `<a href="tel:${e164}">${display}</a>`;
  if (!html.includes(exactTel)) errors.push(`${label}: missing ${exactTel}`);
  if (!html.includes(phoneNote)) errors.push(`${label}: missing answering-service note`);
  const tels = [...html.matchAll(/href="tel:([^"]+)"/g)].map((match) => match[1]);
  if (tels.some((value) => value !== e164)) errors.push(`${label}: phone link is not ${e164}`);
  for (const tag of html.matchAll(/<a\b[^>]*>/gi)) {
    if (!/href="tel:/i.test(tag[0])) continue;
    if (tag[0] !== `<a href="tel:${e164}">`) errors.push(`${label}: tel link must be exactly <a href="tel:${e164}">`);
    if (/\btarget\s*=/i.test(tag[0]) || /\bonclick\s*=/i.test(tag[0]) || /\brel\s*=/i.test(tag[0])) {
      errors.push(`${label}: tel link must not set target, rel, or onclick`);
    }
  }
  if (html.includes('class="phone-text"')) errors.push(`${label}: duplicate phone text must not be rendered`);
  if (!html.includes(`class="phone-copy" data-copy="${display}"`)) errors.push(`${label}: missing phone copy button`);
  if (html.includes("24/7") || /call us anytime/i.test(html)) errors.push(`${label}: phone label must not promise a response time`);
  if (/live receptionist|24\/7 human/i.test(html)) errors.push(`${label}: phone note must not claim a live receptionist`);
  const prominent = new Set([
    "index.html",
    "contact/index.html",
    "steel-estimating/index.html",
    "order-received/index.html",
    "payment-cancelled/index.html",
    "ai-document-packs/index.html",
    "ads-video/index.html",
    "trade-office-workflow/index.html",
    "lead-follow-up/index.html",
    "quote-proposal-automation/index.html",
    "document-intake/index.html",
    "custom-workflow-systems/index.html",
    "workflow-map/index.html",
    "zapier-make-consultant/index.html",
    "contractor-lead-follow-up/index.html",
    "fabrication-shop-workflow-map/index.html",
    "workflow-automation/index.html",
    "websites-seo-aeo/index.html",
  ]);
  if (prominent.has(label) && !html.includes('class="contact-callout"')) {
    errors.push(`${label}: contact callout missing`);
  }
}

function checkDemoLabel(label, html) {
  if (!/(^|\/)demos?(\/|$)/.test(label)) return;
  if (!html.includes(demoLabel)) errors.push(`${label}: missing demo label`);
}

function checkDraft(label, html) {
  const marked = html.includes(draftLabel);
  if (launch) {
    if (marked || html.includes("Draft site. Not published.")) {
      errors.push(`${label}: launch build still has a draft label`);
    }
    return;
  }
  if (!html.includes("Draft site. Not published.")) errors.push(`${label}: missing draft banner`);
  if (label !== "terms/index.html" && label !== "privacy/index.html") return;
  if (!marked) errors.push(`${label}: missing DRAFT label`);
}

function checkInbox(label, html) {
  const inbox = siteConfig.INBOX;
  const fallback = `Email ${inbox}`;
  if (inbox !== "granitemodels@gmail.com") errors.push("INBOX must be granitemodels@gmail.com");
  if (!html.includes(`href="mailto:${inbox}"`)) errors.push(`${label}: missing mailto for ${inbox}`);
  if (!html.includes(fallback)) errors.push(`${label}: missing fallback "${fallback}"`);
  if (label === "contact/index.html" || label === "index.html" || label === "workflow-automation/index.html") {
    const hasForm = /<form[\s>]/i.test(html);
    if (formEnabled) {
      if (!html.includes("disabled")) errors.push(`${label}: request form submit must stay disabled`);
    } else if (hasForm) {
      errors.push(`${label}: request form must stay hidden while FORM_ENABLED is false`);
    } else if (label === "contact/index.html") {
      for (const item of ["Business type", "The process", "Tools used", "3 to 5 examples", "subject=Quote%20request"]) {
        if (!html.includes(item)) errors.push(`${label}: contact block missing ${item}`);
      }
    }
  }
}

function checkPayments(label, html) {
  if (html.includes("#TODO-stripe-link") || html.includes("Payment link coming soon")) {
    errors.push(`${label}: public workflow payment placeholder is still present`);
  }
  const stripe = html.includes("buy.stripe.com");
  const stripePages = new Set(["ai-document-packs/index.html", "steel-estimating/index.html"]);
  if (stripe && !stripePages.has(label)) {
    errors.push(`${label}: buy.stripe.com is only allowed on the pack page and the steel estimating page`);
  }
  if (label === "index.html" || label === "workflow-automation/index.html") {
    const cards = [...html.matchAll(/<article class="price-card[\s\S]*?<\/article>/g)];
    if (cards.length !== 3) errors.push(`${label}: expected three workflow tier cards`);
    for (const card of cards) {
      if (!card[0].includes('href="/contact/"')) errors.push(`${label}: workflow tier CTA must go to /contact/`);
      if (/buy\.stripe\.com|#TODO-stripe-link/.test(card[0])) {
        errors.push(`${label}: workflow tier card must not include a public Stripe link`);
      }
    }
  }
}

function checkLogo(label, html) {
  const alt = "Granite Models Automations logo";
  if (siteConfig.LOGO_ALT !== alt) errors.push(`LOGO_ALT must be "${alt}"`);
  if (html.includes("brand-mark")) errors.push(`${label}: CSS placeholder logo is still present`);
  if (!html.includes('class="brand-logo"')) errors.push(`${label}: header lockup missing`);
  if (html.includes('class="brand-icon"') || html.includes('class="brand-word"')) {
    errors.push(`${label}: header must use the lockup image, not a separate icon and wordmark`);
  }
  if (!html.includes(`alt="${alt}"`)) errors.push(`${label}: logo alt text missing`);
  if (!html.includes(siteConfig.LOGO_LOCKUP_PNG) || !html.includes(siteConfig.LOGO_LOCKUP_WEBP)) {
    errors.push(`${label}: header and footer must use the lockup PNG and WebP`);
  }
  if (!html.includes('class="lockup lockup-footer"')) errors.push(`${label}: footer lockup missing`);
  if (!html.includes(`property="og:image" content="${siteConfig.DOMAIN.replace(/\/+$/, "")}${siteConfig.LOGO_LOCKUP_PNG}"`)) {
    errors.push(`${label}: og:image must use the lockup PNG`);
  }
  for (const key of ["FAVICON_192", "FAVICON_256", "FAVICON_512", "APPLE_TOUCH_ICON"]) {
    if (!html.includes(`href="${siteConfig[key]}"`)) errors.push(`${label}: missing ${key}`);
  }
  if (!html.includes('rel="manifest" href="/site.webmanifest"')) errors.push(`${label}: manifest link missing`);
  if (label === "index.html" && html.includes("lockup-hero")) errors.push(`${label}: the large lockup must not sit in the hero`);
  if (label === "about/index.html" && !html.includes("lockup-about")) errors.push(`${label}: about lockup missing`);
  if (label === "index.html") {
    const order = ["ad", "solutions", "demonstration", "how", "pricing", "questions", "request"];
    let pos = 0;
    for (const id of order) {
      const next = html.indexOf(`id="${id}"`);
      if (next < pos) errors.push(`${label}: #${id} is out of page order`);
      pos = next;
    }
  }
}

function checkVisibleTodo(label, html) {
  const visible = html.replace(/<!--[\s\S]*?-->/g, " ");
  if (/\bTODO\b/i.test(visible)) errors.push(`${label}: visible TODO text`);
}

function checkLogoPlate() {
  const css = readFileSync(join(siteRoot, "src", "site.css"), "utf8");
  if (css.includes("#f6f3ee") || css.includes("#e4ddd2")) {
    errors.push("logo still uses a light plate");
  }
  for (const selector of [".site-header", ".site-footer"]) {
    const block = ruleBlock(css, selector);
    if (!/#0[Bb]1426/.test(block)) errors.push(`${selector} background must be #0B1426`);
    if (whiteBg(block)) errors.push(`${selector} has a white background behind the logo`);
  }
  for (const selector of [".brand-logo", ".lockup", ".lockup img"]) {
    const block = ruleBlock(css, selector);
    if (!block) errors.push(`${selector} rule missing`);
    if (whiteBg(block)) errors.push(`${selector} has a white background`);
    if (!/background:\s*(?:none|transparent)/.test(block)) {
      errors.push(`${selector} must set a transparent background`);
    }
  }
  for (const selector of [".photo-full img", ".photo-contain img"]) {
    const block = ruleBlock(css, selector);
    if (!/object-fit:\s*contain/.test(block)) errors.push(`${selector} must use object-fit: contain so the sample-data label stays visible`);
  }
}

function ruleBlock(css, selector) {
  const at = css.indexOf(selector);
  if (at < 0) return "";
  const open = css.indexOf("{", at);
  const close = css.indexOf("}", open);
  if (open < 0 || close < 0) return "";
  return css.slice(at, close);
}

function whiteBg(block) {
  return /background(?:-color)?:\s*(?:#fff\b|#ffffff\b|white\b|#f{3,8}\b)/i.test(block);
}

function checkPrices(label, html) {
  const visible = html.replace(/<style[\s\S]*?<\/style>/gi, " ");
  for (const match of visible.matchAll(/\$\d{1,3}(?:,\d{3})*(?:\.\d+)?\+?/g)) {
    if (!approvedDollars.has(match[0])) errors.push(`${label}: unapproved price ${match[0]}`);
  }
}

function checkStripeLinks(label, html) {
  const packs = new Set((siteConfig.DOCUMENT_PACKS || []).map((pack) => pack.url));
  const steel = new Set((siteConfig.STEEL_ESTIMATE || []).map((row) => row.url));
  const allowed = label === "steel-estimating/index.html" ? steel : packs;
  for (const match of html.matchAll(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g)) {
    if (!allowed.has(match[0])) errors.push(`${label}: unapproved Stripe link ${match[0]}`);
  }
  if (label === "steel-estimating/index.html") {
    if (steel.size !== 2) errors.push("STEEL_ESTIMATE must list two Stripe links");
    for (const url of steel) {
      if (!html.includes(url)) errors.push(`steel-estimating: missing Stripe link ${url}`);
    }
  }
}

function checkSampleScreen(label, html) {
  if (!html.includes("/assets/photos/f08-")) return;
  if (!html.includes("SAMPLE DATA") || !html.includes("INTERNAL DEMONSTRATION")) {
    errors.push(`${label}: f08 must keep SAMPLE DATA and INTERNAL DEMONSTRATION in the alt text`);
  }
  for (const fig of html.matchAll(/<figure class="([^"]*)">[\s\S]*?<\/figure>/g)) {
    if (fig[0].includes("/assets/photos/f08-") && !/\bphoto-(?:full|contain)\b/.test(fig[1])) {
      errors.push(`${label}: f08 must use photo-full or photo-contain so the on-screen label is not cropped`);
    }
  }
}

function checkAdsOffer(label, html) {
  const nav = html.match(/<a href="\/ads-video\/"[^>]*>[\s\S]*?<\/a>/);
  if (!nav) errors.push(`${label}: ads nav link missing`);
  else if (/Coming soon/i.test(nav[0])) errors.push(`${label}: ads nav still says Coming soon`);
  if (label !== "ads-video/index.html" && label !== "index.html") return;
  if (label === "ads-video/index.html") {
    const main = html.match(/<main\b[\s\S]*<\/main>/i);
    if (main && /Coming soon/i.test(main[0])) errors.push(`${label}: ads page still says Coming soon`);
    if (!html.includes("from $99")) errors.push(`${label}: ads page must say from $99`);
    if (html.includes("buy.stripe.com")) errors.push(`${label}: ads page must not include a Stripe link`);
    if (!html.includes('href="/contact/"')) errors.push(`${label}: ads quote CTA must go to /contact/`);
    for (const ratio of ["16:9", "9:16", "1:1"]) {
      if (!html.includes(ratio)) errors.push(`${label}: missing export size ${ratio}`);
    }
  }
  if (label === "index.html") {
    const cards = [...html.matchAll(/<article class="card">[\s\S]*?<\/article>/g)];
    const card = cards.find((item) => item[0].includes(">Ads and video<") || item[0].includes(">Ads and video "));
    if (!card) errors.push(`${label}: ads service card missing`);
    else if (/Coming soon/i.test(card[0])) errors.push(`${label}: ads card still says Coming soon`);
    else if (!card[0].includes("from $99")) errors.push(`${label}: ads card must say from $99`);
  }
}

function checkWebsitesStaySoon(label, html) {
  const nav = html.match(/<a href="\/websites-seo-aeo\/"[^>]*>[\s\S]*?<\/a>/);
  if (!nav || !/Coming soon/i.test(nav[0])) errors.push(`${label}: websites nav must stay Coming soon`);
  if (label === "websites-seo-aeo/index.html" && !/Coming soon/i.test(html)) {
    errors.push(`${label}: websites page must stay Coming soon`);
  }
}

function checkSitemap() {
  const file = join(publicDir, "sitemap.xml");
  if (!existsSync(file)) {
    errors.push("sitemap.xml was not built");
    return;
  }
  const xml = readFileSync(file, "utf8");
  for (const path of ["/ads-video/", "/websites-seo-aeo/", "/contact/", "/steel-estimating/"]) {
    if (!xml.includes(`${siteConfig.DOMAIN.replace(/\/+$/, "")}${path}`)) errors.push(`sitemap.xml missing ${path}`);
  }
  if (xml.includes("404")) errors.push("sitemap.xml must not list the 404 page");
}

function checkAdsJsonLd() {
  for (const label of ["workflow-automation/index.html", "ads-video/index.html"]) {
    const html = readFileSync(join(publicDir, label), "utf8");
    if (!html.includes('"name": "Ads and video"')) errors.push(`${label}: JSON-LD service list is missing Ads and video`);
    if (!html.includes('"minPrice": "99.00"')) errors.push(`${label}: JSON-LD must price ads from 99.00`);
  }
}

function checkAdSlot(label, html) {
  if (label !== "index.html" && label !== "ads-video/index.html") return;
  if (!html.includes('<source src="/assets/video/gma-ad-main-16x9.mp4" type="video/mp4">')) {
    errors.push(`${label}: ad video source path is missing`);
  }
  if (!html.includes('poster="/assets/photos/f01-1600.webp"')) {
    errors.push(`${label}: ad video poster is missing`);
  }
}

function checkPackProducts() {
  const packs = siteConfig.DOCUMENT_PACKS;
  const quotes = siteConfig.QUOTE_ONLY_PACKS;
  const file = join(publicDir, "ai-document-packs", "index.html");
  if (!existsSync(file)) {
    errors.push("ai-document-packs/index.html was not built");
    return;
  }
  const html = readFileSync(file, "utf8");
  if (!Array.isArray(packs) || packs.length !== 8) errors.push("DOCUMENT_PACKS must list the eight live products");
  for (const pack of packs || []) {
    const button = `href="${pack.url}" target="_blank" rel="noopener noreferrer"`;
    if (!html.includes(button)) errors.push(`ai-document-packs: missing new-tab Buy link for ${pack.name}`);
    if (!html.includes(pack.name.replaceAll("&", "&amp;"))) errors.push(`ai-document-packs: missing ${pack.name}`);
  }
  if (!Array.isArray(quotes)) errors.push("QUOTE_ONLY_PACKS must be a list");
  for (const name of quotes || []) {
    if (!html.includes(name) || !html.includes("Ask for a quote")) {
      errors.push(`ai-document-packs: ${name} must say Ask for a quote`);
    }
  }
}

function checkSteelSite() {
  const home = readFileSync(join(publicDir, "index.html"), "utf8");
  if (!home.includes('href="/steel-estimating/"')) {
    errors.push("home: steel estimating card must link to /steel-estimating/");
  }
  if (/separate (site|app)/i.test(home)) errors.push("home: steel estimating must not be described as a separate site");
  const steel = readFileSync(join(publicDir, "steel-estimating", "index.html"), "utf8");
  if (!steel.includes("$149") || !steel.includes("$399")) errors.push("steel estimating page must show $149 and $399");
  if (steel.includes("buy.stripe.com") && !steel.includes("https://buy.stripe.com/dRmdR97j0a5Tf2f83TdZ60j")) {
    errors.push("steel estimating page is missing the $149 Stripe link");
  }
}
function checkDomain() {
  const domain = "https://granitemodels.store";
  if (siteConfig.DOMAIN.replace(/\/+$/, "") !== domain) errors.push(`DOMAIN must be ${domain}`);
  const robots = readFileSync(join(publicDir, "robots.txt"), "utf8");
  if (!robots.includes(`Sitemap: ${domain}/sitemap.xml`)) errors.push("robots.txt sitemap must use the apex domain");
  for (const file of walk(publicDir)) {
    if (!/\.(html|xml|txt)$/.test(file)) continue;
    const body = readFileSync(file, "utf8");
    if (body.includes("services.granitemodels.store")) {
      errors.push(`${relative(publicDir, file)}: still uses services.granitemodels.store`);
    }
  }
}
function checkLegacyRedirects() {
  const rules = legacyRedirectRules();
  const redirects = readFileSync(join(publicDir, "_redirects"), "utf8");
  const guide = readFileSync(join(siteRoot, "render-redirects.md"), "utf8");
  for (const rule of rules) {
    const sources = rule.splat ? [rule.from] : [rule.from, `${rule.from}/`];
    for (const source of sources) {
      const line = `${source} ${rule.to} 301`;
      if (!redirects.includes(line)) errors.push(`_redirects missing ${line}`);
      if (!guide.includes(`\`${source}\``) || !guide.includes(`\`${rule.to}\``)) {
        errors.push(`render-redirects.md missing ${source} -> ${rule.to}`);
      }
    }
    if (rule.splat) continue;
    const file = join(publicDir, rule.from.replace(/^\/+/, ""), "index.html");
    if (!existsSync(file)) {
      errors.push(`missing redirect stub for ${rule.from}`);
      continue;
    }
    const html = readFileSync(file, "utf8");
    if (!html.includes(`url=${rule.to}`)) errors.push(`${rule.from}: meta refresh must point at ${rule.to}`);
    if (!html.includes('content="noindex, nofollow"')) errors.push(`${rule.from}: redirect stub must be noindex`);
  }
}
function checkRedirectStub(label, html) {
  if (!html.includes('content="noindex, nofollow"')) errors.push(`${label}: redirect stub must be noindex`);
  if (!html.includes('http-equiv="refresh"')) errors.push(`${label}: redirect stub missing meta refresh`);
  if (html.includes("services.granitemodels.store")) errors.push(`${label}: redirect stub uses the services subdomain`);
}

function checkNoindex(label, html) {
  const tag = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  const quiet = label === "order-received/index.html" || label === "payment-cancelled/index.html";
  if (launch) {
    if (quiet) {
      if (!tag || !/noindex/i.test(tag[1])) errors.push(`${label}: payment result page must be noindex`);
      return;
    }
    if (tag && /noindex|nofollow/i.test(tag[1])) errors.push(`${label}: launch build must not send noindex`);
    return;
  }
  if (!tag) {
    errors.push(`${label}: missing robots noindex meta`);
    return;
  }
  const content = tag[1].toLowerCase();
  if (!content.includes("noindex") || !content.includes("nofollow")) {
    errors.push(`${label}: robots meta must include noindex and nofollow`);
  }
}

function checkLaunchFiles() {
  const robots = readFileSync(join(publicDir, "robots.txt"), "utf8");
  const yaml = readFileSync(join(siteRoot, "render.yaml"), "utf8");
  const workflow = readFileSync(join(publicDir, "workflow-automation", "index.html"), "utf8");
  if (launch) {
    if (!robots.includes("Allow: /")) errors.push("robots.txt must allow crawling when LAUNCH is on");
    if (yaml.includes("X-Robots-Tag")) errors.push("render.yaml must not send X-Robots-Tag when LAUNCH is on");
    if (!workflow.includes("Which tools do you use?")) errors.push("launch build must include the tools FAQ");
    if (workflow.includes("TODO-CONFIRM")) errors.push("launch build must not leave the delivery-review TODO");
  } else {
    if (!robots.includes("Disallow: /")) errors.push("robots.txt must disallow crawling when LAUNCH is off");
    if (!yaml.includes("X-Robots-Tag") || !yaml.includes("noindex, nofollow")) {
      errors.push("render.yaml must send X-Robots-Tag noindex when LAUNCH is off");
    }
    if (workflow.includes("Which tools do you use?")) errors.push("tools FAQ stays off until LAUNCH is on");
  }
  if (workflow.includes("provisional")) errors.push("workflow page still says prices are provisional");
  if (!workflow.includes('"price": "249.00"') || !workflow.includes('"price": "499.00"') || !workflow.includes('"minPrice": "1200.00"')) {
    errors.push("JSON-LD workflow prices must be the confirmed amounts");
  }
}

function checkTelLinksStayVisible() {
  const css = readFileSync(join(publicDir, "css", "site.css"), "utf8");
  const telRules = [...css.matchAll(/[^{}]*tel:[^{]*\{[^}]*\}/gi)];
  for (const rule of telRules) {
    if (/display\s*:\s*none|visibility\s*:\s*hidden|pointer-events\s*:\s*none/i.test(rule[0])) {
      errors.push("site.css hides a tel link");
    }
  }
  if (css.includes(".phone-text")) errors.push("site.css still styles a duplicate phone-text span");
}

function checkImages(label, html) {
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt\s*=\s*["'][^"']+["']/.test(tag[0])) {
      errors.push(`${label}: img missing alt text`);
    }
  }
}

function checkLinks(file, html) {
  for (const match of html.matchAll(/\bhref\s*=\s*"([^"]*)"/gi)) {
    const href = match[1].trim();
    if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:|https?:|\/\/)/i.test(href)) continue;
    const pathOnly = href.split("#")[0].split("?")[0];
    if (!pathOnly) continue;
    const target = resolveInternal(file, pathOnly);
    if (!target) {
      errors.push(`${relative(publicDir, file)}: broken internal link ${href}`);
    }
  }
}

function resolveInternal(fromFile, pathOnly) {
  const relativePath = pathOnly.startsWith("/")
    ? pathOnly.replace(/^\/+/, "")
    : pathOnly;
  const base = pathOnly.startsWith("/") ? publicDir : dirname(fromFile);
  const abs = normalize(join(base, relativePath));
  if (relative(publicDir, abs).startsWith("..")) return false;
  const candidates = pathOnly.endsWith("/")
    ? [join(abs, "index.html")]
    : [abs, `${abs}.html`, join(abs, "index.html")];
  return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function checkJsonLd(label, html) {
  const blocks = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
  if (blocks.length === 0) return;
  for (const block of blocks) {
    let data;
    try {
      data = JSON.parse(block[1]);
    } catch (error) {
      errors.push(`${label}: JSON-LD did not parse (${error.message})`);
      continue;
    }
    const faqs = [];
    walkNode(data, faqs, label);
    if (faqs.length === 0) continue;
    const rendered = renderedFaqs(html, label);
    if (rendered.length !== faqs.length) {
      errors.push(`${label}: JSON-LD has ${faqs.length} FAQ answers and the page has ${rendered.length}`);
    }
    const count = Math.max(faqs.length, rendered.length);
    for (let index = 0; index < count; index += 1) {
      const expected = faqs[index];
      const actual = rendered[index];
      if (!expected || !actual || norm(expected.q) !== norm(actual.q) || norm(expected.a) !== norm(actual.a)) {
        errors.push(`${label}: FAQ ${index + 1} does not match JSON-LD`);
      }
    }
  }
}

function walkNode(node, faqs, label) {
  if (Array.isArray(node)) {
    for (const item of node) walkNode(item, faqs, label);
    return;
  }
  if (!node || typeof node !== "object") return;
  const types = node["@type"] == null ? [] : [].concat(node["@type"]);
  for (const type of types) {
    if (type === "Review" || type === "AggregateRating") {
      errors.push(`${label}: JSON-LD type ${type} is not allowed`);
    }
  }
  const business = types.includes("Organization") || types.includes("LocalBusiness");
  if (business) {
    if (!types.includes("Organization") || !types.includes("LocalBusiness")) {
      errors.push(`${label}: business JSON-LD must be Organization and LocalBusiness`);
    }
    if (node.telephone !== "+19786473933") errors.push(`${label}: JSON-LD telephone must be +19786473933`);
    if (node.name !== "Granite Models Automations") errors.push(`${label}: JSON-LD business name must be Granite Models Automations`);
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.toLowerCase() === "address") {
      errors.push(`${label}: JSON-LD key ${key} is not allowed`);
    }
    if (types.includes("FAQPage") && key === "mainEntity" && Array.isArray(value)) {
      for (const question of value) {
        faqs.push({
          q: question?.name ?? "",
          a: question?.acceptedAnswer?.text ?? "",
        });
      }
    }
    walkNode(value, faqs, label);
  }
}

function renderedFaqs(html, label) {
  const section = html.match(/<section\b[^>]*\bid="faq"[^>]*>([\s\S]*?)<\/section>/i);
  if (!section) {
    errors.push(`${label}: JSON-LD FAQ has no matching #faq section`);
    return [];
  }
  return [...section[1].matchAll(/<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi)].map((match) => ({
    q: match[1],
    a: match[2],
  }));
}

function norm(value) {
  return decode(String(value)).replace(/\s+/g, " ").trim();
}

function decode(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}
