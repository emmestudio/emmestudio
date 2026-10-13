import { configurationReady } from "@/lib/config";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ service: "emme-studio-portal", configured: configurationReady(), calendarSync: "not-active" }, { headers: { "Cache-Control": "no-store" } });
}
