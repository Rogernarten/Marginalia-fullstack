"use client";

import { useState } from "react";
import { ExternalLink } from "@/components/ui/button";
import { cx, FOCUS } from "@/components/ui/cx";
import type { WikiPage } from "@/lib/wikipedia";

/** A Wikipedia summary: one line first, the paragraph under "More", and where it's from. */
export function WikiSummary({ page, id }: { page: WikiPage; id: string }) {
  const [more, setMore] = useState(false);
  return (
    <div>
      {page.description && <p className="font-serif text-lg leading-relaxed">{page.description}</p>}
      <button
        type="button"
        aria-expanded={more}
        aria-controls={`${id}-more`}
        onClick={() => setMore(!more)}
        className={cx("mt-1 -ml-1 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md px-1 text-[0.9375rem] font-medium underline decoration-edge underline-offset-4 hover:decoration-ink", FOCUS)}
      >
        {more ? "Less" : "More"}
        <svg aria-hidden="true" viewBox="0 0 12 12" className={cx("size-3 transition-transform", more && "rotate-180")}>
          <path d="M2 4.5 6 8.5 10 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={`${id}-more`} hidden={!more} className="mt-1 border-l-2 border-rule pl-4">
        <p className="font-serif text-base leading-relaxed">{page.extract}</p>
      </div>
      <p className="mt-2 font-sans text-sm text-muted">
        From <ExternalLink href={page.url}>Wikipedia: {page.title}</ExternalLink>
      </p>
    </div>
  );
}
