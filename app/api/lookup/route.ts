import { auth } from "@clerk/nextjs/server";
import { lookUp, QUERY_MAX, toTitle } from "@/lib/wikipedia";

// GET /api/lookup?q=curricle → a Wikipedia summary, for signed-in readers only, so this isn't
// an open proxy anyone can use up Wikipedia's patience with.
//
// 200 { status: "found", page } | { status: "ambiguous", title, url } | { status: "not_found" }
// 400 { status: "invalid" }      no query, or longer than QUERY_MAX
// 401 { status: "signed_out" }
// 503 { status: "unavailable" }  Wikipedia timed out, errored or couldn't be reached
export async function GET(request: Request) {
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) return json({ status: "signed_out" }, 401);

  const title = toTitle(new URL(request.url).searchParams.get("q") ?? "");
  if (!title) return json({ status: "invalid", max: QUERY_MAX }, 400);

  const result = await lookUp(title);
  return json(result, result.status === "unavailable" ? 503 : 200);
}

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}
