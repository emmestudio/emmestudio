import { del, get } from "@vercel/blob";
import { directDocumentLimit, signedDocumentLimit, validSignedDocumentPath } from "@/lib/signed-document-upload";
import { artistSession } from "@/lib/artist-session";
import { ownerSession } from "@/lib/owner-session";
import { sameOrigin } from "@/lib/calendar-policy";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";

type Context = { params: Promise<{ id: string }> };
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: privateHeaders });

const pdfHeaders = { ...privateHeaders, "Content-Type": "application/pdf",
  "Content-Disposition": 'attachment; filename="documento-firmato.pdf"' };

function validPdf(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("ascii") === "%PDF-" &&
    bytes.subarray(-1024).includes(Buffer.from("%%EOF"));
}

async function finalizeUpload(request: Request, id: string, owner: string, artist: string) {
  const body = await request.json().catch(() => null);
  const path = body?.pathname;
  if (!validSignedDocumentPath(id, path)) return reply({ error: "Caricamento non valido." }, 400);
  const db = getDb();
  const share = (await db.query(
    `SELECT f.returned_at,f.signed_blob_path,
       EXISTS (SELECT 1 FROM studio_form_signatures s WHERE s.document_id=f.document_id AND s.version=f.version) AS signed
     FROM studio_artist_form_shares f WHERE f.id=$1 AND f.owner_id=$2 AND f.artist_id=$3 AND f.requires_signature`,
    [id, owner, artist],
  )).rows[0];
  if (!share) return reply({ error: "Documento non disponibile." }, 404);
  if (share.signed_blob_path === path && share.returned_at) return reply({ returned: true });
  if (share.signed || share.returned_at) {
    await del(path).catch(() => {});
    return reply({ error: "Documento già restituito o firmato." }, 409);
  }

  const file = await get(path, { access: "private", useCache: false });
  if (!file?.stream) return reply({ error: "PDF caricato non disponibile. Riprova." }, 404);
  const { size, contentType } = file.blob;
  if (size < 5 || size > signedDocumentLimit || contentType !== "application/pdf") {
    await file.stream.cancel().catch(() => {});
    await del(path).catch(() => {});
    return reply({ error: "Carica un PDF valido fino a 20 MB." }, 415);
  }
  const bytes = Buffer.from(await new Response(file.stream).arrayBuffer());
  if (bytes.length !== size || !validPdf(bytes)) {
    await del(path).catch(() => {});
    return reply({ error: "Carica un file PDF valido." }, 415);
  }

  const saved = await db.query(
    `UPDATE studio_artist_form_shares f SET signed_blob_path=$4,returned_at=now()
     WHERE f.id=$1 AND f.owner_id=$2 AND f.artist_id=$3 AND f.requires_signature AND f.returned_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM studio_form_signatures s
         WHERE s.document_id=f.document_id AND s.version=f.version)
     RETURNING id`, [id, owner, artist, path],
  );
  if (saved.rowCount) return reply({ returned: true });
  const existing = (await db.query(
    "SELECT signed_blob_path FROM studio_artist_form_shares WHERE id=$1 AND owner_id=$2 AND artist_id=$3",
    [id, owner, artist],
  )).rows[0];
  if (existing?.signed_blob_path === path) return reply({ returned: true });
  await del(path).catch(() => {});
  return reply({ error: "Documento già restituito o firmato." }, 409);
}

export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  const session = await artistSession(request.headers);
  if (!session) return reply({ error: "Accedi alla tua area artista." }, 401);
  const { id } = await params;
  if (!validId(id)) return reply({ error: "Documento non valido." }, 400);
  if (Number(request.headers.get("content-length")) > directDocumentLimit)
    return reply({ error: "Per i PDF oltre 4 MB usa il caricamento dall’area artista." }, 413);

  try {
    if (request.headers.get("content-type") === "application/json")
      return await finalizeUpload(request, id, session.ownerId, session.artistId);
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.length > directDocumentLimit) return reply({ error: "Per i PDF oltre 4 MB usa il caricamento dall’area artista." }, 413);
    if (request.headers.get("content-type") !== "application/pdf" ||
        !validPdf(bytes))
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
      `SELECT signed_pdf,signed_blob_path FROM studio_artist_form_shares WHERE id=$1 AND owner_id=$2
       AND ($3::uuid IS NULL OR artist_id=$3) AND returned_at IS NOT NULL`,
      [id, owner?.user.id ?? artist?.ownerId, artist?.artistId ?? null],
    );
    const row = result.rows[0];
    if (row?.signed_blob_path) {
      const file = await get(row.signed_blob_path, { access: "private", useCache: false });
      if (!file?.stream) return reply({ error: "Copia firmata non disponibile." }, 404);
      return new Response(file.stream, { headers: pdfHeaders });
    }
    const pdf = row?.signed_pdf as Buffer | undefined;
    if (!pdf) return reply({ error: "Copia firmata non disponibile." }, 404);
    return new Response(new Uint8Array(pdf), { headers: pdfHeaders });
  } catch {
    return reply({ error: "Download non riuscito." }, 503);
  }
}
