import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { artistSession } from "@/lib/artist-session";
import { sameOrigin } from "@/lib/calendar-policy";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import { signedDocumentLimit, validSignedDocumentPath } from "@/lib/signed-document-upload";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return Response.json({ error: "Origine non consentita." }, { status: 403 });
  const session = await artistSession(request.headers);
  if (!session) return Response.json({ error: "Accedi alla tua area artista." }, { status: 401 });
  const { id } = await params;
  if (!validId(id)) return Response.json({ error: "Documento non valido." }, { status: 400 });

  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      body, request,
      onBeforeGenerateToken: async pathname => {
        if (!validSignedDocumentPath(id, pathname)) throw Error("Percorso non valido");
        const pending = await getDb().query(
          `SELECT 1 FROM studio_artist_form_shares f
           WHERE f.id=$1 AND f.owner_id=$2 AND f.artist_id=$3 AND f.requires_signature AND f.returned_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM studio_form_signatures s
             WHERE s.document_id=f.document_id AND s.version=f.version)`,
          [id, session.ownerId, session.artistId],
        );
        if (!pending.rowCount) throw Error("Documento non disponibile");
        return {
          allowedContentTypes: ["application/pdf"],
          maximumSizeInBytes: signedDocumentLimit,
          validUntil: Date.now() + 10 * 60 * 1000,
          allowOverwrite: false,
          addRandomSuffix: false,
        };
      },
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Impossibile avviare il caricamento del PDF." }, { status: 400 });
  }
}
