import { configurationReady } from "@/lib/config";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ service: "emme-studio-portal", configured: configurationReady(), calendarMode: "direct-google", refreshSeconds: 60 }, { headers: { "Cache-Control": "no-store" } });
}
