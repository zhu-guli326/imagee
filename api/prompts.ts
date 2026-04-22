import { createPromptRecord, listPrompts } from "./_lib/promptStore.js";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function pickStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || undefined;
    const prompts = await listPrompts(search);
    return json(prompts);
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to fetch prompts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    const prompt = await createPromptRecord({
      title: pickString(body.title),
      prompt: pickString(body.prompt),
      aspectRatio: pickString(body.aspectRatio),
      sourceUrl: pickString(body.sourceUrl),
      tags: body.tags,
      originalImagePaths: pickStringArray(body.originalImagePaths),
      originalImageNames: pickStringArray(body.originalImageNames),
    });

    return json(prompt, { status: 201 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to save prompt";
    const status = message === "Original image is required" ? 400 : 500;
    return json({ error: message }, { status });
  }
}
