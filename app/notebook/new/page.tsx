import type { Metadata } from "next";
import { Suspense } from "react";
import { AddWordForm } from "@/components/notebook/add-word-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Save a word" };

export default function NewWordPage() {
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      <div className="max-w-[32rem]">
        {/* The form reads ?word= and ?chapter= from the reader's "+ Add a word". */}
        <Suspense fallback={<Skeleton lines={8} />}>
          <AddWordForm />
        </Suspense>
      </div>
    </div>
  );
}
