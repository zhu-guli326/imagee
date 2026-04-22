import * as promptStore from "./_lib/promptStore";

export async function GET() {
  return Response.json({
    ok: true,
    exports: Object.keys(promptStore).sort(),
  });
}
