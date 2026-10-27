"use client";

import { LinkButton } from "@/components/ui/button";
import { positionHref, useSaved } from "@/lib/storage";
import { arriveAt } from "./reading-position";

/** "Continue" at the top of Contents, from the saved reading position. */
export function ContinueReading() {
  const saved = useSaved();
  if (!saved) return <div className="h-11" />;
  const p = saved.position;
  if (!p) {
    return <LinkButton href="/read/1">Start with Chapter 1</LinkButton>;
  }
  return (
    <LinkButton href={positionHref(p)} onClick={() => arriveAt(p)}>
      Continue: Chapter {p.chapter}, paragraph {p.paragraph + 1} <span aria-hidden="true">→</span>
    </LinkButton>
  );
}

/** Marks the chapter the reader is in. */
export function HereBadge({ chapter }: { chapter: number }) {
  const saved = useSaved();
  if (saved?.position?.chapter !== chapter) return null;
  return (
    <span className="shrink-0 rounded-full bg-saved px-2 py-0.5 font-sans text-xs font-semibold text-ink">
      You&apos;re here
    </span>
  );
}
