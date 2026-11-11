export const WALKTHROUGH_WATCH = "https://www.youtube.com/watch?v=ogIPfYkp-0g";
export const WALKTHROUGH_EMBED = "https://www.youtube.com/embed/ogIPfYkp-0g";

const SECTIONS = "Inbox, Review, Filed, Activity, Settings, and Licence";

export function scrollToWalkthrough() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById("walkthrough")?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
}

export function Walkthrough() {
  return (
    <section id="walkthrough" className="panel walk" aria-labelledby="walkthrough-title">
      <header className="ph">
        <div>
          <h2 id="walkthrough-title">File Processor Demo Lab Walkthrough</h2>
          <p>Inbox, Review, Filed, Activity, Settings, and Licence on sample files.</p>
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
            title="File Processor Demo Lab Walkthrough"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  );
}
