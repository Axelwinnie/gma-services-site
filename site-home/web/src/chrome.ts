// Shared bits for the header and footer: copy-phone buttons and the mobile menu.
export function wireChrome() {
  document.querySelectorAll<HTMLButtonElement>(".phone-copy").forEach((b) => {
    b.addEventListener("click", () => {
      const v = b.dataset.copy || "", label = b.textContent;
      const done = () => { b.textContent = "Copied"; window.setTimeout(() => { b.textContent = label; }, 1500); };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(v).then(done, () => {}); 
    });
  });
  const menu = document.querySelector<HTMLDetailsElement>(".nav-menu");
  document.addEventListener("click", (e) => { if (menu?.open && !menu.contains(e.target as Node)) menu.open = false; });
}
