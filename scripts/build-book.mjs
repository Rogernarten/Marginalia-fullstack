// One-off: turn Project Gutenberg #1342 (Pride and Prejudice) into public/book/NN.json.
// Usage: curl -sSL -o /tmp/pg1342.txt https://www.gutenberg.org/cache/epub/1342/pg1342.txt
//        node scripts/build-book.mjs /tmp/pg1342.txt
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Pass the path to pg1342.txt");

const lines = readFileSync(source, "utf8").replace(/\r\n/g, "\n").split("\n");
const start = lines.findIndex((l) => l.trim() === "Chapter I.]") + 1;
const end = lines.findLastIndex((l) => l.includes("CHISWICK PRESS"));
if (start <= 0 || end <= start) throw new Error("Couldn't find the start or end of the text");

// Drop [Illustration ...] captions, which can span lines and nest brackets.
const body = [];
let depth = 0;
for (const line of lines.slice(start, end)) {
  if (depth === 0 && !line.trimStart().startsWith("[Illustration")) {
    body.push(line);
    continue;
  }
  for (const ch of line) depth += ch === "[" ? 1 : ch === "]" ? -1 : 0;
}

const chapters = [[]];
let paragraph = [];
const flush = () => {
  if (!paragraph.length) return;
  const text = paragraph
    .join(" ")
    .replace(/^\/\*\s*(?:NIND|RIGHT)?\s*|\s*\*\/$/g, "") // letter typesetting: /* NIND ... */
    .replace(/\s+/g, " ")
    .trim();
  const current = chapters.at(-1);
  // An illustration can interrupt a sentence; the rest then starts in lowercase.
  if (/^[a-z]/.test(text) && current.length) current[current.length - 1] += ` ${text}`;
  else current.push(text);
  paragraph = [];
};
for (const line of body) {
  if (/^CHAPTER [IVXLC]+\.?$/i.test(line.trim())) {
    flush();
    chapters.push([]);
  } else if (line.trim() === "") {
    flush();
  } else {
    paragraph.push(line.trim());
  }
}
flush();

if (chapters.length !== 61) throw new Error(`Expected 61 chapters, got ${chapters.length}`);
const out = join(process.cwd(), "public", "book");
mkdirSync(out, { recursive: true });
chapters.forEach((paragraphs, i) => {
  writeFileSync(join(out, `${String(i + 1).padStart(2, "0")}.json`), JSON.stringify(paragraphs));
});
console.log(`Wrote ${chapters.length} chapters, ${chapters.flat().length} paragraphs`);
