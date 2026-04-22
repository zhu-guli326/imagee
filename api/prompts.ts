import {
  createPromptRecord,
  listPrompts,
} from "../src/lib/server/promptStore";

function parseJsonBody(body: unknown) {
  if (!body) {
    return {};
  }

  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function pickString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function pickStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

export default async function handler(req: any, res: any) {
  if (req.method === "GET") {
    try {
      const search = typeof req.query?.search === "string" ? req.query.search : undefined;
      const prompts = await listPrompts(search);
      return res.status(200).json(prompts);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Failed to fetch prompts" });
    }
  }

  if (req.method === "POST") {
    try {
      const body = parseJsonBody(req.body);
      const prompt = await createPromptRecord({
        title: pickString(body.title),
        prompt: pickString(body.prompt),
        aspectRatio: pickString(body.aspectRatio),
        sourceUrl: pickString(body.sourceUrl),
        tags: body.tags,
        originalImagePaths: pickStringArray(body.originalImagePaths),
        originalImageNames: pickStringArray(body.originalImageNames),
      });

      return res.status(201).json(prompt);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to save prompt";
      const status = message === "Original image is required" ? 400 : 500;
      return res.status(status).json({ error: message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
