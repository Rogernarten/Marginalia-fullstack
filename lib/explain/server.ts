import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { cacheLife } from "next/cache";
import { chapterFile, isChapter } from "@/lib/chapters";
import { findPhrase } from "@/lib/text";
import { lookUp, toTitle } from "@/lib/wikipedia";
import { explain, type Explanation, type Passage } from "./core";
import { SELECTION_MAX } from "./shared";

// The app's side of lib/explain/core.ts: checks what the browser sent against the book, and
// caches each explanation for every reader, so the same selection in the same paragraph
// calls the model once.

/** Chosen by the evals (evals/runs): the cheapest model that passed. */
export const EXPLAIN_MODEL = "claude-haiku-5-5";
export { SELECTION_MAX };
// Part of the cache key: bump it when the prompt or the model changes.
const VERSION = "2026-11-17";

export type ExplainResult =
  | { status: "explained"; passage: Passage; explanation: Explanation }
  /** The model declined, or gave no usable answer. */
  | { status: "not_explained" }
  /** The Claude API failed or timed out. Never cached. */
  | { status: "unavailable" };

/**
 * The passage the reader means, or null if it isn't in the book: a real chapter and
 * paragraph, and a selection found in that paragraph, as the book spells it.
 */
export async function toPassage(input: unknown): Promise<Passage | null> {
  const { chapter, paragraph, selection } = (input ?? {}) as Record<string, unknown>;
  if (typeof chapter !== "number" || !isChapter(chapter)) return null;
  if (typeof paragraph !== "number" || !Number.isInteger(paragraph) || paragraph < 0) return null;
  if (typeof selection !== "string") return null;
  const text = selection.replace(/\s+/g, " ").trim();
  if (!text || text.length > SELECTION_MAX) return null;

  const paragraphs = await readChapter(chapter);
  if (paragraph >= paragraphs.length) return null;
  const found = findPhrase([paragraphs[paragraph]], text);
  if (!found) return null;
  return { chapter, paragraph, selection: found.match, sentence: found.sentence };
}

export async function explainPassage(passage: Passage): Promise<ExplainResult> {
  try {
    return { status: "explained", passage, explanation: await cached(VERSION, passage) };
  } catch (e) {
    const message = (e as Error).message ?? "";
    if (message.startsWith(NOT_EXPLAINED)) return { status: "not_explained" };
    console.warn(`[explain] ${passage.chapter}:${passage.paragraph} "${passage.selection}": ${message}`);
    return { status: "unavailable" };
  }
}

const NOT_EXPLAINED = "not_explained";
// One shared client. The browser waits 30 seconds; this leaves room for a lookup or two.
const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });

// Failures throw, so they're never kept.
async function cached(version: string, passage: Passage): Promise<Explanation> {
  "use cache: remote";
  cacheLife("weeks");
  void version;

  const result = await explain(passage, {
    client,
    model: EXPLAIN_MODEL,
    chapter: readChapter,
    wikipedia: (title) => {
      const t = toTitle(title);
      return t ? lookUp(t) : Promise.resolve({ status: "not_found" as const });
    },
  });
  // Shows in Vercel's logs: what each new explanation cost and how long it took.
  const t = result.trace;
  console.info(
    JSON.stringify({
      event: "explain",
      status: result.status,
      chapter: passage.chapter,
      paragraph: passage.paragraph,
      selection: passage.selection,
      model: t.model,
      requests: t.requests,
      inputTokens: t.inputTokens,
      outputTokens: t.outputTokens,
      tools: t.tools.map((x) => x.name),
      ms: t.ms,
    }),
  );
  if (result.status !== "explained") throw new Error(`${NOT_EXPLAINED}: ${result.reason}`);
  return result.explanation;
}

// The book ships in public/book; next.config.ts traces it into this route's function.
async function readChapter(n: number): Promise<string[]> {
  const file = path.join(process.cwd(), "public", "book", chapterFile(n));
  return JSON.parse(await fs.readFile(file, "utf8"));
}
