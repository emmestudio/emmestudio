import { labelSite } from "@/lib/label-catalog-data";
import { publicLabel } from "@/lib/label-catalog";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { "Cache-Control": "no-store", Vary: "Origin" };
  if (origin === labelSite || origin === "https://www.emmestudioproduction.it")
    headers["Access-Control-Allow-Origin"] = origin;
  try {
    const entries = await publicLabel();
    const artists = entries.filter(row => row.kind === "artist").map(row => ({
      slug: row.slug, name: row.name, photo: row.photo, tagline: row.tagline, bio: row.body.split(/\n\s*\n/),
      links: Object.entries(row.links).map(([label, url]) => ({ label, url })),
      page: row.slug === "moody" ? "label-moody.html" : undefined, published: true,
    }));
    const releases = entries.filter(row => row.kind === "release").map(row => ({
      slug: row.slug, title: row.name, body: row.body, cover: row.photo, type: row.type, date: row.date,
      artistSlug: row.artistSlug, artistName: artists.find(artist => artist.slug === row.artistSlug)?.name || row.artistName,
      spotify: row.spotify, published: true,
    }));
    return Response.json({ artists, releases }, { headers });
  } catch {
    return Response.json({ error: "Catalogo temporaneamente non disponibile." }, { status: 503, headers });
  }
}
