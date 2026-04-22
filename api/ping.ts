export async function GET() {
  return Response.json({
    ok: true,
    runtime: "vercel-function",
    timestamp: new Date().toISOString(),
  });
}
