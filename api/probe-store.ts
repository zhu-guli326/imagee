import * as promptStore from "../src/lib/server/promptStore";

export async function GET() {
  return Response.json({
    ok: true,
    exports: Object.keys(promptStore).sort(),
  });
}
