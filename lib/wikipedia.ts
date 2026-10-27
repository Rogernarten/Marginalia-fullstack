import "server-only";
import { cacheLife } from "next/cache";

// Wikipedia's REST summary, called from our server only (app/api/lookup). Shared by every
// reader: a word looked up once is cached for a day, so Wikipedia sees one request, not one
// per reader. Inside the cache, failures throw so they're never kept; lookUp() turns them into
// "unavailable".

export type WikiPage = {
  pageId: number;
  /** The article actually shown, which can differ from what was asked (entail → "Fee tail"). */
  title: string;
  /** One line, shown first. Some articles have none. */
  description: string | null;
  /** Plain-text first paragraph, shown under "More". */
  extract: string;
  /** The article on Wikipedia, linked for attribution. */
  url: string;
};

export type Lookup =
  | { status: "found"; page: WikiPage }
  /** A disambiguation page ("Bath may refer to…"): not an answer. */
  | { status: "ambiguous"; title: string; url: string }
  | { status: "not_found" }
  /** Timed out, errored or unreachable. Never cached, so the next try asks again. */
  | { status: "unavailable" };

export const QUERY_MAX = 80;

const ENDPOINT = "https://en.wikipedia.org/api/rest_v1/page/summary/";
// Wikimedia asks every client to say who it is and how to reach whoever runs it.
const USER_AGENT =
  "Marginalia/1.0 (https://github.com/Rogernarten/Marginalia-fullstack; Design, Build, Ship class project, University of Chicago)";
const TIMEOUT_MS = 5000;

/** "pin  money" → "pin_money". Returns null for empty or overlong input. */
export function toTitle(query: string) {
  const title = query.replace(/[\s_]+/g, " ").trim();
  if (!title || title.length > QUERY_MAX) return null;
  return title.replace(/ /g, "_");
}

type Summary = {
  type?: string;
  title?: string;
  pageid?: number;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};

export async function lookUp(title: string): Promise<Lookup> {
  try {
    return await summary(title);
  } catch (e) {
    console.warn(`[wikipedia] ${title}: ${(e as Error).message}`);
    return { status: "unavailable" };
  }
}

async function summary(title: string): Promise<Exclude<Lookup, { status: "unavailable" }>> {
  "use cache";
  cacheLife("days");

  let res: Response;
  try {
    res = await fetch(ENDPOINT + encodeURIComponent(title), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new Error(`Wikipedia didn't answer: ${(e as Error).name}`);
  }
  if (res.status === 404) return { status: "not_found" };
  if (!res.ok) throw new Error(`Wikipedia answered ${res.status}`);

  let body: Summary;
  try {
    body = await res.json();
  } catch {
    throw new Error("Wikipedia sent something that isn't JSON");
  }
  const url = body.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  if (body.type === "disambiguation") return { status: "ambiguous", title: body.title ?? title, url };
  // "no-extract" and anything else without text isn't useful in the margin.
  if (body.type !== "standard" || !body.extract?.trim() || !body.pageid) return { status: "not_found" };

  return {
    status: "found",
    page: {
      pageId: body.pageid,
      title: body.title ?? title.replace(/_/g, " "),
      description: body.description?.trim() || null,
      extract: body.extract.trim(),
      url,
    },
  };
}
