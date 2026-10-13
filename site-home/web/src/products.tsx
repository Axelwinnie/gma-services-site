import "./site.css";
import "./products.css";
import { wireChrome } from "./chrome";
import { mount } from "./layer";
import { PROD, PROD_SRC } from "./stations";

type Plan = { id: string; name: string; price: string; note: string; url?: string };
const NAMES: Record<string, string> = { ticket: "Tool Ticket System", estimating: "Steel Estimating", extract: "Doc Extract", organizer: "File Organizer" };
// Approved prices and their live Stripe Payment Links (from ops/program-pay-links.json).
const PLANS: Record<string, Plan[]> = {
  ticket: [
    { id: "monthly", name: "Monthly", price: "$450/mo", note: "License key, billed monthly.", url: "https://buy.stripe.com/dRm8wPeLs91PaLZac1dZ60w" },
    { id: "yearly", name: "Yearly", price: "$4,800/yr", note: "Prepaid for the year.", url: "https://buy.stripe.com/3cIaEXcDkb9X1bp3NDdZ60x" },
    { id: "own", name: "Buy to own", price: "$14,999", note: "Includes 3 months of support, then $2,500/yr for support and updates.", url: "https://buy.stripe.com/cNidR9fPw0vj3jx83TdZ60y" },
    { id: "founding_monthly", name: "Founding shop, monthly", price: "$300/mo", note: "For our first shops. Email and we send the checkout link." },
    { id: "founding_own", name: "Founding shop, buy to own", price: "$9,999", note: "For our first shops. Email and we send the checkout link." },
  ],
  estimating: [
    { id: "monthly", name: "Monthly", price: "$295/mo", note: "License key, billed monthly.", url: "https://buy.stripe.com/5kQfZh0UC0vj9HVfwldZ60z" },
    { id: "yearly", name: "Yearly", price: "$2,950/yr", note: "Prepaid for the year.", url: "https://buy.stripe.com/6oUfZhgTA5PD7zN97XdZ60A" },
    { id: "own", name: "Buy to own", price: "$8,995", note: "One payment, yours to keep.", url: "https://buy.stripe.com/00w9AT46O3Hv9HV0BrdZ60B" },
  ],
  extract: [
    { id: "monthly", name: "Monthly", price: "$149/mo", note: "License key, billed monthly.", url: "https://buy.stripe.com/9B600jdHo4LzcU72JzdZ60C" },
    { id: "yearly", name: "Yearly", price: "$1,490/yr", note: "Prepaid for the year.", url: "https://buy.stripe.com/14A8wP8n46THcU7ck9dZ60D" },
    { id: "own", name: "Buy to own", price: "$3,995", note: "One payment, yours to keep.", url: "https://buy.stripe.com/cNieVddHo4Lz8DR97XdZ60E" },
  ],
  organizer: [
    { id: "monthly", name: "Monthly", price: "$49/mo", note: "License key, billed monthly.", url: "https://buy.stripe.com/28E8wP1YG6TH2ft3NDdZ60F" },
    { id: "yearly", name: "Yearly", price: "$490/yr", note: "Prepaid for the year.", url: "https://buy.stripe.com/cNifZh7j00vjf2f2JzdZ60G" },
    { id: "own", name: "Buy to own", price: "$1,495", note: "One payment, yours to keep.", url: "https://buy.stripe.com/28E9AT5aSfqd6vJ2JzdZ60H" },
  ],
};
const dlg = document.getElementById("picker") as HTMLDialogElement;
function open(prog: string) {
  const plans = PLANS[prog] || [];
  document.getElementById("picker-t")!.textContent = NAMES[prog];
  document.getElementById("picker-sub")!.textContent = plans.length ? "Pick a plan. Checkout is a secure Stripe page. Your license key comes by email." : "Pricing for this program is set per shop.";
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
