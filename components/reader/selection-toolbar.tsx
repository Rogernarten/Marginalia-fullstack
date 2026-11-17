"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SELECTION_MAX } from "@/lib/explain/shared";

// Wiki lookup (a Wikipedia title) and Save (the add-word form) take a word or a short phrase;
// AI explain takes up to a line.
const SHORT_MAX = 60;
const GAP = 8;
// Half the toolbar's widest width, to keep it on screen.
const HALF_WIDTH = 150;
const HEIGHT = 54;

type Picked = { text: string; paragraph: number; key: string; top: number; left: number; above: boolean };
type Selected = { text: string; paragraph: number | null };

/**
 * A small toolbar next to what the reader selects in the chapter: AI explain, Wiki lookup, Save.
 * The labels say where each answer comes from, so a model's note isn't mistaken for a source.
 * It sits above the selection, or below it on touch screens, where the phone's own menu sits
 * above. Pressing a button keeps the selection (pointer down is cancelled), so the words stay
 * highlighted while the margin explains them. Only inside one paragraph of this chapter.
 */
export function SelectionToolbar({
  chapter,
  onExplain,
  onLookUp,
}: {
  chapter: number;
  onExplain: (selection: Selected, el: HTMLElement) => void;
  onLookUp: (selection: Selected, el: HTMLElement) => void;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked | null>(null);
  // The selection the reader already acted on or dismissed: don't offer it again.
  const dismissed = useRef<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Clicking away clears the selection: the same words can be offered again later.
        if (window.getSelection()?.isCollapsed ?? true) dismissed.current = null;
        setPicked(read(chapter, dismissed.current));
      });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPicked((p) => {
        if (p) dismissed.current = p.key;
        return null;
      });
    };
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("keydown", onKey);
    };
  }, [chapter]);

  if (!picked) return null;
  const short = picked.text.length <= SHORT_MAX;
  const selection = { text: picked.text, paragraph: picked.paragraph };

  function act(run: (paragraphEl: HTMLElement) => void) {
    if (!picked) return;
    dismissed.current = picked.key;
    setPicked(null);
    // Focus comes back to the paragraph when the margin closes.
    const p = [...document.querySelectorAll<HTMLElement>(`[data-chapter="${chapter}"] [data-paragraph="${picked.paragraph}"]`)].find(
      (el) => el.checkVisibility(),
    );
    if (p) p.setAttribute("tabindex", "-1");
    run(p ?? document.body);
  }

  return (
    <div
      role="toolbar"
      aria-label={`Selected: “${picked.text.length > 60 ? picked.text.slice(0, 59) + "…" : picked.text}”`}
      onPointerDown={(e) => e.preventDefault()}
      className={`fixed z-30 flex -translate-x-1/2 gap-1 rounded-lg border border-edge bg-surface p-1 font-sans shadow-lg ${picked.above ? "-translate-y-full" : ""}`}
      style={{ top: picked.top, left: picked.left }}
    >
      <Button onClick={() => act((el) => onExplain(selection, el))}>AI explain</Button>
      {short && (
        <Button variant="secondary" onClick={() => act((el) => onLookUp(selection, el))}>
          Wiki lookup
        </Button>
      )}
      {short && (
        <Button
          variant="quiet"
          onClick={() => act(() => router.push(`/notebook/new?chapter=${chapter}&word=${encodeURIComponent(picked.text)}`))}
        >
          Save
        </Button>
      )}
    </div>
  );
}

/** The current selection, if it's in one visible paragraph of this chapter, and where to show the toolbar. */
function read(chapter: number, dismissed: string | null): Picked | null {
  const s = window.getSelection();
  if (!s || s.isCollapsed || s.rangeCount === 0) return null;
  const text = s.toString().replace(/\s+/g, " ").trim();
  if (!text || text.length > SELECTION_MAX) return null;

  const start = s.anchorNode?.parentElement;
  const end = s.focusNode?.parentElement;
  const root = start?.closest<HTMLElement>(`[data-chapter="${chapter}"]`);
  // Next.js keeps hidden copies of pages; only the visible chapter counts.
  if (!root || !root.checkVisibility()) return null;
  const p = start?.closest("[data-paragraph]");
  if (!p || p !== end?.closest("[data-paragraph]")) return null;
  const paragraph = Number(p.getAttribute("data-paragraph"));
  const key = `${paragraph}:${text}`;
  if (key === dismissed) return null;

  const rects = s.getRangeAt(0).getClientRects();
  const first = rects[0];
  const last = rects[rects.length - 1];
  if (!first || !last) return null;
  // Above the first line; below the last on touch screens, or when there's no room above.
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const above = !coarse && first.top - GAP - HEIGHT > 0;
  const anchor = above ? first : last;
  const center = anchor.left + anchor.width / 2;
  const left = Math.min(Math.max(center, HALF_WIDTH + GAP), window.innerWidth - HALF_WIDTH - GAP);
  return { text, paragraph, key, left, above, top: above ? first.top - GAP : last.bottom + GAP };
}
