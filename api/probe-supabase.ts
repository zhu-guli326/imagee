import { createClient } from "@supabase/supabase-js";

export async function GET() {
  return Response.json({
    ok: true,
    type: typeof createClient,
  });
}
