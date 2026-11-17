import { auth } from "@clerk/nextjs/server";
import { explainPassage, SELECTION_MAX, toPassage } from "@/lib/explain/server";

// POST /api/explain { chapter, paragraph, selection } → what the selection means in its
// sentence, from the model (lib/explain). For signed-in readers only, so it isn't an open
// door to the Claude API; the selection must be in the book, so it can't be used as a chatbot.
//
// 200 { status: "explained", passage, explanation } | { status: "not_explained" }
// 400 { status: "invalid" }      not JSON, or the selection isn't in that paragraph
// 401 { status: "signed_out" }
// 503 { status: "unavailable" }  the Claude API failed or timed out
export async function POST(request: Request) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return json({ status: "signed_out" }, 401);

  const passage = await toPassage(await request.json().catch(() => null));
  if (!passage) return json({ status: "invalid", max: SELECTION_MAX }, 400);

  const result = await explainPassage(passage);
  return json(result, result.status === "unavailable" ? 503 : 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
