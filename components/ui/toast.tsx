"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { cx } from "./cx";

// One message at a time, shown at the bottom of every page (rendered once in the layout).
// It survives navigation, so a form can confirm a save on the page it sends you to.

type Toast = { id: number; message: string; action?: { label: string; href: string } };

let current: Toast | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(toast: Omit<Toast, "id">) {
  current = { ...toast, id: Date.now() };
  emit();
}

export function dismissToast() {
  current = null;
  emit();
}

const LIGHT_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface";

export function Toaster() {
  const toast = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
  const [paused, setPaused] = useState(false);

  // Leaves after 8 seconds, but never while the pointer or focus is on it.
  useEffect(() => {
    if (!toast || paused) return;
    const timer = window.setTimeout(dismissToast, 8000);
    return () => window.clearTimeout(timer);
  }, [toast, paused]);

  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      {toast && (
        <div
          className="pointer-events-auto flex max-w-[36rem] flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-ink py-2 pr-2 pl-4 font-sans text-[0.9375rem] text-surface shadow-lg"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span className="py-1.5">{toast.message}</span>
          {toast.action && (
            <Link
              href={toast.action.href}
              onClick={dismissToast}
              className={cx("rounded-sm py-1.5 font-semibold text-saved underline underline-offset-4", LIGHT_FOCUS)}
            >
              {toast.action.label}
            </Link>
          )}
          <button
            type="button"
            onClick={dismissToast}
            aria-label="Dismiss"
            className={cx("flex size-9 cursor-pointer items-center justify-center rounded-md text-xl leading-none", LIGHT_FOCUS)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
    </div>
  );
}
