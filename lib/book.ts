import fs from "node:fs";
import path from "node:path";
import { chapterFile } from "./chapters";

// Server-only: reads public/book/NN.json during prerender. Clients fetch /book/NN.json instead.
export function getChapter(n: number): string[] {
  const file = path.join(process.cwd(), "public", "book", chapterFile(n));
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
