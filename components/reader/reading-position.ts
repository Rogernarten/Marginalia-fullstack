import { useEffect } from "react";
import { addReadingSeconds, setPosition } from "@/lib/storage";

// Next.js keeps pages you've left in the DOM, hidden (React <Activity>), so the same chapter or
// paragraph ids can exist twice. Only ever look inside the visible chapter.
function visibleParagraphs(chapter: number) {
  return [...document.querySelectorAll<HTMLElement>(`[data-chapter="${chapter}"] [data-paragraph]`)].filter((el) =>
    el.checkVisibility(),
  );
}

/** Scroll to a paragraph, flash it, and move keyboard focus there. */
export function jumpTo(chapter: number, paragraph: number) {
  const el = visibleParagraphs(chapter).find((p) => Number(p.dataset.paragraph) === paragraph);
  if (!el) return;
  el.setAttribute("tabindex", "-1");
  el.scrollIntoView({ block: "start" });
  el.focus({ preventScroll: true });
  el.classList.remove("resume-flash");
  void el.offsetWidth; // restart the animation if it's already running
  el.classList.add("resume-flash");
}

// Set by Continue links on click. On a client navigation the new chapter renders before the
// URL (and its #p-N) updates, so the hash alone can't tell it to jump.
let arriving: { chapter: number; paragraph: number } | null = null;

export function arriveAt(position: { chapter: number; paragraph: number }) {
  arriving = { chapter: position.chapter, paragraph: position.paragraph };
}

/** The paragraph this visit should open at: from a Continue link, or #p-N in the URL. */
export function arrivalTarget(chapter: number) {
  if (arriving?.chapter === chapter) return arriving.paragraph;
  const match = /^#p-(\d+)$/.exec(window.location.hash);
  return match ? Number(match[1]) : null;
}

/** The first paragraph still on screen, i.e. the one being read. */
function topParagraph(chapter: number) {
  const el = visibleParagraphs(chapter).find((p) => p.getBoundingClientRect().bottom > 80);
  return el ? Number(el.dataset.paragraph) : null;
}

/**
 * Remembers where the reader is: after they stop scrolling, or after ten seconds on the page
 * if they read without scrolling. Opening a chapter with #p-N jumps to that paragraph.
 */
export function useReadingPosition(chapter: number) {
  useEffect(() => {
    const target = arrivalTarget(chapter);
    arriving = null;
    if (target !== null) jumpTo(chapter, target);

    let settle: number | undefined;
    const record = () => {
      const paragraph = topParagraph(chapter);
      if (paragraph !== null) setPosition(chapter, paragraph);
    };
    const onScroll = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(record, 600);
    };
    const firstLook = window.setTimeout(record, 10_000);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(settle);
      window.clearTimeout(firstLook);
    };
  }, [chapter]);
}

const TICK = 15_000;
const IDLE = 90_000;

/**
 * Counts reading time toward today: every 15 seconds while the tab is visible and the reader
 * has scrolled, tapped or pressed a key in the last 90 seconds.
 */
export function useReadingTimer() {
  useEffect(() => {
    let lastActive = Date.now();
    const active = () => {
      lastActive = Date.now();
    };
    const events = ["scroll", "wheel", "keydown", "pointerdown", "pointermove", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - lastActive < IDLE) addReadingSeconds(TICK / 1000);
    }, TICK);
    return () => {
      events.forEach((e) => window.removeEventListener(e, active));
      window.clearInterval(tick);
    };
  }, []);
}
