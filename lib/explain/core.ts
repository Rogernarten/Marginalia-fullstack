import Anthropic from "@anthropic-ai/sdk";
import type { Lookup } from "../wikipedia-fetch";

// Explain the words a reader selected, as they are used in this sentence. Shared by
// app/api/explain (cached Wikipedia, the book from disk) and the evals in scripts/ (plain
// fetch, run with Node), so it takes everything it needs from the caller and imports nothing
// but types and the SDK.
//
// Spoilers are kept out by construction: the model gets the book only up to the reader's
// paragraph, and is told not to use what it remembers of the rest.

export type Passage = {
  chapter: number;
  /** Index into the chapter's paragraphs. */
  paragraph: number;
  /** What the reader selected, as the book has it. */
  selection: string;
  /** The sentence the selection is in. */
  sentence: string;
};

export type Deps = {
  client: Anthropic;
  model: string;
  /** Chapter n's paragraphs, Gutenberg text with italics as _like this_. */
  chapter: (n: number) => Promise<string[]>;
  /** A Wikipedia summary by human title ("Fee tail"). Never throws. */
  wikipedia: (title: string) => Promise<Lookup>;
};

export type Source =
  | { kind: "sentence" }
  | { kind: "wikipedia"; title: string; url: string }
  | { kind: "book"; chapter: number; paragraph: number };

export type Explanation = {
  /** "word": language; "context": a custom, thing or place. Same split as the hand-written hints. */
  kind: "word" | "context";
  /** One sentence, shown first. */
  meaning: string;
  /** Up to two sentences, shown under "More". Empty when nothing more is needed. */
  background: string;
  /** Only sources the tools really returned; at least the sentence itself. */
  sources: Source[];
};

export type Trace = {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  tools: { name: string; input: string; result: string }[];
  /** Source ids the model cited that no tool returned. Dropped from the answer. */
  droppedSources: string[];
  ms: number;
};

export type ExplainResult =
  | { status: "explained"; explanation: Explanation; trace: Trace }
  /** refused: the model declined. no_answer: it didn't return the JSON asked for. */
  | { status: "failed"; reason: "refused" | "no_answer"; trace: Trace };

const MAX_REQUESTS = 4;
const SEARCH_RESULTS = 5;
const CONTEXT_PARAGRAPHS = 2;

const SYSTEM = `You write short notes in the margin of Pride and Prejudice (1813) for a modern reader. The reader has selected some words they don't understand. Explain what those words mean in this sentence, as Austen used them: the one sense that fits here, not every sense a dictionary lists. If the meaning has changed since 1813, say what it meant then. If the words point to a custom, an institution, a thing or a place of the period, say what it was and why it matters here.

Rules:
- Explain only the selection. Never summarize the chapter or the book, retell the plot, or rewrite the whole sentence in modern English. Explain, don't just translate.
- The reader has read only up to the current paragraph. Never mention, hint at or foreshadow anything that happens after it, even if you remember the novel. Use only the passage and what the tools return.
- If the selection is a phrase or a line, explain the part a modern reader would miss, not just the easiest word in it.
- meaning: ONE sentence of at most 20 words, starting with the sense itself, like a gloss ("Lacking or needing, not desiring.").
- background: at most TWO short sentences, 40 words in all, that help this reader here, or "" if the meaning says enough. Don't repeat the meaning.
- kind: "word" for language (old senses, idioms, grammar); "context" for customs, things, places, money, law.
- sources: the ids of what you relied on. "sentence" is the passage itself. Tools return other ids, like "wikipedia:Fee tail" or "book:1:4". List only ids you were given.
- Use wikipedia_summary for customs, institutions, things, real places and historical people (entail, curricle, Michaelmas, Bath). Not for ordinary words whose sense has changed (want, tolerable, condescension): Wikipedia returns the wrong topic for those.
- Use search_book_so_far when the selection refers back to someone or something earlier in the book, or to see how Austen uses the same word elsewhere.
- Most selections need one tool call or none. Answer as soon as you can.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "wikipedia_summary",
    description:
      "The first paragraph of an English Wikipedia article, by title. For customs, institutions, things, real places and historical people of Austen's time. Returns an id to cite.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { title: { type: "string", description: 'Article title, like "Fee tail" or "Michaelmas".' } },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "search_book_so_far",
    description: `Search Pride and Prejudice from Chapter 1 up to the paragraph before the reader's (you already have that one) for a word, phrase or name, case-insensitive. Never searches ahead. Returns up to ${SEARCH_RESULTS} sentences, the closest to the reader first, each with an id to cite.`,
    strict: true,
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "A word, phrase or name, as it might appear in the text." } },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

const FORMAT: Anthropic.JSONOutputFormat = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["word", "context"] },
      meaning: { type: "string" },
      background: { type: "string" },
      sources: { type: "array", items: { type: "string" } },
    },
    required: ["kind", "meaning", "background", "sources"],
    additionalProperties: false,
  },
};

export async function explain(passage: Passage, deps: Deps): Promise<ExplainResult> {
  const started = Date.now();
  const trace: Trace = { model: deps.model, requests: 0, inputTokens: 0, outputTokens: 0, tools: [], droppedSources: [], ms: 0 };
  const done = <T extends ExplainResult>(result: T) => ((trace.ms = Date.now() - started), result);

  // Every source a tool handed back, by the id the model will cite.
  const known = new Map<string, Source>([["sentence", { kind: "sentence" }]]);
  const run = (block: Anthropic.ToolUseBlock) => runTool(block, passage, deps, known, trace);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: await prompt(passage, deps) }];

  for (let i = 0; i < MAX_REQUESTS; i++) {
    const last = i === MAX_REQUESTS - 1;
    const res = await deps.client.messages.create({
      model: deps.model,
      max_tokens: 4000,
      system: SYSTEM,
      tools: TOOLS,
      // On the last request, no more tools: answer with what you have.
      ...(last ? { tool_choice: { type: "none" as const } } : {}),
      output_config: { effort: "low", format: FORMAT },
      messages,
    });
    trace.requests++;
    trace.inputTokens += res.usage.input_tokens;
    trace.outputTokens += res.usage.output_tokens;

    if (res.stop_reason === "refusal") return done({ status: "failed", reason: "refused", trace });

    if (res.stop_reason === "tool_use") {
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      messages.push({ role: "assistant", content: res.content });
      messages.push({ role: "user", content: await Promise.all(uses.map(run)) });
      continue;
    }

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const explanation = parse(text, known, trace);
    return done(explanation ? { status: "explained", explanation, trace } : { status: "failed", reason: "no_answer", trace });
  }
  return done({ status: "failed", reason: "no_answer", trace });
}

async function prompt(p: Passage, deps: Deps) {
  const paragraphs = await deps.chapter(p.chapter);
  const before = paragraphs
    .slice(Math.max(0, p.paragraph - CONTEXT_PARAGRAPHS), p.paragraph)
    .map((t) => clip(plain(t), 700));
  return [
    `Chapter ${p.chapter}, paragraph ${p.paragraph + 1}. The reader has read up to here.`,
    before.length ? `\nJust before:\n${before.map((t) => `> ${t}`).join("\n")}` : "",
    `\nThe paragraph:\n> ${clip(plain(paragraphs[p.paragraph] ?? ""), 2500)}`,
    `\nThe sentence:\n> ${p.sentence}`,
    `\nThe reader selected: "${p.selection}"`,
  ].join("\n");
}

async function runTool(
  block: Anthropic.ToolUseBlock,
  passage: Passage,
  deps: Deps,
  known: Map<string, Source>,
  trace: Trace,
): Promise<Anthropic.ToolResultBlockParam> {
  const input = (block.input ?? {}) as Record<string, unknown>;
  const reply = (result: string, isError = false): Anthropic.ToolResultBlockParam => {
    trace.tools.push({ name: block.name, input: JSON.stringify(input), result: clip(result, 200) });
    return { type: "tool_result", tool_use_id: block.id, content: result, ...(isError ? { is_error: true } : {}) };
  };

  if (block.name === "wikipedia_summary") {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return reply("Give an article title.", true);
    const found = await deps.wikipedia(title);
    if (found.status === "unavailable") return reply("Wikipedia didn't answer. Explain without it.", true);
    if (found.status === "not_found") return reply(`No Wikipedia article called "${title}".`);
    if (found.status === "ambiguous") return reply(`"${found.title}" has several meanings on Wikipedia; try a more specific title.`);
    const id = `wikipedia:${found.page.title}`;
    known.set(id, { kind: "wikipedia", title: found.page.title, url: found.page.url });
    return reply(JSON.stringify({ id, title: found.page.title, description: found.page.description, extract: found.page.extract }));
  }

  if (block.name === "search_book_so_far") {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query || query.length > 60) return reply("Give a word, phrase or name of at most 60 characters.", true);
    const hits = await searchSoFar(query, passage, deps);
    for (const h of hits) known.set(h.id, { kind: "book", chapter: h.chapter, paragraph: h.paragraph });
    return reply(hits.length ? JSON.stringify(hits) : `"${query}" doesn't appear earlier in the book.`);
  }

  return reply(`There's no tool called ${block.name}.`, true);
}

/**
 * Sentences containing `query`, from the paragraph before the reader's back to Chapter 1.
 * The reader's own paragraph is left out: the model already has it, and its later sentences
 * haven't been read yet.
 */
async function searchSoFar(query: string, p: Passage, deps: Deps) {
  const needle = query.toLowerCase();
  const hits: { id: string; chapter: number; paragraph: number; sentence: string }[] = [];
  for (let c = p.chapter; c >= 1 && hits.length < SEARCH_RESULTS; c--) {
    const paragraphs = await deps.chapter(c);
    const lastParagraph = c === p.chapter ? p.paragraph - 1 : paragraphs.length - 1;
    for (let i = lastParagraph; i >= 0 && hits.length < SEARCH_RESULTS; i--) {
      const text = plain(paragraphs[i]);
      const at = text.toLowerCase().indexOf(needle);
      if (at < 0) continue;
      hits.push({ id: `book:${c}:${i + 1}`, chapter: c, paragraph: i, sentence: clip(sentenceAround(text, at), 400) });
    }
  }
  return hits;
}

function parse(text: string, known: Map<string, Source>, trace: Trace): Explanation | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const r = raw as Partial<Record<"kind" | "meaning" | "background", unknown>> & { sources?: unknown };
  if ((r.kind !== "word" && r.kind !== "context") || typeof r.meaning !== "string" || !r.meaning.trim()) return null;
  const ids = Array.isArray(r.sources) ? r.sources.filter((s): s is string => typeof s === "string") : [];
  // A cited id the tools never returned is dropped, so a source can't be made up.
  const unique = [...new Set(ids)];
  trace.droppedSources = unique.filter((id) => !known.has(id));
  const sources = unique.flatMap((id) => (known.has(id) ? [known.get(id)!] : []));
  return {
    kind: r.kind,
    meaning: r.meaning.trim(),
    background: typeof r.background === "string" ? r.background.trim() : "",
    sources: sources.length ? sources : [{ kind: "sentence" }],
  };
}

function plain(text: string) {
  return text.replace(/_/g, "");
}

function clip(text: string, max: number) {
  return text.length <= max ? text : text.slice(0, max - 1) + "…";
}

const ABBREVIATION = /\b(Mr|Mrs|Dr|St|Col|Capt)$/;

/** The sentence around character `at`: from the . ! or ? before it to the one after, skipping "Mrs." and the like. */
function sentenceAround(text: string, at: number) {
  const ends = (i: number) => /[.!?]/.test(text[i]) && !(text[i] === "." && ABBREVIATION.test(text.slice(0, i)));
  let start = at;
  while (start > 0 && !ends(start - 1)) start--;
  let end = at;
  while (end < text.length - 1 && !ends(end)) end++;
  return text.slice(start, end + 1).replace(/^[\s”’"]+/, "").trim();
}
