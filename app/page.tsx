import { HomeGate } from "@/components/home/home-gate";
import { getChapter } from "@/lib/book";
import { getNotes } from "@/lib/notes";

export default function Home() {
  return <HomeGate paragraphs={getChapter(1)} notes={getNotes(1)} />;
}
