import { getAuth } from "@/lib/auth";
import { configurationReady } from "@/lib/config";
export const runtime = "nodejs";

async function handler(request: Request) {
  if (!configurationReady()) return Response.json({ error: "Portale in configurazione." }, { status: 503 });
  return getAuth().handler(request);
}
export const GET = handler;
export const POST = handler;
