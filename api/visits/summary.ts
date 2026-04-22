import { loadVisitSummary } from "../_lib/visitStore.js";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const daysParam = Number(url.searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 30) : 7;
    const summary = await loadVisitSummary(days);
    return json(summary);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to load visit summary";
    return json({ error: message }, { status: 500 });
  }
}
