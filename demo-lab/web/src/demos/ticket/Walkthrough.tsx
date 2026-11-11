import { Icon } from "../../shell/ui";

export const WALKTHROUGH_WATCH = "https://www.youtube.com/watch?v=1mgAM7LIPIc";
export const WALKTHROUGH_EMBED = "https://www.youtube.com/embed/1mgAM7LIPIc";

const SECTIONS = "Dashboard, All Tickets, New Ticket, Requisitions, Punchlist, Rental, QA/QC, QA/QC Summary, QA/QC Trends, Templates, Records Hub, Notifications, and Health";

export function scrollToWalkthrough() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("walkthrough")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

export function Walkthrough() {
  return (
    <section id="walkthrough" className="panel walk" aria-labelledby="walkthrough-title">
      <header className="ph">
        <div>
          <h2 id="walkthrough-title">Tool Ticket System Demo Lab Walkthrough</h2>
          <p>Tickets, inspections, requisitions, rentals, and safety records. About 4 minutes, with a voiceover over this live demo.</p>
        </div>
      </header>
      <div className="pb walk-body">
        <div className="walk-copy">
          <p>The walk covers {SECTIONS}. The interactive demo stays on this page while the player runs.</p>
          <p className="walk-fallback">If the player does not load, <a href={WALKTHROUGH_WATCH} target="_blank" rel="noopener noreferrer">watch the walkthrough on YouTube</a>.</p>
        </div>
        <div className="walk-frame">
          <iframe
            src={WALKTHROUGH_EMBED}
            title="Tool Ticket System Demo Lab Walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}

export function WatchWalkthrough({ className = "btn" }: { className?: string }) {
  return (
    <a className={className} href="#walkthrough" onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      scrollToWalkthrough();
    }}>
      <Icon n="play" />Watch walkthrough
    </a>
  );
}
