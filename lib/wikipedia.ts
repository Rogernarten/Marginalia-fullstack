import "server-only";
import { cacheLife } from "next/cache";
import { fetchSummary, type Lookup } from "./wikipedia-fetch";

// Wikipedia's REST summary, called from our server only (app/api/lookup, app/api/explain).
// Shared by every reader: a word looked up once is cached for a day, so Wikipedia sees one
// request, not one per reader. Inside the cache, failures throw so they're never kept;
// lookUp() turns them into "unavailable". The fetch itself is in lib/wikipedia-fetch.ts.

export type { Lookup, WikiPage } from "./wikipedia-fetch";
export { QUERY_MAX, toTitle } from "./wikipedia-fetch";

export async function lookUp(title: string): Promise<Lookup> {
  try {
    return await summary(title);
  } catch (e) {
    console.warn(`[wikipedia] ${title}: ${(e as Error).message}`);
    return { status: "unavailable" };
  }
}

async function summary(title: string) {
  "use cache";
  cacheLife("days");
  return fetchSummary(title);
}
