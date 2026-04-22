import { incrementPromptView } from "../../_lib/promptStore.js";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

function getPromptId(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return segments.at(-2) || "";
}

export async function POST(request: Request) {
  try {
    const prompt = await incrementPromptView(getPromptId(request));
    if (!prompt) {
      return json({ error: "Prompt not found" }, { status: 404 });
    }

    return json(prompt);
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to update views" }, { status: 500 });
  }
}
