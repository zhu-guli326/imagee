import { getSupabaseStatus } from "../../src/lib/server/promptStore";

export default async function handler(_req: any, res: any) {
  try {
    const result = await getSupabaseStatus();
    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to check Supabase status" });
  }
}
