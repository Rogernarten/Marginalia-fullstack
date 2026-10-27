import { cx } from "@/components/ui/cx";

/** Explains the underline styles. Shown in the empty margin and above the text on small screens. */
export function Legend({ className }: { className?: string }) {
  return (
    <ul className={cx("space-y-2 font-sans text-sm", className)}>
      <li className="flex items-baseline gap-3">
        <span className="swatch w-16 shrink-0 font-serif text-base" data-kind="context">
          dotted
        </span>
        <span>
          <strong className="font-semibold">Then &amp; now</strong>: history and customs
        </span>
      </li>
      <li className="flex items-baseline gap-3">
        <span className="swatch w-16 shrink-0 font-serif text-base" data-kind="word">
          dashed
        </span>
        <span>
          <strong className="font-semibold">Word</strong>: language notes
        </span>
      </li>
      <li className="flex items-baseline gap-3">
        <span className="swatch w-16 shrink-0 font-serif text-base" data-saved="true">
          shaded
        </span>
        <span>In your notebook</span>
      </li>
    </ul>
  );
}
