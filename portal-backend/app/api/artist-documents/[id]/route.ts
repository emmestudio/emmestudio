import { artistSession } from "@/lib/artist-session";
import { ownerSession } from "@/lib/owner-session";
import { sameOrigin } from "@/lib/calendar-policy";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";

type Context = { params: Promise<{ id: string }> };
const limit = 4 * 1024 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });

export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  const session = await artistSession(request.headers);
  if (!session) return reply({ error: "Accedi alla tua area artista." }, 401);
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Documento non valido." }, 400);
  if (Number(request.headers.get("content-length")) > limit)
    return reply({ error: "Il PDF deve pesare al massimo 4 MB." }, 413);

  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > limit) return reply({ error: "Il PDF deve pesare al massimo 4 MB." }, 413);
    if (request.headers.get("content-type") !== "application/pdf" ||
        bytes.subarray(0, 5).toString("ascii") !== "%PDF-" ||
        !bytes.subarray(-1024).includes(Buffer.from("%%EOF")))
      return reply({ error: "Carica un file PDF valido." }, 415);

    const result = await getDb().query(
      `UPDATE studio_artist_form_shares SET signed_pdf=$4, returned_at=now()
       WHERE id=$1 AND owner_id=$2 AND artist_id=$3 AND requires_signature AND returned_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM studio_form_signatures s
           WHERE s.document_id=studio_artist_form_shares.document_id AND s.version=studio_artist_form_shares.version)
       RETURNING id`, [id, session.ownerId, session.artistId, bytes],
    );
    return result.rowCount ? reply({ returned: true }) :
      reply({ error: "Documento non disponibile per la restituzione o copia già ricevuta." }, 409);
  } catch {
    return reply({ error: "Caricamento non riuscito. Riprova." }, 503);
  }
}

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Documento non disponibile." }, 404);
  const owner = await ownerSession(request.headers);
  const artist = owner ? null : await artistSession(request.headers);
  if (!owner && !artist) return reply({ error: "Accesso richiesto." }, 401);

  try {
    const result = await getDb().query(
      `SELECT signed_pdf FROM studio_artist_form_shares WHERE id=$1 AND owner_id=$2
       AND ($3::uuid IS NULL OR artist_id=$3) AND returned_at IS NOT NULL`,
      [id, owner?.user.id ?? artist?.ownerId, artist?.artistId ?? null],
    );
    const pdf = result.rows[0]?.signed_pdf as Buffer | undefined;
    if (!pdf) return reply({ error: "Copia firmata non disponibile." }, 404);
    return new Response(new Uint8Array(pdf), { headers: { ...privateHeaders, "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="documento-firmato.pdf"' } });
  } catch {
    return reply({ error: "Download non riuscito." }, 503);
  }
}
