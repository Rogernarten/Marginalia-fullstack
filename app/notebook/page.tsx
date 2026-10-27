import type { Metadata } from "next";
import { NotebookList } from "@/components/notebook/notebook-list";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage() {
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      <NotebookList />
    </div>
  );
}
