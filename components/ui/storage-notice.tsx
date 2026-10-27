"use client";

import { useCanSave } from "@/lib/storage";
import { Notice } from "./notice";

export function StorageNotice() {
  const canSave = useCanSave();
  if (canSave) return null;
  return (
    <div className="mx-auto max-w-[62rem] px-5 pt-4">
      <Notice tone="warning">
        This browser isn&apos;t saving right now, so your words will be gone when you close the tab.
        Private browsing or a full disk can cause this.
      </Notice>
    </div>
  );
}
