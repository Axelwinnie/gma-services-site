import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeLegacyRedirects } from "./legacy-redirects.mjs";

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(siteRoot, "site.config.json"), "utf8"));

const brand = requiredString(config.BRAND, "BRAND");
const short = requiredString(config.BRAND_SHORT, "BRAND_SHORT");
const inbox = requiredString(config.INBOX, "INBOX");
const phoneDisplay = requiredString(config.PHONE_DISPLAY, "PHONE_DISPLAY");
const phoneE164 = requiredString(config.PHONE_E164, "PHONE_E164");
const launch = process.env.LAUNCH === "true" || config.LAUNCH === true;
const formEnabled = process.env.FORM_ENABLED === "true" || config.FORM_ENABLED === true;
const domain = requiredString(config.DOMAIN, "DOMAIN").replace(/\/+$/, "");
const base = cleanPath(requiredString(config.WORKFLOW_BASE_PATH, "WORKFLOW_BASE_PATH"));
const steelPath = "/steel-estimating/";
const steelEstimates = steelEstimateProducts(config.STEEL_ESTIMATE);
const logoAlt = requiredString(config.LOGO_ALT, "LOGO_ALT");
const logoPng = brandAssetPath(config.LOGO_LOCKUP_PNG, "LOGO_LOCKUP_PNG");
const logoWebp = brandAssetPath(config.LOGO_LOCKUP_WEBP, "LOGO_LOCKUP_WEBP");
const logoIcon = brandAssetPath(config.LOGO_ICON, "LOGO_ICON");
const favicon192 = brandAssetPath(config.FAVICON_192, "FAVICON_192");
const favicon256 = brandAssetPath(config.FAVICON_256, "FAVICON_256");
const favicon512 = brandAssetPath(config.FAVICON_512, "FAVICON_512");
const appleIcon = brandAssetPath(config.APPLE_TOUCH_ICON, "APPLE_TOUCH_ICON");
const documentPacks = packProducts(config.DOCUMENT_PACKS);
const quoteOnlyPacks = packNames(config.QUOTE_ONLY_PACKS);
const mapPrice = money(requiredNumber(config.WORKFLOW_MAP_PRICE, "WORKFLOW_MAP_PRICE"));
const buildPrice = `${money(requiredNumber(config.ONE_WORKFLOW_BUILD_PRICE, "ONE_WORKFLOW_BUILD_PRICE"))}+`;
const connectedPrice = money(requiredNumber(config.CONNECTED_WORKFLOWS_FROM, "CONNECTED_WORKFLOWS_FROM"));
const adsPrice = money(requiredNumber(config.ADS_VIDEO_FROM, "ADS_VIDEO_FROM"));
const deliveryReview = requiredString(config.DELIVERY_REVIEW, "DELIVERY_REVIEW");
const photos = loadPhotos(config.PHOTOS);
const photoMeta = {};
const sitemapPaths = [];

const DEMO_LABEL = "Internal GMA demonstration using fictional sample data. Not a customer result.";
const DRAFT = "DRAFT — pending Jon's approval";

const publicDir = join(siteRoot, "public");
rmSync(publicDir, { recursive: true, force: true });
mkdirSync(join(publicDir, "css"), { recursive: true });
writeFileSync(join(publicDir, "css", "site.css"), readFileSync(join(siteRoot, "src", "site.css")));
writeFileSync(join(publicDir, "robots.txt"), launch
  ? `User-agent: *\nAllow: /\n\nSitemap: ${domain}/sitemap.xml\n`
  : `User-agent: *\nDisallow: /\n\nSitemap: ${domain}/sitemap.xml\n`);
syncRenderYaml();
publishBrandAssets();
publishPhotos();
publishVideo();
publishSamples();
writeFileSync(join(publicDir, "site.webmanifest"), `${JSON.stringify({
  name: brand,
  short_name: short,
  icons: [
    { src: favicon192, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: favicon256, sizes: "256x256", type: "image/png", purpose: "any" },
    { src: favicon512, sizes: "512x512", type: "image/png", purpose: "any" },
  ],
  display: "browser",
  background_color: "#0B1426",
  theme_color: "#0B1426",
}, null, 2)}\n`);

const jsonld = substitute(JSON.parse(readFileSync(
  join(siteRoot, "source-drafts", "seo", "workflow-automation-jsonld.json"),
  "utf8",
)));
syncPrices(jsonld);
applyLaunchFaqs(jsonld);
const faqs = faqEntries(jsonld);

writePage("/", page({
  title: "AI Workflow Setup for Real Work",
  description: "Fixed-price workflow setup for small businesses. Map one process and set it up in the tools you already use. A person reviews anything customer-facing.",
  path: "/",
  active: "/",
  main: homeMain(),
}));

writePage(`${base}/`, page({
  title: "Workflow Automation Setup for Small Businesses",
  description: "Fixed-price workflow automation for small businesses. We map one process, set it up in your own tools, and a person reviews anything customer-facing. From $249.",
  path: `${base}/`,
  active: base,
  crumbs: [["Workflow setup"]],
  main: workflowMain(),
  jsonLd: jsonld,
}));

writePage(`${base}/demo/`, page({
  title: "Quote pack demo",
  description: "Internal GMA demonstration using fictional sample data. Not a customer result.",
  path: `${base}/demo/`,
  active: "/demos/",
  crumbs: [["Demos", "/demos/"], ["Quote pack demo"]],
  main: quoteDemoMain(),
}));

for (const item of solutionPages()) writePage(item.path, page(item.page));
for (const item of demoPages()) writePage(item.path, page(item.page));

writePage("/websites-seo-aeo/", page({
  title: "Websites, SEO and AEO",
  description: "Not offered yet. Write through the contact page.",
  path: "/websites-seo-aeo/",
  active: "/websites-seo-aeo/",
  crumbs: [["Websites, SEO and AEO"]],
  main: comingSoonMain("Websites, SEO and AEO", "A later service for a small-business website and for pages that answer common questions. It is not offered yet.", "f19"),
}));

writePage("/ads-video/", page({
  title: "Ads and video",
  description: `Short video ads for contractors and trades, from ${adsPrice}. Ask for a quote. No payment button on this page.`,
  path: "/ads-video/",
  active: "/ads-video/",
  crumbs: [["Ads and video"]],
  main: adsMain(),
  jsonLd: { "@context": "https://schema.org", "@graph": [orgNode(), adsServiceNode()] },
}));

writePage("/demos/", page({
  title: "Demos",
  description: DEMO_LABEL,
  path: "/demos/",
  active: "/demos/",
  crumbs: [["Demos"]],
  main: demosHub(),
}));

writePage("/how-it-works/", page({
  title: "How it works",
  description: "Discover, design, implement, train and launch, then decide whether to add another process.",
  path: "/how-it-works/",
  active: "/how-it-works/",
  crumbs: [["How it works"]],
  main: howMain(),
}));

writePage("/about/", page({
  title: "About",
  description: `${brand} is based in New Hampshire and sets up workflows for small businesses.`,
  path: "/about/",
  active: "/about/",
  crumbs: [["About"]],
  main: aboutMain(),
}));

writePage("/contact/", page({
  title: "Contact",
  description: `Tell ${brand} about one process. This draft form does not send.`,
  path: "/contact/",
  active: "/contact/",
  crumbs: [["Contact"]],
  main: contactMain(),
}));

writePage("/policies/", page({
  title: "Policies",
  description: "Client requirements, payment, and the delay rule for workflow setup.",
  path: "/policies/",
  active: "/policies/",
  crumbs: [["Policies"]],
  main: policiesMain(),
}));

writePage("/refund-policy/", page({
  title: "Refund policy",
  description: "Full refund before kickoff. After kickoff, a refund only if the agreed scope cannot be delivered.",
  path: "/refund-policy/",
  active: "/refund-policy/",
  crumbs: [["Policies", "/policies/"], ["Refund policy"]],
  main: refundMain(),
}));

writePage("/revision-policy/", page({
  title: "Revision policy",
  description: "One revision round, requested within 7 days. Fix windows are 14 or 30 days.",
  path: "/revision-policy/",
  active: "/revision-policy/",
  crumbs: [["Policies", "/policies/"], ["Revision policy"]],
  main: revisionMain(),
}));

writePage("/file-retention-policy/", page({
  title: "File retention policy",
  description: "Client files are deleted 30 days after handoff. An NDA is available on request.",
  path: "/file-retention-policy/",
  active: "/file-retention-policy/",
  crumbs: [["Policies", "/policies/"], ["File retention policy"]],
  main: retentionMain(),
}));

writePage("/terms/", page({
  title: "Terms",
  description: launch ? "Not legal advice." : `${DRAFT} Not legal advice.`,
  path: "/terms/",
  active: "/terms/",
  crumbs: [["Terms"]],
  main: termsMain(),
}));

writePage("/privacy/", page({
  title: "Privacy note",
  description: launch ? "Not legal advice." : `${DRAFT} Not legal advice.`,
  path: "/privacy/",
  active: "/privacy/",
  crumbs: [["Privacy note"]],
  main: privacyMain(),
}));


writePage("/steel-estimating/", page({
  title: "Steel estimating",
  description: "Estimate packets from drawings. $149 for up to 8 sheets, and $399 for up to 20.",
  path: "/steel-estimating/",
  active: steelPath,
  crumbs: [["Steel estimating"]],
  main: steelMain(),
}));

writePage("/order-received/", page({
  title: "Payment received",
  description: "Email the drawings after payment.",
  path: "/order-received/",
  active: "",
  crumbs: [["Payment received"]],
  noindex: true,
  main: orderReceivedMain(),
}), { sitemap: false });

writePage("/payment-cancelled/", page({
  title: "Payment not completed",
  description: "No charge was recorded on this page.",
  path: "/payment-cancelled/",
  active: "",
  crumbs: [["Payment not completed"]],
  noindex: true,
  main: paymentCancelledMain(),
}), { sitemap: false });

writePage("/workflow-map/", page({
  title: "Workflow Map",
  description: "One process on one page. Fixed price to build it. No call required. Workflow Map is $249. Email three lines to start.",
  path: "/workflow-map/",
  active: "/workflow-map/",
  crumbs: [["Workflow Map"]],
  main: workflowMapMain(),
  jsonLd: workflowMapJsonLd(),
}));

writeFileSync(join(publicDir, "404.html"), page({
  title: "Page not found",
  description: "That page is not on this site.",
  path: "/404.html",
  active: "",
  crumbs: [["Page not found"]],
  main: `<article class="section"><div class="wrap">
    <h1>Page not found</h1>
    <p>That address is not on this site.</p>
    <p><a class="btn" href="/">Back to the home page</a></p>
  </div></article>`,
}));

writeSitemap();
writeLegacyRedirects({ publicDir, siteRoot, domain });

function mapMailto() {
  const subject = encodeURIComponent("Workflow Map");
  const body = encodeURIComponent("1. What comes in (missed calls, web forms, RFQs, something else):\n\n2. What should come out (a text back, a quote reminder, one list, etc.):\n\n3. Who touches it today:\n");
  return `mailto:${inbox}?subject=${subject}&body=${body}`;
}

function workflowMapMain() {
  const mail = mapMailto();
  return `<article class="section"><div class="wrap">
    <h1>One process on one page. Fixed price to build it. No call required.</h1>
    ${photoFigure("f13", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    <h2>What a Map is</h2>
    <p>A Workflow Map is a one-page write-up of one process in your shop. I list every step, who does it, what tool they use, and where it stalls. Then I tell you which steps I'd automate, which ones stay with a person, and a fixed price to build the first one.</p>
    <p>You keep the page even if you never hire me to build anything.</p>
    <h2>What's included</h2>
    <ul>
      <li>One process mapped end to end</li>
      <li>What stays human (you approve anything that goes to a customer)</li>
      <li>Ranked list of what I'd automate first</li>
      <li>Tool options built around apps you already use</li>
      <li>Fixed price for a One Workflow Build off that Map</li>
      <li>1 revision round</li>
      <li>Turnaround: 3 business days after I confirm fit</li>
    </ul>
    <h2>Sample PDF</h2>
    <p class="demo-banner">SAMPLE ONLY. Stone Creek Heating &amp; Cooling is a made-up HVAC shop. Not a real customer.</p>
    <p><a class="btn secondary" href="/samples/sample-map-hvac-missed-call.pdf">SAMPLE ONLY: See a sample Map (HVAC missed-call / lead intake, made-up shop)</a></p>
    <h2 id="start">How to start (email, no call)</h2>
    <p>Email <a href="mailto:${esc(inbox)}">${esc(inbox)}</a> with three lines:</p>
    <ol>
      <li>What comes in (missed calls, web forms, RFQs, something else)</li>
      <li>What should come out (a text back, a quote reminder, one list, etc.)</li>
      <li>Who touches it today</li>
    </ol>
    <p>That's it. I'll reply by email and tell you straight if a Map makes sense. If it does, I'll send a Stripe link for ${esc(mapPrice)}. No public pay button on this page on purpose. I check fit first.</p>
    <p class="btn-row"><a class="btn" href="${mail}">Email ${esc(inbox)}</a></p>
    <h2>Turnaround and price</h2>
    <p>Workflow Map: ${esc(mapPrice)}. 3 business days. 1 revision.</p>
    <p>One Workflow Build: ${esc(buildPrice)}, sold only off a finished Map at the fixed price that Map quotes.</p>
    <p>Connected Workflows: from ${esc(connectedPrice)}, when the Map shows the problem crosses more apps.</p>
    <p>Ads &amp; Video: from ${esc(adsPrice)}, if you want a short contractor ad before ops help. <a href="/ads-video/">Ads and video</a>.</p>
    <div class="price-grid">
      <article class="price-card">
        <h3>Workflow Map</h3>
        <p class="price">${esc(mapPrice)}</p>
        <p>3 business days. 1 revision.</p>
        <a class="btn" href="${mail}">Email ${esc(inbox)}</a>
      </article>
      <article class="price-card featured">
        <h3>One Workflow Build</h3>
        <p class="price">${esc(buildPrice)}</p>
        <p>Sold only off a finished Map, at the fixed price that Map quotes.</p>
      </article>
      <article class="price-card">
        <h3>Connected Workflows</h3>
        <p class="price">From ${esc(connectedPrice)}</p>
        <p>When the Map shows the problem crosses more apps.</p>
      </article>
    </div>
    <h2>What happens next (no call required)</h2>
    <ol>
      <li>You email the three lines.</li>
      <li>I reply by email. Fit check. Nothing charged yet.</li>
      <li>If it's a fit, I send a Stripe link for the ${esc(mapPrice)} Map.</li>
      <li>You get the Map in 3 business days, with a fixed build price on it.</li>
      <li>If you want the build, you say so by email. No pressure either way. You keep the Map.</li>
    </ol>
    <p>You can call <a href="tel:${esc(phoneE164)}">${esc(phoneDisplay)}</a> if you prefer the phone. Email works fine and is the default path.</p>
    <h2>Contact</h2>
    <p>Jon Anderson<br>${esc(brand)}<br><a href="mailto:${esc(inbox)}">Email ${esc(inbox)}</a><br>${callLink()}<br><a href="${esc(domain)}/">granitemodels.store</a></p>
    <p>${esc(brand)} · 231 Arah St, Manchester, NH 03104</p>
  </div></article>`;
}

function workflowMapJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      orgNode(),
      {
        "@type": "Service",
        "@id": `${domain}/workflow-map/#service`,
        name: "Workflow Map",
        serviceType: "One-page process map",
        description: "A one-page write-up of one process: every step, who does it, what tool they use, and where it stalls, plus a fixed price to build the first step.",
        provider: { "@id": `${domain}/#org` },
        url: `${domain}/workflow-map/`,
        offers: {
          "@type": "Offer",
          name: "Workflow Map",
          price: Number(config.WORKFLOW_MAP_PRICE).toFixed(2),
          priceCurrency: "USD",
          description: "Email three lines first. A Stripe link is sent only after a fit check. No public pay button.",
        },
      },
    ],
  };
}

function homeMain() {
  return `
    <section class="hero">
      <div class="wrap hero-grid">
        <div>
          <p class="badge">Workflow setup</p>
          <h1>AI workflow setup for real work</h1>
          <p class="lede">Turn quotes, documents, leads, and customer follow-up into a workflow in the tools you already use. A person reviews anything that goes to a customer.</p>
          <div class="points">
            ${point("01", "Designed to reduce repetitive work", "One repeating process, not a promise of hours saved.")}
            ${point("02", "More time for higher-value work", "The map records how long the process takes you today, so you can measure it yourself afterwards.")}
            ${point("03", "Organize information and approvals", "A person checks customer-facing output before it goes out.")}
            ${point("04", "Built in your accounts", "Approval controls stay on. We never ask for passwords.")}
          </div>
          <div class="btn-row">
            <a class="btn" href="/workflow-map/" data-cta-id="start-map">Start Here: Workflow Map — ${esc(mapPrice)}</a>
            <a class="btn secondary" href="/demos/" data-cta-id="watch-demo">Watch Demo Overview</a>
          </div>
        </div>
        <div class="hero-visual">
          ${photoFigure("f01", "photo-hero", "(max-width: 780px) 100vw, 36rem")}
          <aside class="dash">
            <p class="sample-flag">Sample data</p>
            <div class="dash-stats">
              <div><strong>24</strong><small>Sample data</small></div>
              <div><strong>128</strong><small>Sample data</small></div>
              <div><strong>1,540</strong><small>Sample data</small></div>
            </div>
          </aside>
        </div>
      </div>
    </section>
    ${adSlot()}
    <section class="section" id="solutions">
      <div class="wrap">
        <h2>GMA workflow solutions</h2>
        <p class="lede">Each area has its own page, including steel estimating.</p>
        <div class="solutions">
          ${card("Steel estimating", "Estimate packets from drawings. $149 for up to 8 sheets, and $399 for up to 20.", steelPath, false, "f07")}
          ${card("Quote and proposal automation", "Turn client information into organized quotes and proposals.", "/quote-proposal-automation/")}
          ${card("Document intake and processing", "Turn incoming documents into summaries, extracted fields, and checklists a person can review.", "/document-intake/", false, "f19")}
          ${card("Lead follow-up and booking", "Sort new inquiries and draft follow-ups so they do not sit until someone has time.", "/lead-follow-up/", false, "f31")}
          ${card("Trade office workflow setup", "Paperwork, handoffs, and follow-up for contractors, fabrication, and small offices.", "/trade-office-workflow/", false, "f22")}
          ${card("Websites, SEO and AEO", "Not offered yet.", "/websites-seo-aeo/", true)}
          ${card("Ads and video", `Short video ads for contractors and trades, from ${adsPrice}. People-and-workflow scenes, a voiceover, and branded cards.`, "/ads-video/", false, "f38")}
          ${card("AI document and business packs", "Quote packs, proposal packs, extraction, summaries, drawings, and forms. Listed packs have a Buy button on the page. Other types are Ask for a quote.", "/ai-document-packs/", false, "f19")}
          ${card("Custom business workflow systems", "Connected workflows, or a written custom scope for a larger system.", "/custom-workflow-systems/", false, "f17")}
        </div>
      </div>
    </section>
    <section class="section" id="demonstration">
      <div class="wrap">
        <h2>Internal GMA demonstration</h2>
        ${photoFigure("f08", "photo-full", "(max-width: 780px) 100vw, 72rem")}
        ${demoBanner()}
        ${demoSwitcher([
          ["est", "Steel estimating", true, estimatingDemoPanel()],
          ["quote", "Quote Pack Demo", false, demoPanel("Quote pack", `${base}/demo/`, "A fictional contractor's scope notes go through a quote workflow. A person reviews the draft. The output is a quote PDF.")],
          ["docs", "Document Intake", false, demoPanel("Document intake", "/demos/document-intake/", "A fictional packet is summarized for a person to check. No customer file is used.")],
          ["lead", "Lead Follow-Up", false, demoPanel("Lead follow-up", "/demos/lead-follow-up/", "A fictional inquiry is sorted and a follow-up is drafted for a person to approve.")],
          ["trade", "Trade Office Workflow", false, demoPanel("Trade office", "/demos/trade-office/", "A fictional office handoff across quote, paper, and follow-up. Not a customer project.")],
        ])}
      </div>
    </section>
    <section class="section" id="how">
      <div class="wrap">
        <h2>How it works</h2>
        ${photoFigure("f31", "page-banner", "(max-width: 780px) 100vw, 72rem")}
        ${stepsHtml()}
        <p><a class="btn secondary" href="/how-it-works/">Read the full steps</a></p>
      </div>
    </section>
    <section class="section" id="pricing">
      <div class="wrap">
        <h2>Pricing</h2>
        <p>Quoted before you pay. Nothing is charged until you approve.</p>
        ${priceGrid()}
      </div>
    </section>
    <section class="section" id="questions">
      <div class="wrap">
        <h2>Frequently asked questions</h2>
        ${faqs.map((item) => `<details class="faq-item"><summary>${esc(item.q)}</summary><p>${esc(item.a)}</p></details>`).join("\n")}
        <details class="faq-item">
          <summary>What do you need from me?</summary>
          <p>One named person who can approve outputs, 3-5 examples of what comes in and what should come out, and the list of tools you already pay for. Redacted or made-up examples are fine.</p>
        </details>
        <details class="faq-item">
          <summary>Do you work with the tools I already use?</summary>
          <p>Yes. The workflow is built in your accounts. We have not published a platform list yet. We never ask for passwords. Access is through your tool's own invite or sharing feature.</p>
        </details>
      </div>
    </section>
    <section class="section" id="request">
      <div class="wrap">
        <h2>Request a Workflow Map</h2>
        ${photoFigure("f38", "page-banner", "(max-width: 780px) 100vw, 72rem")}
        <p>Three lines is enough: what comes in, what should come out, and who touches it today. Call or email. Nothing is charged until you approve a fixed price.</p>
        ${formEnabled ? `${shortForm("home")}${formNotes()}` : contactBlock()}
      </div>
    </section>`;
}

function workflowMain() {
  return `
    <section class="hero">
      <div class="wrap">
        ${photoFigure("f01", "page-banner", "(max-width: 780px) 100vw, 72rem")}
        <h1>Workflow automation setup for small businesses</h1>
        <p class="lede">Get one repetitive process off your plate. We map one process in your business (quotes, document intake, follow-ups, paperwork) and set up a workflow for it in the tools you already use. A person reviews anything that goes to a customer. Fixed price, quoted before you pay, and you own it.</p>
        <div class="btn-row">
          <a class="btn" href="#start" data-cta-id="describe-process">Describe your process</a>
          <a class="btn secondary" href="${base}/demo/" data-cta-id="watch-demo">Watch the demo (fictional data)</a>
        </div>
        <p>${emailFallback()}</p>
        <p>Pricing starts at ${esc(mapPrice)} for a <a href="/workflow-map/">Workflow Map</a>.</p>
      </div>
    </section>
    <section class="section" id="who"><div class="wrap">
      <h2>Who it's for</h2>
      <ul>
        <li>Owner-run service and trade businesses, contractors, and small offices (roughly 1-25 people)</li>
        <li>Teams where one person re-types the same information into quotes, forms, or emails every week</li>
        <li>Businesses already using Google Workspace, Microsoft 365, or similar tools</li>
      </ul>
      <h3>Probably not a fit if</h3>
      <ul>
        <li>the process involves health records, card numbers, or bank/payroll logins</li>
        <li>you want a fully autonomous system that acts without anyone checking</li>
        <li>you need enterprise IT procurement</li>
      </ul>
    </div></section>
    <section class="section" id="problems"><div class="wrap">
      <h2>Problems we help with</h2>
      <ul>
        <li>Quotes and proposals rebuilt from scratch from notes, emails, or line items</li>
        <li>New inquiries that sit in an inbox until someone has time to sort them</li>
        <li>Documents (bid packs, specs, forms) that someone has to read and summarize by hand</li>
        <li>Follow-ups that slip because nobody owns them</li>
      </ul>
      <p class="note">We won't promise how many hours you'll save. The Workflow Map records how long the process takes you today, so you can measure it yourself afterwards.</p>
    </div></section>
    <section class="section" id="pricing"><div class="wrap">
      <h2>Pricing</h2>
      <p>Pricing starts at ${esc(mapPrice)}.</p>
      ${priceGrid()}
      <p class="note">The turnaround starts once we have what we need from you (see "What you provide") and a start date is confirmed in writing. We take one build at a time, so we'll confirm your start date before you pay.</p>
    </div></section>
    <section class="section" id="includes"><div class="wrap">
      <h2>What you get</h2>
      <h3>Workflow Map: ${esc(mapPrice)} </h3>
      <ul>
        <li>A 30-45 minute intake call, or a written questionnaire if you prefer</li>
        <li>A one-page map of one process: the steps, who does them, which tools, and where it stalls</li>
        <li>A plan that says which steps to automate, which stay human, and why</li>
        <li>Tool options with each vendor's published price (you check before buying)</li>
        <li>A fixed price for building it</li>
        <li>1 revision round</li>
      </ul>
      <h3>One Workflow Build: ${esc(buildPrice)} </h3>
      <ul>
        <li>The map for the chosen process</li>
        <li>One workflow set up and tested in your accounts: 1 trigger, up to 5 steps, up to 2 connected apps</li>
        <li>An AI step only where it helps (e.g. drafting a quote or summarizing a document)</li>
        <li>A human-approval step before anything goes to a customer (on by default)</li>
        <li>5 test runs on sample data, with results logged</li>
        <li>A written runbook plus a short recorded walkthrough</li>
        <li>1 revision round and a 14-day fix window</li>
      </ul>
      <h3>Connected Workflows: from ${esc(connectedPrice)} </h3>
      <ul>
        <li>Up to 3 workflows and up to 4 connected apps, sharing one log</li>
        <li>Can include documents or quotes generated from a template we set up with you</li>
        <li>Alerts to a named person if a run fails</li>
        <li>A 30-minute training session, runbook, and walkthrough video</li>
        <li>1 revision round per workflow and a 30-day fix window</li>
        <li>Written scope and fixed price confirmed before you pay</li>
      </ul>
      <h3>Not included (any tier)</h3>
      <ul>
        <li>custom software or apps</li>
        <li>workflows touching regulated data</li>
        <li>bank or payroll access</li>
        <li>your tool subscriptions (you pay vendors directly)</li>
        <li>ongoing retainers</li>
      </ul>
    </div></section>
    <section class="section" id="provide"><div class="wrap">
      <h2>What you provide</h2>
      <ul>
        <li>One person who can answer questions and approve outputs</li>
        <li>3-5 examples of what comes in and what should come out. Redacted or made-up examples are fine.</li>
        <li>The list of tools you already pay for</li>
        <li>Your inputs within 10 business days of kickoff. If they arrive later, the clock pauses.</li>
      </ul>
      <p>For builds:</p>
      <ul>
        <li>access through your tool's own invite or sharing feature. We never ask for passwords.</li>
        <li>a signed-off scope before we start</li>
        <li>time for two short check-ins (three for Connected Workflows, including a 30-minute training session)</li>
      </ul>
    </div></section>
    <section class="section" id="how"><div class="wrap">
      <h2>How it works</h2>
      <ol>
        <li><strong>Describe the process.</strong> Use the form below. Three lines is enough.</li>
        <li><strong>We confirm fit.</strong> We reply by email with whether it fits, which tier, and a fixed price. Nothing is charged at this step.</li>
        <li><strong>Scope in writing.</strong> For builds, you approve a short written scope.</li>
        <li><strong>Pay by secure link.</strong> We email a Stripe payment link for the agreed tier only after fit and scope are confirmed. Workflow Map, Implementation, and Connected or custom work have no public payment button. Connected Workflows is paid 50% upfront and 50% at handoff. <a href="/contact/">Contact</a> to start.</li>
        <li><strong>We map and build.</strong> Check-ins are at kickoff and handoff.</li>
        <li><strong>Handoff.</strong> You get the runbook and walkthrough, and we ask you to remove our access.</li>
      </ol>
    </div></section>
    <section class="section" id="demo"><div class="wrap">
      <h2>Demo (fictional data)</h2>
      <h3>See a workflow run. Every name and number is made up.</h3>
      ${demoBanner()}
      <div class="media-placeholder"><p>Demo video coming soon</p><p>No video is published on this draft.</p></div>
      <!-- TODO: No VideoObject JSON-LD until a real recording exists. -->
      <p><a class="btn secondary" href="${base}/demo/">Open the quote pack demo</a></p>
    </div></section>
    <section class="section" id="policies"><div class="wrap">
      <h2>Client policies</h2>
      <ul>
        <li><strong>Refunds:</strong> Full refund if you cancel before kickoff. After kickoff, you get a full refund if we can't deliver what the signed scope describes, even after the included revision round or fix window. <a href="/refund-policy/">Refund policy</a>.</li>
        <li><strong>Revisions:</strong> One round per tier (one per workflow for Connected Workflows). Send your changes as one list within 7 days of delivery. Anything beyond that is quoted in writing first. <a href="/revision-policy/">Revision policy</a>.</li>
        <li><strong>Fixes:</strong> Defects within the signed scope are fixed free for 14 days (One Workflow Build) or 30 days (Connected Workflows) after handoff.</li>
        <li><strong>Your files:</strong> Used only for your job and deleted 30 days after handoff, or sooner if you ask in writing. No passwords, ever. We'll sign a reasonable mutual NDA on request. <a href="/file-retention-policy/">File retention policy</a>.</li>
        <li><strong>Payment:</strong> By Stripe link, emailed only after fit and scope are confirmed. There is no public payment button for Workflow Map, Implementation, or Connected or custom work. Your tool subscriptions are paid directly to the vendors. <a href="/policies/">Payment and delay rules</a>.</li>
        <li><strong>Delays:</strong> If inputs haven't arrived 10 business days after kickoff, the clock pauses. After 30 days without a response the job is paused. It can restart within 60 days at the same price.</li>
      </ul>
    </div></section>
    <!-- TODO: Restore the tools question after Jon confirms which platforms he can build in. Leave it out of the page and out of the JSON-LD until then. -->
    <section class="section" id="faq"><div class="wrap">
      <h2>FAQ</h2>
      <div class="faq-list">
        ${faqs.map((item) => `<article><h3>${esc(item.q)}</h3><p>${esc(item.a)}</p></article>`).join("\n")}
      </div>
    </div></section>
    <section class="section" id="trust"><div class="wrap">
      <h2>Why trust us</h2>
      <ul>
        <li><strong>Fixed price, quoted before you pay.</strong> Nothing is charged before fit and scope are confirmed.</li>
        <li><strong>You own it.</strong> Everything is built in your accounts. We never ask for passwords.</li>
        <li><strong>A person reviews anything customer-facing.</strong> ${deliveryReviewNote()}</li>
        <li><strong>Written policies:</strong> refunds, revisions, fix windows, and file deletion are spelled out above, before you pay.</li>
        <li><strong>We say what we don't do:</strong> no guaranteed savings, no autonomous agents acting without review, no regulated data.</li>
        <li><strong>We're new to building workflows for outside clients, and we'd rather tell you that than dress it up.</strong> The demo is our own internal workflow on fictional data.</li>
      </ul>
    </div></section>
    <section class="section" id="start"><div class="wrap">
      <h2>Tell us one process you'd like off your plate.</h2>
      <p>Three lines is enough: what comes in, what should come out, and who touches it today. We'll reply with whether it fits and a fixed price. Nothing is charged until you approve.</p>
      ${formEnabled ? `${intakeForm("wf")}${formNotes()}` : contactBlock()}
    </div></section>`;
}

function solutionPages() {
  const pages = [
    {
      path: "/quote-proposal-automation/",
      title: "Quote and proposal automation",
      nav: "/quote-proposal-automation/",
      who: "Owner-run shops where someone rebuilds quotes or proposals from notes, emails, or line items.",
      problem: "Quotes and proposals get rebuilt from scratch. The same information is typed again.",
      setup: "We map that one process. If you approve a build, we set up a workflow in your accounts that drafts a quote or proposal from the inputs you define. A person reviews it before it goes to a customer.",
      deliverables: "A Workflow Map is the one-page plan. A One Workflow Build adds the workflow in your accounts, test runs on sample data, a runbook, and a walkthrough.",
      timeline: `Workflow Map: 3 business days (${esc(mapPrice)}). One Workflow Build: 7 business days (${esc(buildPrice)}). The clock starts once your inputs are in and a start date is confirmed in writing.`,
      tier: `A Workflow Map if you want the plan before spending more. A One Workflow Build if you want one quote or proposal workflow set up and tested.`,
      demoHref: `${base}/demo/`,
      demoName: "Quote pack demo",
      photo: "f08",
      contain: true,
    },
    {
      path: "/document-intake/",
      title: "Document intake and processing",
      nav: "/document-intake/",
      who: "Offices that receive bid packs, specs, or forms and have someone read and summarize them by hand.",
      problem: "Documents sit until a person has time to pull out the fields that matter.",
      setup: "We map one intake process and can set up a workflow that reads the kinds of files you define and drafts a summary or checklist. A person reviews the draft.",
      deliverables: "The map, and for a build: the workflow in your accounts, sample test runs, a runbook, and a walkthrough.",
      timeline: `Map: 3 business days. One workflow: 7 business days. Connected workflows, if more than one process is in scope: 15 business days, from ${esc(connectedPrice)}.`,
      tier: "A Workflow Map for a single intake process. A One Workflow Build to set that process up. Connected Workflows only if you need linked processes.",
      demoHref: "/demos/document-intake/",
      demoName: "Document intake demo",
      photo: "f19",
    },
    {
      path: "/lead-follow-up/",
      title: "Lead follow-up and booking",
      nav: "/lead-follow-up/",
      who: "Small teams whose new inquiries sit in an inbox, or whose follow-ups slip because nobody owns them.",
      problem: "A request comes in and waits. The follow-up depends on someone remembering.",
      setup: "We map how an inquiry arrives and what should happen next. A build can sort the inquiry and draft a follow-up for a named person to approve. We do not set up a system that contacts a customer with no one checking.",
      deliverables: "A written map, or a workflow in your accounts with a human-approval step, test runs on sample data, and a runbook.",
      timeline: "Map: 3 business days. One workflow: 7 business days. The clock pauses if inputs are late.",
      tier: `Start with a Workflow Map (${esc(mapPrice)}) if the path is unclear. A One Workflow Build (${esc(buildPrice)}) fits one follow-up process.`,
      demoHref: "/demos/lead-follow-up/",
      demoName: "Lead follow-up demo",
      photo: "f31",
    },
    {
      path: "/trade-office-workflow/",
      title: "Trade office workflow setup",
      nav: "/trade-office-workflow/",
      who: "Contractors, fabrication shops, and other owner-run trade offices of about 1-25 people.",
      problem: "The same job information is retyped across quotes, forms, and email. Follow-ups slip.",
      setup: "We pick one office process, map it, and can build it in the tools you already pay for. Steel estimate packets are a separate fixed-price file job on the steel estimating page.",
      deliverables: "The same map, build, and handoff described on the workflow setup page. Custom software is not included.",
      timeline: `Map: 3 business days. One workflow: 7 business days. Up to three linked office processes: Connected Workflows, 15 business days, from ${esc(connectedPrice)}.`,
      tier: "Workflow Map to choose the process. One Workflow Build for one process. Connected Workflows for up to three linked processes.",
      demoHref: "/demos/trade-office/",
      demoName: "Trade office demo",
      photo: "f22",
      gallery: ["f07", "f13", "f36"],
    },
    {
      path: "/custom-workflow-systems/",
      title: "Custom business workflow systems",
      nav: "/custom-workflow-systems/",
      who: "Businesses that need more than one workflow, still inside the tools they already use.",
      problem: "Two or three processes share the same information, and a single map is not the whole job.",
      setup: "Connected Workflows covers up to 3 workflows and up to 4 connected apps, with a written scope and a fixed price before you pay. Larger systems are a custom scope, still not custom software. We do not build apps.",
      deliverables: "A shared log, failure alerts to a named person, a training session, runbooks, and walkthroughs. One revision round per workflow and a 30-day fix window.",
      timeline: `15 business days for Connected Workflows, from ${esc(connectedPrice)}, after inputs are in. A larger scope gets its own written timeline before you pay.`,
      tier: `Connected Workflows, from ${esc(connectedPrice)}. A bigger system is quoted in writing before you pay.`,
      demoHref: "/demos/",
      demoName: "Demo hub",
      photo: "f17",
    },
    {
      path: "/ai-document-packs/",
      title: "AI document and business packs",
      nav: "/ai-document-packs/",
      who: "Teams that want a repeatable pack of documents from inputs they already have.",
      problem: "Quotes, proposals, summaries, and forms are assembled by hand from the same kinds of source material.",
      setup: "Listed packs below have a live Buy button. It opens Stripe in a new tab. A person still reviews customer-facing output. Pack types without a link are Ask for a quote.",
      deliverables: "The packs below. None of them is a custom app, and none of them is a Workflow Map, Implementation, or Connected Workflows engagement.",
      timeline: "A listed pack is paid through its Buy button. A pack without a link is quoted after you write.",
      tier: "Buy buttons on this page are only for the listed document, quote, and drawing packs. Workflow Map, Implementation, and Connected or custom work use the contact page. Those Stripe links are sent by email after scope is confirmed.",
      demoHref: `${base}/demo/`,
      demoName: "Quote pack demo",
      packs: true,
      photo: "f08",
      contain: true,
    },
  ];
  return pages.map((item) => ({
    path: item.path,
    page: {
      title: item.title,
      description: item.problem,
      path: item.path,
      active: item.nav,
      crumbs: [["Workflow setup", `${base}/`], [item.title]],
      main: solutionMain(item),
    },
  }));
}

function solutionMain(item) {
  const packs = item.packs ? documentPacksHtml() : "";
  const banner = item.photo ? photoFigure(item.photo, item.contain ? "photo-full" : "page-banner", "(max-width: 780px) 100vw, 72rem") : "";
  const gallery = Array.isArray(item.gallery) && item.gallery.length
    ? `<div class="photo-row">${item.gallery.map((id) => photoFigure(id, "photo-gallery", "(max-width: 780px) 100vw, 22rem")).join("")}</div>`
    : "";
  return `
    <article class="section"><div class="wrap">
      ${banner}
      <h1>${esc(item.title)}</h1>
      <h2>Who it's for</h2>
      <p>${item.who}</p>
      <h2>The problem</h2>
      <p>${item.problem}</p>
      <h2>What we set up</h2>
      <p>${item.setup}</p>
      ${gallery}
      <h2>Deliverables</h2>
      <p>${item.deliverables}</p>
      ${packs}
      <h2>Timeline</h2>
      <p>${item.timeline}</p>
      <h2>Which tier fits</h2>
      <p>${item.tier}</p>
      <h2>Demo</h2>
      ${demoBanner()}
      <p><a href="${esc(item.demoHref)}">${esc(item.demoName)}</a></p>
      <p class="btn-row"><a class="btn" href="/workflow-map/">Request a Workflow Map</a> ${emailFallback()}</p>
    </div></article>`;
}

function demoPages() {
  const items = [
    ["document-intake", "Document intake demo", "A fictional document packet is the input. The workflow drafts a summary. A person reviews it. There is no recording yet."],
    ["lead-follow-up", "Lead follow-up demo", "A fictional inquiry is the input. The workflow drafts a follow-up. A person approves it before anything would be sent. There is no recording yet."],
    ["trade-office", "Trade office demo", "Fictional office notes move through one handoff. A person reviews the draft. This is not a customer project."],
  ];
  return items.map(([slug, title, body]) => ({
    path: `/demos/${slug}/`,
    page: {
      title,
      description: DEMO_LABEL,
      path: `/demos/${slug}/`,
      active: "/demos/",
      crumbs: [["Demos", "/demos/"], [title]],
      main: `<article class="section"><div class="wrap">
        <h1>${esc(title)}</h1>
        ${demoBanner()}
        <p>${body}</p>
        <div class="media-placeholder"><p>Demo video coming soon</p></div>
        <p>Planned stills would be watermarked fictional data. None are posted yet.</p>
        <p><a class="btn" href="/workflow-map/">Request a Workflow Map</a></p>
      </div></article>`,
    },
  }));
}

function quoteDemoMain() {
  return `<article class="section"><div class="wrap">
    <h1>See a workflow run, from scope notes to quote PDF</h1>
    ${photoFigure("f08", "photo-full", "(max-width: 780px) 100vw, 72rem")}
    ${demoBanner()}
    <h2>What you're looking at</h2>
    <p>A fictional small contractor's rough scope notes go into an internal quote workflow. The workflow drafts a structured quote. A person reviews and edits it. The output is a quote PDF. This is the kind of process a Workflow Map or One Workflow Build covers.</p>
    <h2>Video</h2>
    <div class="media-placeholder"><p><strong>Demo video coming soon</strong></p><p>A walkthrough of 3 minutes or less will go here after it is recorded. This is not a video player.</p></div>
    <!-- TODO: No VideoObject JSON-LD until a real recording exists. -->
    <ol>
      <li>0:00 The input: fictional scope notes</li>
      <li>0:30 The steps: trigger, extract line items, draft quote, human review, PDF</li>
      <li>1:15 The draft quote, with one correction on screen</li>
      <li>2:15 Final quote PDF</li>
      <li>2:40 What would change for your business: your template, your tools</li>
    </ol>
    <p class="note">These are planned chapters for a future recording. Demo run time, not a measured client result.</p>
    <h2>What this demo does not show</h2>
    <ul>
      <li>Real client data</li>
      <li>Performance numbers</li>
      <li>Anything built for another company</li>
    </ul>
    <p><a class="btn" href="/contact/">Describe your process</a></p>
  </div></article>`;
}

function demosHub() {
  return `<article class="section"><div class="wrap">
    <h1>Demos</h1>
    ${photoFigure("f08", "photo-full", "(max-width: 780px) 100vw, 72rem")}
    ${demoBanner()}
    <p>Five demonstrations. Each one is a placeholder until a recording exists. Watch full demo means the note below, not a video.</p>
    <div class="media-placeholder" id="watch"><p><strong>Demo video coming soon</strong></p></div>
    <h2 id="estimating-overflow">Steel estimating</h2>
    ${demoBanner()}
    <p>Estimate packets from drawings are on this site. This demonstration is not a customer result.</p>
    <p><a href="${esc(steelPath)}">Open steel estimating</a></p>
    <h2>Quote Pack Demo</h2>
    <p><a href="${base}/demo/">Open the quote pack demo</a></p>
    <h2>Document Intake</h2>
    <p><a href="/demos/document-intake/">Open the document intake demo</a></p>
    <h2>Lead Follow-Up</h2>
    <p><a href="/demos/lead-follow-up/">Open the lead follow-up demo</a></p>
    <h2>Trade Office Workflow</h2>
    <p><a href="/demos/trade-office/">Open the trade office demo</a></p>
    <p><a class="btn" href="/workflow-map/">Request a Workflow Map</a></p>
  </div></article>`;
}

function adsMain() {
  return `<article class="section"><div class="wrap">
    ${photoFigure("f38", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    <h1>Short video ads for small businesses</h1>
    <p class="lede">Short ads for contractors and trades. The same approach as the Granite Models Automations overview on this page: people-and-workflow scenes, a voiceover, and branded cards.</p>
    <p class="price">from ${esc(adsPrice)}</p>
    <p>Ask for a quote. Nothing is charged until you approve that quote. This page has no payment button.</p>
    <div class="btn-row">
      <a class="btn" href="/contact/">Ask for a quote</a>
      ${emailFallback()}
    </div>
    <h2>What you get</h2>
    <ul>
      <li>People-and-workflow scenes, made the same way as our own overview.</li>
      <li>A voiceover.</li>
      <li>Branded cards.</li>
      <li>Export files for 16:9, 9:16, and 1:1.</li>
    </ul>
    <h2>Who it's for</h2>
    <p>Contractors, trades, and other small businesses that need a short ad. We do not publish other companies' names or results on this site.</p>
    <h2>Overview</h2>
    <p>The player below is our own overview. It is not a customer story.</p>
  </div></article>
  ${adSlot()}`;
}
function comingSoonMain(title, text, photoId) {
  return `<article class="section"><div class="wrap">
    ${photoId ? photoFigure(photoId, "page-banner", "(max-width: 780px) 100vw, 72rem") : ""}
    <p class="soon">Coming soon</p>
    <h1>${esc(title)}</h1>
    <p class="lede">${esc(text)}</p>
    <p>This is not offered yet. ${emailFallback()}.</p>
    <p><a class="btn" href="/contact/">Contact us</a></p>
  </div></article>`;
}

function howMain() {
  return `<article class="section"><div class="wrap">
    <h1>How it works</h1>
    ${photoFigure("f17", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    ${stepsHtml()}
    ${photoFigure("f31", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    <h2>Discover</h2>
    <p>You describe one process. We reply by email with whether it fits, which tier, and a fixed price. Nothing is charged at this step.</p>
    <h2>Design</h2>
    <p>A Workflow Map is the one-page plan: steps, tools, what to automate, and what stays human. For a build, you approve a short written scope before work starts.</p>
    <h2>Implement</h2>
    <p>We set the workflow up in your accounts and test it on sample data. Check-ins are at kickoff and handoff. We never ask for passwords.</p>
    <h2>Train and launch</h2>
    <p>You get a runbook. Connected Workflows also includes a 30-minute training session. We ask you to remove our access.</p>
    <h2>Grow</h2>
    <p>You own the workflow. Another process can be a new map later. This offer does not include an ongoing retainer.</p>
    <h2>Rules that sit beside the steps</h2>
    <p>What you provide, how payment works, and what happens if inputs are late are written on the <a href="/policies/">policies</a> page. Refunds, revisions, and file deletion each have their own page.</p>
    <p><a class="btn" href="/workflow-map/">Request a Workflow Map</a></p>
  </div></article>`;
}

function aboutMain() {
  return `<article class="section"><div class="wrap">
    <h1>About ${esc(brand)}</h1>
    ${lockup("lockup-about")}
    ${photoFigure("f38", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    <p class="lede">${esc(brand)} (${esc(short)}) sets up workflows for small businesses. The company is based in New Hampshire. Jon reviews the work.</p>
    ${deliveryReviewNote()}
    <p>We're new to building workflows for outside clients, and we'd rather tell you that than dress it up. The demos are our own internal workflows on fictional data.</p>
    <p>Fixed price, quoted before you pay. Built in your accounts. No passwords. Written policies are linked in the footer.</p>
    <p>Steel estimate packets are listed on the <a href="${esc(steelPath)}">steel estimating</a> page.</p>
    <p><a class="btn" href="/workflow-map/">Request a Workflow Map</a></p>
  </div></article>`;
}

function contactMain() {
  return `<article class="section"><div class="wrap">
    ${photoFigure("f31", "page-banner", "(max-width: 780px) 100vw, 40rem")}
    <h1>Tell us one process you'd like off your plate.</h1>
    <p class="lede">Three lines is enough: what comes in, what should come out, and who touches it today. We'll reply with whether it fits and a fixed price. Nothing is charged until you approve.</p>
    ${formEnabled ? `<p>The form does not send. ${emailFallback()}.</p>${intakeForm("ct")}${formNotes()}` : contactBlock()}
  </div></article>`;
}

function policiesMain() {
  return `<article class="section"><div class="wrap">
    <h1>Policies</h1>
    <p>These are plain-language rules for workflow setup. They are not legal advice. Refunds, revisions, and file retention each have a page of their own.</p>
    <ul>
      <li><a href="/refund-policy/">Refund policy</a></li>
      <li><a href="/revision-policy/">Revision policy</a></li>
      <li><a href="/file-retention-policy/">File retention policy</a></li>
    </ul>
    <h2>What you provide</h2>
    <ul>
      <li>One named person who can answer questions and approve outputs.</li>
      <li>3-5 examples of what comes in and what should come out. Redacted or made-up examples are fine.</li>
      <li>The list of tools you already pay for.</li>
      <li>Your inputs within 10 business days of kickoff.</li>
      <li>For builds: access through your tool's invite or sharing feature, a signed-off scope, and time for the check-ins. We never ask for passwords.</li>
    </ul>
    <h2>Payment</h2>
    <ul>
      <li>Stripe payment links are sent manually after fit is confirmed and, for a build, after the written scope is approved. Nothing is sent automatically.</li>
      <li>Workflow Map and One Workflow Build are paid in full at that point.</li>
      <li>Connected Workflows is 50% upfront and 50% at handoff.</li>
      <li>Fiverr buyers pay and communicate only on Fiverr.</li>
      <li>You pay your tool vendors directly.</li>
      <li>Workflow Map, Implementation, and Connected or custom work have no public payment button. <a href="/contact/">Contact</a> and we email the Stripe link after scope is confirmed.</li>
    </ul>
    <h2>Delay rule</h2>
    <p>If inputs have not arrived 10 business days after kickoff, the clock pauses. After 30 days without a response the job is paused. It can restart within 60 days at the same price.</p>
    <p><a class="btn" href="/workflow-map/">Request a Workflow Map</a></p>
  </div></article>`;
}

function refundMain() {
  return `<article class="section"><div class="wrap">
    <h1>Refund policy</h1>
    <p>Plain language, not legal advice.</p>
    <ul>
      <li>Full refund if you cancel before kickoff.</li>
      <li>After kickoff, you get a full refund only if we can't deliver what the signed scope describes, even after the included revision round or fix window.</li>
      <li>Changes you request to the scope, and delays of more than 30 days on your side, are not refundable.</li>
    </ul>
    <p><a href="/policies/">Payment and delay rules</a></p>
  </div></article>`;
}

function revisionMain() {
  return `<article class="section"><div class="wrap">
    <h1>Revision policy</h1>
    <p>Plain language, not legal advice.</p>
    <ul>
      <li>One revision round per tier. Connected Workflows includes one round per workflow.</li>
      <li>Send the changes as one list within 7 days of delivery.</li>
      <li>Anything beyond that round is quoted in writing first.</li>
      <li>Fix window after handoff: 14 days for a One Workflow Build, 30 days for Connected Workflows. The Workflow Map is a document, so the revision round covers it.</li>
      <li>A fix covers a defect inside the signed scope. After the window, fixes are quoted per request.</li>
    </ul>
  </div></article>`;
}

function retentionMain() {
  return `<article class="section"><div class="wrap">
    <h1>File retention policy</h1>
    <p>Plain language, not legal advice.</p>
    <ul>
      <li>Files are used only for your job.</li>
      <li>Client files are deleted 30 days after handoff, or sooner if you ask in writing.</li>
      <li>We never ask for passwords, and we do not store them.</li>
      <li>Access is invite-based. At handoff we ask you to remove it.</li>
      <li>We'll sign a reasonable mutual NDA on request.</li>
      <li>Parts of material you send may be processed by the AI tools used to do the work. We work from redacted or sample data wherever the job allows.</li>
    </ul>
    <p>See the <a href="/privacy/">privacy note</a>${launch ? "" : ". It is still a draft"}.</p>
  </div></article>`;
}

function termsMain() {
  return `<article class="section"><div class="wrap">
    <p class="approval-banner">${launch ? "This is not legal advice and it is not a signed contract." : `<strong>${DRAFT}</strong>. This is not legal advice and it is not a signed contract.`}</p>
    <h1>Terms</h1>
    <p>${launch ? "The working rules for a workflow job are" : "Until Jon approves this page, the working rules for a workflow job are"} the <a href="/refund-policy/">refund policy</a>, the <a href="/revision-policy/">revision policy</a>, the <a href="/file-retention-policy/">file retention policy</a>, and the <a href="/policies/">client requirements, payment, and delay rule</a>.</p>
    <p>Nothing on this draft page adds a fee, a warranty, or a promise of savings.</p>
  </div></article>`;
}

function privacyMain() {
  return `<article class="section"><div class="wrap">
    <p class="approval-banner">${launch ? "This is not legal advice." : `<strong>${DRAFT}</strong>. This is not legal advice.`}</p>
    <h1>Privacy note</h1>
    <p class="lede">This note says how ${esc(brand)} handles files for a workflow job${formEnabled ? ", and what the contact form collects" : ", and what to send by email"}.${launch ? "" : " It is a draft."}</p>
    <h2>Files for your job</h2>
    <ul>
      <li>Files and details you share are used only for your job.</li>
      <li>They are deleted 30 days after handoff, or sooner if you ask in writing.</li>
      <li>We never ask for passwords, and we do not store passwords.</li>
      <li>Access is invite-based. At handoff we ask you to remove that access.</li>
      <li>Parts of the material you send may be processed by the AI tools used to do the work. We work from redacted or sample data wherever the job allows.</li>
      <li>We don't take jobs that need health records, card numbers, bank or payroll logins, or government ID numbers.</li>
    </ul>
    ${formEnabled ? `<h2>What the contact form collects</h2>
    <ul>
      <li>First name and business email, so a person can reply.</li>
      <li>Business name, if you give one.</li>
      <li>What kind of business you run, team size, and how often the process happens.</li>
      <li>The process you describe.</li>
      <li>The tools you already use, and a CRM name if you add one.</li>
      <li>Whether the process involves health records, card numbers, bank or payroll logins, or government ID numbers.</li>
      <li>Which option you are leaning toward, and your timing, if you choose to say.</li>
      <li>Your confirmation that you should not send passwords or sensitive data, and that ${esc(brand)} will reply by email.</li>
    </ul>
    <p>The form does not ask for a phone number, a postal address, or a file upload. It does not submit. ${emailFallback()}.</p>` : `<h2>What to send by email</h2>
    <ul>
      <li>Business type</li>
      <li>The process</li>
      <li>Tools used</li>
      <li>3 to 5 examples</li>
    </ul>
    <p>Do not send passwords, card numbers, health information, or bank details. ${emailFallback()}</p>`}
  </div></article>`;
}

function stepsHtml() {
  return `<div class="steps">
    ${step("1", "Discover", "You describe one process. We say whether it fits and which tier. Nothing is charged yet.")}
    ${step("2", "Design", "A map, then a written scope for a build. You approve it before we start.")}
    ${step("3", "Implement", "We set the workflow up in your accounts and test it on sample data.")}
    ${step("4", "Train and launch", "You get the runbook. We ask you to remove our access.")}
    ${step("5", "Grow", "You own it. Another process can be a new map. No retainer in this offer.")}
  </div>`;
}

function priceGrid() {
  const href = "/contact/";
  return `<div class="price-grid">
    ${priceCard("Workflow Map", mapPrice, "3 business days", ["One process mapped", "A plan for what stays human", "A fixed price to build it", "1 revision round"], "Start with a Map", href, false)}
    ${priceCard("Implementation", buildPrice, "7 business days", ["Each workflow has a defined scope, deliverables, and pricing.", `Most standard workflows start at ${buildPrice}.`, "One Workflow Build in your accounts: 1 trigger, up to 5 steps, up to 2 apps", "Human approval before anything customer-facing", "14-day fix window"], "Ask about a Build", href, true)}
    ${priceCard("Connected Workflows", `From ${connectedPrice}`, "15 business days", ["Up to 3 workflows and 4 apps", "Larger systems are a custom scope", "50% upfront, 50% at handoff", "30-day fix window"], "Request a quote", href, false)}
  </div>
  <p>Workflow Map, Implementation, and Connected or custom work have no public payment button. Stripe links for those tiers are sent by email after scope is confirmed.</p>`;
}

function priceCard(name, price, days, items, button, href, featured) {
  return `<article class="price-card${featured ? " featured" : ""}">
    <h3>${esc(name)}</h3>
    <p class="price">${esc(price)}</p>
    <p>${esc(days)}</p>
    <ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
    <a class="btn" href="${esc(href)}">${esc(button)}</a>
  </article>`;
}

function point(num, title, text) {
  return `<article class="point"><div class="icon" aria-hidden="true">${num}</div><strong>${esc(title)}</strong><p>${esc(text)}</p></article>`;
}
function step(num, title, text) {
  return `<article class="step"><em>${num}</em><strong>${esc(title)}</strong><p>${esc(text)}</p></article>`;
}
function card(title, text, href, soon, photoId, contain) {
  const image = photoId ? photoFigure(photoId, contain ? "photo-contain" : "photo-card", "(max-width: 780px) 100vw, 18rem") : "";
  return `<article class="card">${image}<h3>${esc(title)}${soon ? ` <span class="soon">Coming soon</span>` : ""}</h3><p>${esc(text)}</p><a class="btn" href="${esc(href)}">Learn more</a></article>`;
}
function externalCard(title, text, href, label, photoId) {
  const image = photoId ? photoFigure(photoId, "photo-card", "(max-width: 780px) 100vw, 18rem") : "";
  return `<article class="card">${image}<h3>${esc(title)}</h3><p>${esc(text)}</p><a class="btn" href="${esc(href)}" rel="noopener noreferrer">${esc(label)}</a></article>`;
}
function demoBanner() {
  return `<p class="demo-banner">${esc(DEMO_LABEL)}</p><p><strong>Watch full demo:</strong> Demo video coming soon</p>`;
}
function demoSwitcher(tabs) {
  const inputs = tabs.map(([id, , checked]) => `<input type="radio" name="demo-tab" id="demo-${id}" ${checked ? "checked" : ""}>`).join("");
  const labels = tabs.map(([id, label]) => `<label for="demo-${id}">${esc(label)}</label>`).join("");
  const panels = tabs.map(([id, , , panel]) => `<div class="panel panel-${id}">${panel}</div>`).join("");
  return `<div class="demo-switcher">${inputs}<div class="demo-labels">${labels}</div>${panels}</div>`;
}
function demoPanel(title, href, text) {
  return `${demoBanner()}<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="media-placeholder"><p>Demo video coming soon</p></div><p><a href="${esc(href)}">Open this demo</a></p>`;
}
function estimatingDemoPanel() {
  return `${demoBanner()}<h3>Steel estimating</h3><p>The estimate packet offer is on this site. This panel is not a customer result.</p><div class="media-placeholder"><p>Demo video coming soon</p></div><p><a href="${esc(steelPath)}">Open steel estimating</a></p>`;
}
function documentPacksHtml() {
  const groups = [];
  for (const pack of documentPacks) {
    let group = groups.find((item) => item.name === pack.group);
    if (!group) {
      group = { name: pack.group, packs: [] };
      groups.push(group);
    }
    group.packs.push(pack);
  }
  const listed = groups.map((group) => `
    <h3>${esc(group.name)}</h3>
    <div class="pack-grid">
      ${group.packs.map((pack) => `<article class="pack-card">
        <h3>${esc(pack.name)}</h3>
        <p class="price">${esc(money(pack.price))}</p>
        <a class="btn" href="${esc(pack.url)}" target="_blank" rel="noopener noreferrer">Buy</a>
      </article>`).join("")}
    </div>`).join("");
  const quotes = quoteOnlyPacks.map((name) => `<article class="pack-card">
    <h3>${esc(name)}</h3>
    <p>No public payment link for this pack type.</p>
    <a class="btn secondary" href="/contact/">Ask for a quote</a>
  </article>`).join("");
  return `
    <h2>Listed packs</h2>
    <p>Each Buy button opens Stripe in a new tab. These links are only for the packs named here.</p>
    ${listed}
    <h2>Ask for a quote</h2>
    <p>These pack types are listed without a payment link.</p>
    <div class="pack-grid">${quotes}</div>`;
}
function callLink(className) {
  const cls = className ? ` class="${esc(className)}"` : "";
  return `<a${cls} href="tel:${esc(phoneE164)}">Call ${esc(phoneDisplay)}</a>`;
}
function emailFallback() {
  return `<a href="mailto:${esc(inbox)}">Email ${esc(inbox)}</a> ${callLink()}`;
}
function headerMark() {
  return `<picture>
    <source srcset="${esc(logoWebp)}" type="image/webp">
    <img class="brand-logo" src="${esc(logoPng)}" width="480" height="444" alt="${esc(logoAlt)}">
  </picture>`;
}
function photoFigure(id, className, sizes) {
  const photo = photos[id];
  if (!photo) throw new Error(`Unknown photo ${id}`);
  const meta = photoMeta[id];
  const srcset = [640, 960, 1600].map((width) => `/assets/photos/${id}-${width}.webp ${width}w`).join(", ");
  return `<figure class="photo ${className}">
    <picture>
      <source type="image/webp" srcset="${srcset}" sizes="${esc(sizes)}">
      <img src="/assets/photos/${id}-1600.webp" alt="${esc(photo.alt)}" width="${meta.width}" height="${meta.height}">
    </picture>
  </figure>`;
}
function adSlot() {
  const file = "assets/video/gma-ad-main-16x9.mp4";
  const present = existsSync(join(siteRoot, file));
  const poster = "/assets/photos/f01-1600.webp";
  const posterImg = present
    ? ""
    : `<img class="ad-poster" src="${poster}" alt="${esc(photos.f01.alt)}" width="1600" height="900">`;
  return `<section class="section" id="ad"><div class="wrap">
    <h2>Overview</h2>
    <p>A Granite Models Automations overview. Not a customer story.</p>
    <div class="ad-frame">
      ${posterImg}
      <video class="ad-video${present ? "" : " ad-video-missing"}" poster="${poster}" width="1600" height="900" preload="none" playsinline${present ? " controls" : ""}>
        <source src="/${file}" type="video/mp4">
      </video>
    </div>
    ${present ? "" : "<p>The overview plays here when the video file is in place. Until then, this poster stays up.</p>"}
  </div></section>`;
}
function lockup(className) {
  return `<picture class="lockup ${className}">
    <source srcset="${esc(logoWebp)}" type="image/webp">
    <img src="${esc(logoPng)}" width="480" height="444" alt="${esc(logoAlt)}">
  </picture>`;
}
function iconLinks() {
  return `<link rel="icon" href="${esc(favicon192)}" type="image/png" sizes="192x192">
  <link rel="icon" href="${esc(favicon256)}" type="image/png" sizes="256x256">
  <link rel="icon" href="${esc(favicon512)}" type="image/png" sizes="512x512">
  <link rel="apple-touch-icon" href="${esc(appleIcon)}">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:image" content="${esc(`${domain}${logoPng}`)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="480">
  <meta property="og:image:height" content="444">
  <meta property="og:image:alt" content="${esc(logoAlt)}">`;
}
function heroArt() {
  const src = config.LICENSED_IMAGES && config.LICENSED_IMAGES.hero;
  if (src) {
    const alt = config.LICENSED_IMAGES.heroAlt || "Licensed photo";
    return `<img src="${esc(src)}" alt="${esc(alt)}">`;
  }
  return `<!-- LICENSED_IMAGES.hero is empty. CSS line-art stands in until a licensed photo is added. -->`;
}
function deliveryReviewNote() {
  if (launch || deliveryReview !== "TODO-CONFIRM") {
    return deliveryReview === "TODO-CONFIRM" ? "" : `<p>${esc(deliveryReview)}</p>`;
  }
  return `<!-- DELIVERY_REVIEW is TODO-CONFIRM. Do not state that every delivery is reviewed until Jon confirms it. -->`;
}
function quoteMailto() {
  const subject = encodeURIComponent("Quote request");
  const body = encodeURIComponent("Business type:\n\nThe process:\n\nTools used:\n\n3 to 5 examples:\n");
  return `mailto:${inbox}?subject=${subject}&body=${body}`;
}
function contactBlock() {
  return `<div class="contact-block">
    <p>${callLink()}</p>
    <p><a href="${quoteMailto()}">Email ${esc(inbox)}</a></p>
    <p>In the email, include:</p>
    <ul>
      <li>Business type</li>
      <li>The process</li>
      <li>Tools used</li>
      <li>3 to 5 examples</li>
    </ul>
    <p>Do not send passwords, card numbers, health information, or bank details.</p>
  </div>`;
}
function formNotes() {
  return `<!-- TODO: Reply-time target is unconfirmed. Do not publish a number of business days until capacity is confirmed. -->
    <p>Please don't include passwords, card numbers, health information, or bank details.</p>
    <p>We reply by email. ${emailFallback()}.</p>
    <p>Jon reads every request and replies by email. Nothing is charged until you approve a fixed price. Nothing is sent automatically.</p>`;
}
function shortForm(prefix) {
  const id = (name) => `${prefix}-${name}`;
  return `<form class="intake" id="${id("form")}" action="#${id("form")}" method="post" onsubmit="return false" aria-describedby="${id("status")}">
    <!-- Submit stays disabled. No backend. The mailto is the working fallback. -->
    <div class="field"><label for="${id("first")}">First name <span class="req">(required)</span></label><input id="${id("first")}" name="first-name" type="text" autocomplete="given-name" required></div>
    <div class="field"><label for="${id("email")}">Business email <span class="req">(required)</span></label><input id="${id("email")}" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="${id("business")}">Business name <span class="opt">(optional)</span></label><input id="${id("business")}" name="business-name" type="text" autocomplete="organization"></div>
    <div class="field"><label for="${id("process")}">What do you want off your plate? <span class="req">(required)</span></label><textarea id="${id("process")}" name="process" required></textarea></div>
    <label class="choice"><input type="checkbox" name="consent" required> <span>I understand I shouldn't send passwords or sensitive data here, and that ${esc(brand)} will reply by email. <a href="/privacy/">Privacy note${launch ? "" : " (DRAFT)"}</a></span></label>
    <p class="form-status" id="${id("status")}">This form does not send. There is no backend yet. The full intake is on the <a href="/contact/">contact page</a>. ${emailFallback()}.</p>
    <button class="btn" type="submit" disabled>Send my process</button>
  </form>`;
}
function intakeForm(prefix) {
  const id = (name) => `${prefix}-${name}`;
  const tools = ["Google Workspace", "Microsoft 365", "Zapier", "Make", "n8n", "QuickBooks", "CRM (name)", "Other"];
  return `<form class="intake" id="${id("form")}" action="#${id("form")}" method="post" onsubmit="return false" aria-describedby="${id("status")}">
    <!-- Submit stays disabled. No backend. The mailto is the working fallback. No third-party form service. -->
    <div class="field"><label for="${id("first")}">First name <span class="req">(required)</span></label><input id="${id("first")}" name="first-name" type="text" autocomplete="given-name" required></div>
    <div class="field"><label for="${id("email")}">Business email <span class="req">(required)</span></label><input id="${id("email")}" name="email" type="email" autocomplete="email" required></div>
    <div class="field"><label for="${id("business")}">Business name <span class="opt">(optional)</span></label><input id="${id("business")}" name="business-name" type="text" autocomplete="organization"></div>
    <div class="field"><label for="${id("kind")}">What kind of business? <span class="req">(required)</span></label>
      <select id="${id("kind")}" name="business-kind" required><option value="">Select one</option><option>Trade/contractor</option><option>Fabrication/manufacturing</option><option>Professional office</option><option>Other service</option><option>Other</option></select></div>
    <div class="field"><label for="${id("team")}">Team size <span class="req">(required)</span></label>
      <select id="${id("team")}" name="team-size" required><option value="">Select one</option><option>1</option><option>2-5</option><option>6-25</option><option>26+</option></select></div>
    <div class="field"><label for="${id("process")}">The process you want off your plate <span class="req">(required)</span></label><textarea id="${id("process")}" name="process" required></textarea></div>
    <div class="field"><label for="${id("often")}">How often does it happen? <span class="req">(required)</span></label>
      <select id="${id("often")}" name="frequency" required><option value="">Select one</option><option>Daily</option><option>Weekly</option><option>Monthly</option><option>Irregular</option></select></div>
    <fieldset><legend>Tools you already use (tick all) <span class="req">(required)</span></legend>
      ${tools.map((tool) => `<label class="choice"><input type="checkbox" name="tools" value="${esc(tool)}"> ${esc(tool)}</label>`).join("")}
      <div class="field"><label for="${id("crm")}">CRM name <span class="opt">(optional)</span></label><input id="${id("crm")}" name="crm-name" type="text"></div>
    </fieldset>
    <fieldset><legend>Does this process involve health records, card numbers, bank/payroll logins, or government ID numbers? <span class="req">(required)</span></legend>
      <label class="choice"><input type="radio" name="${prefix}-sensitive" value="yes" required> Yes</label>
      <label class="choice"><input type="radio" name="${prefix}-sensitive" value="no"> No</label>
    </fieldset>
    <div class="field"><label for="${id("tier")}">Which option are you leaning toward? <span class="opt">(optional)</span></label>
      <select id="${id("tier")}" name="tier"><option value="">Select one</option><option>Workflow Map (${esc(mapPrice)})</option><option>One Workflow Build (${esc(buildPrice)})</option><option>Connected Workflows (from ${esc(connectedPrice)})</option><option>Not sure</option></select>
    </div>
    <div class="field"><label for="${id("timing")}">Timing <span class="opt">(optional)</span></label>
      <select id="${id("timing")}" name="timing"><option value="">Select one</option><option>This month</option><option>Next 1-3 months</option><option>Just exploring</option></select></div>
    <fieldset><legend>Consent <span class="req">(required)</span></legend>
      <label class="choice"><input type="checkbox" name="consent" required> <span>I understand I shouldn't send passwords or sensitive data here, and that ${esc(brand)} will reply by email.</span></label>
      <p><a href="/privacy/">Privacy note${launch ? "" : " (DRAFT)"}</a></p>
    </fieldset>
    <p class="form-status" id="${id("status")}">This form does not send. There is no backend yet. ${emailFallback()}.</p>
    <button class="btn" type="submit" disabled data-cta-id="send-process">Send my process</button>
  </form>`;
}

function page({ title, description, path, active, crumbs, main, jsonLd, noindex = false }) {
  const canonical = `${domain}${path}`;
  const ld = jsonLd
    ? `\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2).replaceAll("<", "\\u003c")}\n</script>\n`
    : "";
  const robots = launch && !noindex ? "" : `  <meta name="robots" content="noindex, nofollow">\n`;
  const banner = launch ? "" : `  <p class="draft-flag">Draft site. Not published.</p>\n`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${robots}  <title>${esc(title)} | ${esc(brand)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="stylesheet" href="/css/site.css">
  ${iconLinks()}
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
${banner}  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/">${headerMark()}</a>
      <details class="site-nav">
        <summary class="menu-button">Menu</summary>
        <ul class="primary-nav">
          ${navItem("/", "Home", active)}
          <li><details class="dropdown"><summary>Workflow Setup</summary><ul class="dropdown-menu">
            ${drop(`${base}/`, "Workflow setup hub")}
            ${drop("/workflow-map/", "Workflow Map")}
            ${drop(steelPath, "Steel estimating")}
            ${drop("/quote-proposal-automation/", "Quote and proposal automation")}
            ${drop("/document-intake/", "Document intake and processing")}
            ${drop("/lead-follow-up/", "Lead follow-up and booking")}
            ${drop("/trade-office-workflow/", "Trade office workflow setup")}
            ${drop("/ai-document-packs/", "AI document and business packs")}
            ${drop("/custom-workflow-systems/", "Custom business workflow systems")}
          </ul></details></li>
          ${navItem("/websites-seo-aeo/", "Websites, SEO and AEO", active, true)}
          ${navItem("/ads-video/", "Ads and video", active)}
          ${navItem("/demos/", "Demos", active)}
          ${navItem("/how-it-works/", "How it works", active)}
          ${navItem("/about/", "About", active)}
          ${navItem("/contact/", "Contact", active)}
        </ul>
      </details>
      ${callLink("header-call")}
      <a class="btn header-cta" href="/workflow-map/">Request a Workflow Map</a>
    </div>
  </header>
  <main id="main">
    ${crumbHtml(crumbs)}
    ${main}
  </main>${ld}
  <footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        ${lockup("lockup-footer")}
        <p>AI workflow setup for real work.</p>
        <p>${emailFallback()}</p>
      </div>
      <nav aria-label="Footer">
        <ul class="footer-links">
          <li><a href="${base}/">Workflow setup</a></li>
          <li><a href="/workflow-map/">Workflow Map</a></li>
          <li><a href="/websites-seo-aeo/">Websites, SEO and AEO</a></li>
          <li><a href="/ads-video/">Ads and video</a></li>
          <li><a href="/demos/">Demos</a></li>
          <li><a href="/how-it-works/">How it works</a></li>
          <li><a href="/about/">About</a></li>
          <li><a href="/contact/">Contact</a></li>
        </ul>
      </nav>
      <nav aria-label="Policies">
        <ul class="footer-links">
          <li><a href="/privacy/">Privacy note${launch ? "" : " (DRAFT)"}</a></li>
          <li><a href="/refund-policy/">Refund policy</a></li>
          <li><a href="/revision-policy/">Revision policy</a></li>
          <li><a href="/file-retention-policy/">File retention policy</a></li>
          <li><a href="/terms/">Terms${launch ? "" : " (DRAFT)"}</a></li>
          <li><a href="/policies/">Policies</a></li>
        </ul>
      </nav>
    </div>
    <div class="wrap"><p class="legal">© 2026 ${esc(brand)}. All rights reserved.</p></div>
  </footer>
</body>
</html>
`;
}

function crumbHtml(items) {
  if (!items || !items.length) return "";
  const parts = [['<a href="/">Home</a>', false]].concat(items.map(([label, href]) => (
    href ? [`<a href="${esc(href)}">${esc(label)}</a>`, false] : [esc(label), true]
  )));
  return `<nav class="crumbs wrap" aria-label="Breadcrumb"><ol>${parts.map(([html, current]) => `<li${current ? ' aria-current="page"' : ""}>${html}</li>`).join("")}</ol></nav>`;
}

function navItem(href, label, active, soon) {
  const current = href === active ? ' aria-current="page"' : "";
  return `<li><a href="${esc(href)}"${current}>${esc(label)}${soon ? ` <span class="soon">Coming soon</span>` : ""}</a></li>`;
}
function drop(href, label, external) {
  const rel = external ? ' rel="noopener noreferrer"' : "";
  return `<li><a href="${esc(href)}"${rel}>${esc(label)}</a></li>`;
}

function writePage(urlPath, html, options = {}) {
  const rel = urlPath.replace(/^\/+/, "");
  if (options.sitemap !== false) sitemapPaths.push(urlPath.endsWith("/") ? urlPath : `${urlPath}/`);
  const file = join(publicDir, rel, "index.html");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}
function writeSitemap() {
  const locs = [...new Set(sitemapPaths)].sort((a, b) => a.localeCompare(b));
  const body = locs.map((path) => `  <url><loc>${domain}${path}</loc></url>`).join("\n");
  writeFileSync(join(publicDir, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`);
}

function substitute(value) {
  if (typeof value === "string") {
    return value
      .replaceAll("JON_CONFIRM_DOMAIN", domain)
      .replaceAll("JON_CONFIRM_BRAND_NAME", brand)
      .replaceAll("JON_CONFIRM_INBOX", inbox)
      .replaceAll("/workflow-automation", base);
  }
  if (Array.isArray(value)) return value.map(substitute);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = substitute(item);
    return out;
  }
  return value;
}

function syncPrices(data) {
  const service = (data["@graph"] || []).find((node) => node["@type"] === "Service");
  if (!service) return;
  if (service.provider && typeof service.provider === "object") service.provider.name = brand;
  const org = (data["@graph"] || []).find((node) => hasType(node, "Organization") || hasType(node, "LocalBusiness"));
  if (org) {
    org["@type"] = ["Organization", "LocalBusiness"];
    org.name = brand;
    org.email = inbox;
    org.telephone = phoneE164;
    org.logo = `${domain}${logoPng}`;
  }
  for (const offer of service.offers || []) {
    if (offer.name === "Workflow Map") offer.price = Number(config.WORKFLOW_MAP_PRICE).toFixed(2);
    if (offer.name === "One Workflow Build") offer.price = Number(config.ONE_WORKFLOW_BUILD_PRICE).toFixed(2);
    if (offer.name === "Connected Workflows" && offer.priceSpecification) {
      offer.priceSpecification.minPrice = Number(config.CONNECTED_WORKFLOWS_FROM).toFixed(2);
    }
  }
  const graph = data["@graph"];
  if (Array.isArray(graph) && !graph.some((node) => node && node["@id"] === `${domain}/ads-video/#service`)) {
    graph.push(adsServiceNode());
  }
}
function applyLaunchFaqs(data) {
  if (!launch) return;
  const graph = data["@graph"] || [];
  const faq = graph.find((node) => node["@type"] === "FAQPage");
  if (!faq || !Array.isArray(faq.mainEntity)) return;
  if (faq.mainEntity.some((item) => item && item.name === "Which tools do you use?")) return;
  faq.mainEntity.splice(1, 0, {
    "@type": "Question",
    name: "Which tools do you use?",
    acceptedAnswer: {
      "@type": "Answer",
      text: "Yours, first. The workflow is built in the tools you already use. We have not published a platform list. We never ask for passwords.",
    },
  });
}
function syncRenderYaml() {
  const file = join(siteRoot, "render.yaml");
  let yaml = readFileSync(file, "utf8");
  const block = "      - path: /*\n        name: X-Robots-Tag\n        value: noindex, nofollow\n";
  const has = yaml.includes("name: X-Robots-Tag");
  if (launch && has) yaml = yaml.replace(block, "");
  if (!launch && !has) yaml = yaml.replace("    headers:\n", `    headers:\n${block}`);
  if (yaml !== readFileSync(file, "utf8")) writeFileSync(file, yaml);
}
function hasType(node, type) {
  const types = node && node["@type"] == null ? [] : [].concat(node["@type"]);
  return types.includes(type);
}
function orgNode() {
  return {
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${domain}/#org`,
    name: brand,
    url: `${domain}/`,
    email: inbox,
    telephone: phoneE164,
    logo: `${domain}${logoPng}`,
  };
}
function adsServiceNode() {
  return {
    "@type": "Service",
    "@id": `${domain}/ads-video/#service`,
    name: "Ads and video",
    serviceType: "Short video ads for small businesses",
    description: "Short video ads for contractors and trades. People-and-workflow scenes, a voiceover, and branded cards, exported for 16:9, 9:16, and 1:1. Ask for a quote. No public payment link.",
    provider: { "@id": `${domain}/#org` },
    audience: { "@type": "BusinessAudience", audienceType: "Contractors and trades" },
    url: `${domain}/ads-video/`,
    offers: {
      "@type": "Offer",
      name: "Short video ad",
      description: "Ask for a quote. Nothing is charged until the quote is approved.",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: Number(config.ADS_VIDEO_FROM).toFixed(2),
        priceCurrency: "USD",
      },
      priceCurrency: "USD",
      url: `${domain}/contact/`,
    },
  };
}

function faqEntries(data) {
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [];
  const faq = graph.find((node) => node["@type"] === "FAQPage");
  if (!faq || !Array.isArray(faq.mainEntity)) throw new Error("JSON-LD is missing FAQPage questions");
  return faq.mainEntity.map((node) => ({ q: node.name, a: node.acceptedAnswer?.text }));
}

function cleanPath(value) {
  let path = value.trim();
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (path.includes("..") || path.includes(" ")) throw new Error("WORKFLOW_BASE_PATH is not a safe slug");
  return path;
}
function brandAssetPath(value, key) {
  const path = requiredString(value, key);
  if (!path.startsWith("/assets/brand/") || path.includes("..")) {
    throw new Error(`${key} must be a /assets/brand/ path`);
  }
  return path;
}
function publishBrandAssets() {
  const srcDir = join(siteRoot, "assets", "brand");
  const outDir = join(publicDir, "assets", "brand");
  mkdirSync(outDir, { recursive: true });
  const master = join(srcDir, "gma-logo-clean.png");
  const iconMaster = join(srcDir, "gma-icon-512.png");
  runFfmpeg(["-i", iconMaster, "-vf", "scale=192:192", join(outDir, favicon192.slice("/assets/brand/".length))]);
  runFfmpeg(["-i", iconMaster, "-vf", "scale=256:256", join(outDir, logoIcon.slice("/assets/brand/".length))]);
  copyFileSync(iconMaster, join(outDir, favicon512.slice("/assets/brand/".length)));
  const pngOut = join(outDir, logoPng.slice("/assets/brand/".length));
  const webpOut = join(outDir, logoWebp.slice("/assets/brand/".length));
  runFfmpeg(["-i", master, "-vf", "scale=480:-1", pngOut]);
  runFfmpeg(["-i", master, "-vf", "scale=480:-1", "-c:v", "libwebp", "-quality", "80", "-compression_level", "6", webpOut]);
  const size = pngSize(pngOut);
  if (size.width !== 480) throw new Error(`Expected the lockup PNG to be 480px wide, got ${size.width}`);
}
function publishVideo() {
  const file = "assets/video/gma-ad-main-16x9.mp4";
  const src = join(siteRoot, file);
  if (!existsSync(src)) return;
  const dest = join(publicDir, file);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
function publishSamples() {
  const name = "sample-map-hvac-missed-call.pdf";
  const src = join(siteRoot, "assets", "samples", name);
  if (!existsSync(src)) throw new Error(`Missing sample map PDF ${src}`);
  const dest = join(publicDir, "samples", name);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}
function publishPhotos() {
  const srcDir = join(siteRoot, "assets", "photos");
  const outDir = join(publicDir, "assets", "photos");
  mkdirSync(outDir, { recursive: true });
  for (const photo of config.PHOTOS) {
    const src = join(srcDir, `${photo.id}.png`);
    if (!existsSync(src)) throw new Error(`Missing photo ${src}`);
    for (const width of [1600, 960, 640]) {
      runFfmpeg(["-i", src, "-vf", `scale=${width}:-2`, "-c:v", "libwebp", "-quality", "76", join(outDir, `${photo.id}-${width}.webp`)]);
    }
    photoMeta[photo.id] = mediaSize(join(outDir, `${photo.id}-1600.webp`));
    if (photoMeta[photo.id].width > 1600) throw new Error(`${photo.id} is wider than 1600px`);
  }
}
function loadPhotos(value) {
  if (!Array.isArray(value) || value.length !== 10) throw new Error("Set the ten PHOTOS in site.config.json");
  const out = {};
  for (const photo of value) {
    const id = requiredString(photo && photo.id, "PHOTOS.id");
    const alt = requiredString(photo && photo.alt, `PHOTOS.${id}.alt`);
    if (/GMA staff|our client|testimonial/i.test(alt)) throw new Error(`Photo alt for ${id} must not call anyone staff, a client, or a testimonial`);
    out[id] = { id, alt };
  }
  for (const id of ["f01", "f07", "f08", "f13", "f17", "f19", "f22", "f31", "f36", "f38"]) {
    if (!out[id]) throw new Error(`Missing photo ${id}`);
  }
  if (!out.f08.alt.includes("SAMPLE DATA") || !out.f08.alt.includes("INTERNAL DEMONSTRATION")) {
    throw new Error("f08 alt must keep the SAMPLE DATA and INTERNAL DEMONSTRATION labels");
  }
  return out;
}
function mediaSize(file) {
  const result = spawnSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file,
  ], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `ffprobe failed for ${file}`);
  const [width, height] = result.stdout.trim().split("x").map(Number);
  if (!width || !height) throw new Error(`No size for ${file}`);
  return { width, height };
}
function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || "ffmpeg failed while writing brand assets");
}
function pngSize(file) {
  const buf = readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
function requiredString(value, key) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Set ${key} in site.config.json`);
  return value.trim();
}
function optionalString(value, key) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${key} in site.config.json must be a string`);
  return value.trim();
}

function steelEstimateProducts(value) {
  if (!Array.isArray(value) || value.length !== 2) throw new Error("Set the two STEEL_ESTIMATE rows in site.config.json");
  return value.map((row, index) => {
    const name = requiredString(row && row.name, `STEEL_ESTIMATE[${index}].name`);
    const price = requiredNumber(row && row.price, `STEEL_ESTIMATE[${index}].price`);
    const turnaround = requiredString(row && row.turnaround, `STEEL_ESTIMATE[${index}].turnaround`);
    const url = requiredString(row && row.url, `STEEL_ESTIMATE[${index}].url`);
    if (!url.startsWith("https://buy.stripe.com/")) throw new Error(`STEEL_ESTIMATE[${index}].url must be a Stripe Payment Link`);
    return { name, price, turnaround, url };
  });
}
function steelMain() {
  const cards = steelEstimates.map((row) => `<article class="price-card">
    <h2>${esc(row.name)}</h2>
    <p class="price">${esc(money(row.price))}</p>
    <p>${esc(row.turnaround)} after the files and the payment are both in.</p>
    <ul>
      <li>Workbook, summary PDF, and JSON file.</li>
      <li>Drawings need a text bill of materials or member list.</li>
      <li>A person reviews anything customer-facing.</li>
    </ul>
    <a class="btn" href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Buy</a>
  </article>`).join("");
  return `<article class="section"><div class="wrap">
    ${photoFigure("f07", "page-banner", "(max-width: 780px) 100vw, 72rem")}
    <h1>Steel estimating</h1>
    <p class="lede">An estimate packet from your drawings. This is a fixed-price file job, not a software subscription.</p>
    <div class="price-grid">${cards}</div>
    <h2>What to send</h2>
    <p>Pay on the button for the sheet count, then email the files to <a href="mailto:${esc(inbox)}">Email ${esc(inbox)}</a> ${callLink()}. Include the page count and the due date.</p>
    <p>Do not send passwords, card numbers, health information, or bank details.</p>
    <p>If the set has no text list, or it is scans only, email first. We will say whether the job can be done before you pay. Those sets are not booked as a 48-hour job.</p>
    <p><a class="btn secondary" href="/contact/">Ask a question first</a></p>
  </div></article>`;
}
function orderReceivedMain() {
  return `<article class="section"><div class="wrap">
    <h1>Payment received</h1>
    <p class="lede">If you paid for an estimate packet, email the drawings to <a href="mailto:${esc(inbox)}">${esc(inbox)}</a>. Include the page count and the due date.</p>
    <p>A person reviews anything customer-facing. ${callLink()}</p>
    <p><a class="btn" href="${esc(steelPath)}">Steel estimating</a></p>
  </div></article>`;
}
function paymentCancelledMain() {
  return `<article class="section"><div class="wrap">
    <h1>Payment was not completed</h1>
    <p class="lede">No charge was recorded on this page. You can return to the estimate packet or email us.</p>
    <p>${emailFallback()}</p>
    <p><a class="btn" href="${esc(steelPath)}">Steel estimating</a></p>
  </div></article>`;
}
function packProducts(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Set DOCUMENT_PACKS in site.config.json");
  return value.map((pack, index) => {
    const name = requiredString(pack && pack.name, `DOCUMENT_PACKS[${index}].name`);
    const group = requiredString(pack && pack.group, `DOCUMENT_PACKS[${index}].group`);
    const price = requiredNumber(pack && pack.price, `DOCUMENT_PACKS[${index}].price`);
    const url = requiredString(pack && pack.url, `DOCUMENT_PACKS[${index}].url`);
    if (!url.startsWith("https://buy.stripe.com/")) {
      throw new Error(`DOCUMENT_PACKS[${index}].url must be a https://buy.stripe.com/ link`);
    }
    return { name, group, price, url };
  });
}
function packNames(value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Set QUOTE_ONLY_PACKS in site.config.json");
  return value.map((name, index) => requiredString(name, `QUOTE_ONLY_PACKS[${index}]`));
}
function requiredNumber(value, key) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`Set ${key} in site.config.json`);
  return number;
}
function money(number) {
  return `$${number.toLocaleString("en-US")}`;
}
function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
