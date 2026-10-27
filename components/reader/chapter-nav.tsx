import { LinkButton } from "@/components/ui/button";
import { CHAPTER_COUNT } from "@/lib/chapters";

export function ChapterNav({ chapter }: { chapter: number }) {
  return (
    <nav aria-label="Chapters" className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6">
      {chapter > 1 ? (
        <LinkButton variant="secondary" href={`/read/${chapter - 1}`}>
          <span aria-hidden="true">←</span> Chapter {chapter - 1}
        </LinkButton>
      ) : (
        <span />
      )}
      {chapter < CHAPTER_COUNT ? (
        <LinkButton href={`/read/${chapter + 1}`} className="ml-auto">
          Keep reading: Chapter {chapter + 1} <span aria-hidden="true">→</span>
        </LinkButton>
      ) : (
        <p className="font-serif text-lg italic">The end.</p>
      )}
    </nav>
  );
}
