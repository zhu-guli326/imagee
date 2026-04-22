import * as promptStore from "./_lib/promptStore.js";

export async function GET() {
  return Response.json({
    ok: true,
    exports: Object.keys(promptStore).sort(),
  });
}
