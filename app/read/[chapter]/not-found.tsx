import { LinkButton } from "@/components/ui/button";

export default function ChapterNotFound() {
  return (
    <div className="mx-auto max-w-[38rem] px-5 py-16">
      <h1 className="font-serif text-3xl">We can&apos;t find that chapter.</h1>
      <p className="mt-3 text-[1.0625rem] text-muted">Pride and Prejudice has 61 chapters.</p>
      <LinkButton href="/read" className="mt-6">
        Go to Contents
      </LinkButton>
    </div>
  );
}
