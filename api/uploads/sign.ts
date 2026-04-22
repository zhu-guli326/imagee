import { createSignedUploadTargets } from "../_lib/promptStore";

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

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const fileNames = Array.isArray(body.fileNames) ? body.fileNames : [];
    const uploads = await createSignedUploadTargets(fileNames);
    return json({ uploads });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to create upload targets";
    return json({ error: message }, { status: 500 });
  }
}
