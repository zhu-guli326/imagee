import { getSupabaseStatus } from "../_lib/promptStore.js";

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, init);
}

export async function GET() {
  try {
    const result = await getSupabaseStatus();
    return json(result.body, { status: result.status });
  } catch (error) {
    console.error(error);
    return json({ error: "Failed to check Supabase status" }, { status: 500 });
  }
}
