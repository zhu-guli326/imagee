import { incrementPromptView } from "../../../src/lib/server/promptStore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const prompt = await incrementPromptView(req.query.id);
    if (!prompt) {
      return res.status(404).json({ error: "Prompt not found" });
    }

    return res.status(200).json(prompt);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update views" });
  }
}
