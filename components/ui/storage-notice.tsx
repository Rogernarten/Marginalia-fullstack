"use client";

import { reload, useSyncStatus } from "@/lib/storage";
import { Button } from "./button";
import { Notice } from "./notice";

/** Says so when the notebook couldn't be opened, or a change didn't save. */
export function StorageNotice() {
  const status = useSyncStatus();
  if (status === "ok") return null;
  return (
    <div className="mx-auto max-w-[62rem] px-5 pt-4">
      <Notice tone="warning" className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {status === "load_failed"
            ? "We couldn’t open your notebook. Check your connection, then try again."
            : "Your last change didn’t save, so the notebook is showing what’s saved. Check your connection and try again."}
        </span>
        {status === "load_failed" && (
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        )}
      </Notice>
    </div>
  );
}
