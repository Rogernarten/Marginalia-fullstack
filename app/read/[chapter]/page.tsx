import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Reader } from "@/components/reader/reader";
import { TextLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getChapter } from "@/lib/book";
import { CHAPTER_COUNT, isChapter } from "@/lib/chapters";
import { getNotes } from "@/lib/notes";

export function generateStaticParams() {
  return Array.from({ length: CHAPTER_COUNT }, (_, i) => ({ chapter: String(i + 1) }));
}

export async function generateMetadata({ params }: PageProps<"/read/[chapter]">): Promise<Metadata> {
  const { chapter } = await params;
  const n = Number(chapter);
  return { title: isChapter(n) && String(n) === chapter ? `Chapter ${n}` : "Chapter not found" };
}

// The chapter is read inside Suspense so navigating between chapters never blocks on params.
export default function ChapterPage({ params }: PageProps<"/read/[chapter]">) {
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-8 lg:py-12">
      <Suspense fallback={<Skeleton lines={14} className="max-w-[38rem]" />}>
        <Chapter params={params} />
      </Suspense>
    </div>
  );
}

async function Chapter({ params }: { params: PageProps<"/read/[chapter]">["params"] }) {
  const { chapter } = await params;
  const n = Number(chapter);
  if (!isChapter(n) || String(n) !== chapter) notFound();

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-6 font-sans text-sm">
        <ol className="flex items-center gap-2 text-muted">
          <li>
            <TextLink href="/read">Contents</TextLink>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page">Chapter {n}</li>
        </ol>
      </nav>
      <Reader
        key={n}
        chapter={n}
        paragraphs={getChapter(n)}
        notes={getNotes(n)}
        resumable
      />
    </>
  );
}
