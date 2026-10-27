import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { NotebookList } from "@/components/notebook/notebook-list";

export const metadata: Metadata = { title: "Notebook" };

export default async function NotebookPage() {
  await auth.protect();
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      <NotebookList />
    </div>
  );
}
