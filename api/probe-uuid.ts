import { v4 as uuidv4 } from "uuid";

export async function GET() {
  return Response.json({
    ok: true,
    sample: uuidv4(),
  });
}
