import "./site.css";
import "./products.css";
import { wireChrome } from "./chrome";
import { mount } from "./layer";
import { PROD, PROD_SRC } from "./stations";

type Plan = { id: string; name: string; price: string; note: string; url?: string };
const NAMES: Record<string, string> = { ticket: "Tool Ticket System", quotes: "Quotes & Proposals", estimating: "Steel Estimating", extract: "Doc Extract", organizer: "File Organizer" };
// Approved 2026-10-15. Buy it once, own it. Live Stripe Payment Links from ops/program-pay-links-v2.json.
// Payment plans stop after N payments: see ops/program-installments-RUNBOOK.md.
const PLANS: Record<string, Plan[]> = {
  ticket: [
    { id: "founding_own", name: "Founding price, own it", price: "$6,995", note: "First 3 shops. Support year 1 included, then $1,495/yr.", url: "https://buy.stripe.com/bJe4gzavc3HvcU7doddZ60I" },
    { id: "founding_12x630", name: "Founding, 12 payments", price: "12 x $641.21/mo", note: "Stops after 12 payments. Then it's yours.", url: "https://buy.stripe.com/14AfZhfPwem9cU7fwldZ60W" },
    { id: "founding_24x327", name: "Founding, 24 payments", price: "24 x $320.61/mo", note: "Stops after 24 payments. Then it's yours.", url: "https://buy.stripe.com/3cI6oH6eW3Hvf2f6ZPdZ60X" },
    { id: "list_own", name: "Own it", price: "$9,995", note: "Support year 1 included, then $1,495/yr.", url: "https://buy.stripe.com/4gM28r6eW2DrcU7fwldZ60L" },
  ],
  quotes: [
    { id: "founding_own", name: "Founding price, own it", price: "$1,495", note: "First 5 shops. Support year 1 included, then $295/yr.", url: "https://buy.stripe.com/dRm9ATgTA3HvbQ3doddZ60M" },
    { id: "6x260", name: "6 payments", price: "6 x $274.09/mo", note: "Stops after 6 payments. Then it's yours.", url: "https://buy.stripe.com/dRmeVdbzg4LzaLZeshdZ60Y" },
    { id: "12x135", name: "12 payments", price: "12 x $137.05/mo", note: "Stops after 12 payments. Then it's yours.", url: "https://buy.stripe.com/5kQaEXcDk7XL1bp5VLdZ60Z" },
    { id: "list_own", name: "Own it", price: "$1,995", note: "Support year 1 included, then $295/yr.", url: "https://buy.stripe.com/dRmeVd9r8em93jxck9dZ60P" },
  ],
  estimating: [],
  extract: [],
  organizer: [],
};
const dlg = document.getElementById("picker") as HTMLDialogElement;
function open(prog: string) {
  const plans = PLANS[prog] || [];
  document.getElementById("picker-t")!.textContent = NAMES[prog];
  document.getElementById("picker-sub")!.textContent = plans.length ? (prog === "ticket" || prog === "quotes" ? "Buy it once, own it. Checkout is a secure Stripe page. Installs on your PC - your data stays with you. Licence key provided with your installer." : "Pick a plan. Checkout is a secure Stripe page. After you pay, we build your installer with your licence already inside it and send you a private download link. You never type a key.") : "Pricing for this program is set per shop.";
  const box = document.getElementById("plans")!;
  box.replaceChildren();
  if (!plans.length) {
    const a = document.createElement("a");
    a.className = "b"; a.href = `mailto:support@granitemodels.store?subject=${encodeURIComponent(NAMES[prog] + " price")}`; a.textContent = "Ask for a price";
    box.append(a);
  }
  plans.forEach((p) => {
    const url = p.url;
    const el = document.createElement("div"); el.className = "plan";
    el.innerHTML = `<div><b></b><span class="pp"></span><small></small></div>`;
    el.querySelector("b")!.textContent = p.name; el.querySelector(".pp")!.textContent = p.price; el.querySelector("small")!.textContent = p.note;
    const a = document.createElement("a"); a.className = "b";
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Buy"; }
    else { a.href = `mailto:support@granitemodels.store?subject=${encodeURIComponent(`${NAMES[prog]}: ${p.name} (${p.price})`)}`; a.textContent = "Email to buy"; }
    el.append(a); box.append(el);
  });
  if (typeof dlg.showModal === "function") dlg.showModal(); else document.getElementById(prog)?.scrollIntoView();
}
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
document.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-buy]");
  if (b && !b.closest("#stage")) { e.preventDefault(); open(b.dataset.buy!); }
});

wireChrome();
mount(PROD_SRC, PROD, (a, e) => {
  if (a.dataset.buy) { e.preventDefault(); open(a.dataset.buy); return true; }
  return false;
});
