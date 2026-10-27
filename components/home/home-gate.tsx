"use client";

import { useState } from "react";
import { Reader } from "@/components/reader/reader";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeBack } from "./welcome-back";
import type { Note } from "@/lib/notes/types";
import { hasHistory, useSaved } from "@/lib/storage";

type Mode = "first" | "returning";

/**
 * Decides once, on load, whether this is a first visit. It doesn't change afterwards, so saving
 * a word while reading Chapter 1 here doesn't swap the page out from under the reader.
 */
export function HomeGate({ paragraphs, notes }: { paragraphs: string[]; notes: Note[] }) {
  const saved = useSaved();
  const [mode, setMode] = useState<Mode | null>(null);
  if (saved && mode === null) setMode(hasHistory(saved) ? "returning" : "first");

  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      {mode === null ? (
        <div className="max-w-[38rem]">
          <Skeleton lines={2} className="mb-10" />
          <Skeleton lines={12} />
        </div>
      ) : mode === "returning" && saved ? (
        <WelcomeBack saved={saved} />
      ) : (
        <>
          <header className="mb-10 max-w-[38rem]">
            <p className="eyebrow">Pride and Prejudice · Jane Austen · 1813</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight lg:text-4xl">Read it with a guide in the margin.</h1>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-muted">
              Tap an underlined word to see what it meant in 1813, and save the ones you want to keep.
              It all stays on this device. No account needed.
            </p>
          </header>
          <Reader
            chapter={1}
            paragraphs={paragraphs}
            notes={notes}
            headingLevel={2}
          />
        </>
      )}
    </div>
  );
}
