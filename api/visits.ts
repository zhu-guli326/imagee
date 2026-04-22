import { saveVisit } from "./_lib/visitStore.js";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const visit = await saveVisit({
      source: pickString(body.source) || "direct",
      medium: pickString(body.medium),
      campaign: pickString(body.campaign),
      term: pickString(body.term),
      content: pickString(body.content),
      landingPath: pickString(body.landingPath) || "/",
      landingUrl: pickString(body.landingUrl),
      referrer: pickString(body.referrer),
      referrerHost: pickString(body.referrerHost),
      userAgent: request.headers.get("user-agent") || "",
    });

    return json({ ok: true, visit }, { status: 201 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to save visit";
    return json({ error: message }, { status: 500 });
  }
}
