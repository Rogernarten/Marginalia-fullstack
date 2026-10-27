"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { LinkButton } from "@/components/ui/button";
import { selectionIn } from "./selection";

/**
 * Opens the save-a-word form for this chapter. If the reader has selected a word in the text
 * first, it's filled in. The selection is read on pointer down, before the click clears it.
 */
export function AddWordButton({ chapter }: { chapter: number }) {
  const router = useRouter();
  const selected = useRef("");
  const base = `/notebook/new?chapter=${chapter}`;

  function grabSelection() {
    selected.current = selectionIn(chapter).text;
  }

  return (
    <LinkButton
      variant="secondary"
      href={base}
      onPointerDown={grabSelection}
      onClick={(e) => {
        if (e.detail === 0) grabSelection(); // keyboard activation
        if (!selected.current) return;
        e.preventDefault();
        router.push(`${base}&word=${encodeURIComponent(selected.current)}`);
      }}
    >
      + Add a word
    </LinkButton>
  );
}
