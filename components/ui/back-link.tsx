import Link from "next/link";
import { cx, FOCUS } from "./cx";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cx("inline-flex min-h-11 items-center gap-2 rounded-md font-sans text-sm underline decoration-edge underline-offset-4 hover:decoration-ink", FOCUS)}
    >
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}
