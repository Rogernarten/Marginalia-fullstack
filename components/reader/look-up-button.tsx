"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { selectionIn } from "./selection";

/** Opens the Wikipedia lookup in the margin with whatever is selected in the text. */
export function LookUpButton({
  chapter,
  onLookUp,
}: {
  chapter: number;
  onLookUp: (selection: { text: string; paragraph: number | null }, el: HTMLElement) => void;
}) {
  const selected = useRef<{ text: string; paragraph: number | null }>({ text: "", paragraph: null });

  return (
    <Button
      variant="secondary"
      onPointerDown={() => {
        selected.current = selectionIn(chapter);
      }}
      onClick={(e) => {
        if (e.detail === 0) selected.current = selectionIn(chapter); // keyboard activation
        onLookUp(selected.current, e.currentTarget);
      }}
    >
      Look it up
    </Button>
  );
}
