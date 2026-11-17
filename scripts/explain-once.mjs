// Explain one selection from the terminal, with the same code the app uses.
//
//   npm run explain -- 1 "in want of"
//   npm run explain -- 1 "in want of" --model claude-sonnet-5-5
//
// Needs ANTHROPIC_API_KEY in .env.local. Finds the first place the selection appears in the
// chapter, the way the reader does.
import fs from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { explain } from "../lib/explain/core.ts";
import { findPhrase } from "../lib/text.ts";
import { fetchSummary, toTitle } from "../lib/wikipedia-fetch.ts";

const args = process.argv.slice(2);
const modelAt = args.indexOf("--model");
const model = modelAt >= 0 ? args.splice(modelAt, 2)[1] : "claude-haiku-5-5";
const [chapterArg, selection] = args;
const chapterNo = Number(chapterArg);
if (!Number.isInteger(chapterNo) || !selection) {
  console.error('Usage: npm run explain -- <chapter> "<selection>" [--model <id>]');
  process.exit(2);
}

const chapter = async (n) =>
  JSON.parse(fs.readFileSync(new URL(`../public/book/${String(n).padStart(2, "0")}.json`, import.meta.url), "utf8"));
const wikipedia = async (title) => {
  const t = toTitle(title);
  if (!t) return { status: "not_found" };
  try {
    return await fetchSummary(t);
  } catch {
    return { status: "unavailable" };
  }
};

const found = findPhrase(await chapter(chapterNo), selection);
if (!found) {
  console.error(`"${selection}" isn't in Chapter ${chapterNo}.`);
  process.exit(1);
}

const passage = { chapter: chapterNo, paragraph: found.paragraph, selection: found.match, sentence: found.sentence };
const result = await explain(passage, { client: new Anthropic(), model, chapter, wikipedia });
console.log(JSON.stringify({ passage, ...result }, null, 2));
