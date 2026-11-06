import { labelSite } from "@/lib/label-catalog-data";
import { publicLabel } from "@/lib/label-catalog";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin === labelSite || origin === "https://www.emmestudioproduction.it")
    headers["Access-Control-Allow-Origin"] = origin;
  try {
    const partners = (await publicLabel(true)).map(({ slug, name, tagline, body, photo, links }) =>
      ({ slug, name, tagline, body, photo, links }));
    return Response.json({ partners }, { headers });
  } catch {
    return Response.json({ error: "Partner temporaneamente non disponibili." }, { status: 503, headers });
  }
}
