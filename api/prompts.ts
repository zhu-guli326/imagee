import {
  createPromptRecord,
  listPrompts,
} from "../src/lib/server/promptStore";

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
      const prompt = await createPromptRecord({
        title: req.body?.title,
        prompt: req.body?.prompt,
        aspectRatio: req.body?.aspectRatio,
        sourceUrl: req.body?.sourceUrl,
        tags: req.body?.tags,
        originalImages: req.body?.originalImages,
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
