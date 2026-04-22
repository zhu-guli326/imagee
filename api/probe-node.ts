import { existsSync } from "fs";
import path from "path";

export async function GET() {
  return Response.json({
    ok: true,
    cwd: process.cwd(),
    rootExists: existsSync(process.cwd()),
    sep: path.sep,
  });
}
