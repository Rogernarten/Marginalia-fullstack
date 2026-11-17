"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SELECTION_MAX } from "@/lib/explain/shared";
import { selectionIn } from "./selection";

/** Opens Explain in the margin with whatever is selected in the text: a word or a line. */
export function ExplainButton({
  chapter,
  onExplain,
}: {
  chapter: number;
  onExplain: (selection: { text: string; paragraph: number | null }, el: HTMLElement) => void;
}) {
  const selected = useRef<{ text: string; paragraph: number | null }>({ text: "", paragraph: null });

  return (
    <Button
      onPointerDown={() => {
        selected.current = selectionIn(chapter, SELECTION_MAX);
      }}
      onClick={(e) => {
        if (e.detail === 0) selected.current = selectionIn(chapter, SELECTION_MAX); // keyboard activation
        onExplain(selected.current, e.currentTarget);
      }}
    >
      Explain
    </Button>
  );
}
