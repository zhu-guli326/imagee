import { createSignedUploadTargets } from "../../src/lib/server/promptStore";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const fileNames = Array.isArray(req.body?.fileNames) ? req.body.fileNames : [];
    const uploads = await createSignedUploadTargets(fileNames);
    return res.status(200).json({ uploads });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Failed to create upload targets";
    return res.status(500).json({ error: message });
  }
}
