import { createSignedUploadTargets } from "../../src/lib/server/promptStore";

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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = parseJsonBody(req.body);
    const fileNames = Array.isArray(body.fileNames) ? body.fileNames : [];
    const uploads = await createSignedUploadTargets(fileNames);
    return res.status(200).json({ uploads });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to create upload targets";
    return res.status(500).json({ error: message });
  }
}
