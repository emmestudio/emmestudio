import {notifyArtistEvent} from "@/lib/artist-notifications";
import { workspaceSession } from "@/lib/workspace-session";
import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";

export const dynamic = "force-dynamic";
const reply = (value: unknown, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});
const allowed = new Set(["draft","ready","approved","revision_requested","withdrawn"]);
function cleaned(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : null;
}

// INTERNAL ADMIN API ONLY: never expose this listing or raw Drive identifiers to artists.
// Playback must use a separate short-lived, artist-scoped streaming endpoint.
export async function GET(request: Request) {
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({error:"Accesso richiesto."},401);
    if (s.role !== "admin") return reply({error:"Solo amministratore."},403);
    const artist = new URL(request.url).searchParams.get("artist");
    if (artist && !validId(artist)) return reply({error:"Artista non valido."},400);
    const result = await getDb().query(
      `SELECT id,artist_id AS "artistId",track_id AS "trackId",title,
      drive_file_id AS "driveFileId",version_label AS "versionLabel",status,
      delivery_unlocked AS "deliveryUnlocked",feedback,updated_at AS "updatedAt"
      FROM studio_artist_previews WHERE owner_id=$1
      AND ($2::uuid IS NULL OR artist_id=$2::uuid)
      ORDER BY updated_at DESC LIMIT 501`,
      [s.workspaceOwnerId, artist || null],
    );
    if (result.rows.length > 500) return reply({error:"Troppi elementi: filtra per artista."},409);
    return reply({items:result.rows});
  } catch {
    return reply({error:"Registro anteprime non disponibile. Verifica la migrazione 013."},503);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))
    return reply({error:"Origine non autorizzata."},403);
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({error:"Accesso richiesto."},401);
    if (s.role !== "admin") return reply({error:"Solo amministratore."},403);
    const b = await request.json();
    if (!validId(b.id) || !validId(b.artistId) || !validId(b.trackId))
      return reply({error:"Identificativi non validi."},400);
    const title=cleaned(b.title,300),label=cleaned(b.versionLabel,100);
    const fileId=cleaned(b.driveFileId,200);
    if (!title || !label || !fileId || !/^[A-Za-z0-9_-]{5,200}$/.test(fileId))
      return reply({error:"Inserisci titolo, versione e ID file Drive validi."},400);
    if (b.deliveryUnlocked !== undefined && b.deliveryUnlocked !== false)
      return reply({error:"Lo sblocco delle consegne richiede una procedura separata."},400);
    const client=await getDb().connect();
    try {
      await client.query("BEGIN");
      const found=await client.query(
        `SELECT r.id FROM studio_production r
         LEFT JOIN studio_projects p ON p.id=r.project_id AND p.owner_id=r.owner_id
         WHERE r.owner_id=$1 AND r.id=$2 AND r.kind='track' AND r.deleted_at IS NULL
         AND COALESCE(p.artist_id,r.artist_id)=$3
         AND (r.project_id IS NULL OR p.deleted_at IS NULL)
         AND EXISTS (SELECT 1 FROM studio_artists a WHERE a.owner_id=$1 AND a.id=$3 AND a.deleted_at IS NULL)`,
        [s.workspaceOwnerId,b.trackId,b.artistId],
      );
      if (!found.rowCount) { await client.query("ROLLBACK");return reply({error:"Brano e artista non corrispondono."},400); }
      await client.query(
        `INSERT INTO studio_artist_previews
         (id,owner_id,artist_id,track_id,title,drive_file_id,version_label)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [b.id,s.workspaceOwnerId,b.artistId,b.trackId,title,fileId,label],
      );
      await client.query("COMMIT");
      return reply({created:true},201);
    } catch(e) {
      await client.query("ROLLBACK");
      if ((e as {code?:string}).code==="23505") return reply({error:"Anteprima già registrata."},409);
      throw e;
    } finally {client.release();}
  } catch {return reply({error:"Salvataggio anteprima non completato."},503);}
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))
    return reply({error:"Origine non autorizzata."},403);
  try {
    const s=await workspaceSession(request.headers);
    if (!s) return reply({error:"Accesso richiesto."},401);
    if (s.role!=="admin") return reply({error:"Solo amministratore."},403);
    const b=await request.json();
    if (!validId(b.id) || !allowed.has(b.status) || b.deliveryUnlocked!==undefined)
      return reply({error:"Stato non valido: la consegna non si sblocca qui."},400);
    const result=await getDb().query(
      `UPDATE studio_artist_previews SET status=$3,updated_at=now()
       WHERE owner_id=$1 AND id=$2 RETURNING id`,[s.workspaceOwnerId,b.id,b.status],
    );
    if(result.rowCount&&b.status==="ready"){const v=await getDb().query("SELECT artist_id,track_id FROM studio_artist_previews WHERE id=$1 AND owner_id=$2",[b.id,s.workspaceOwnerId]);if(v.rows[0])await notifyArtistEvent(s.workspaceOwnerId,v.rows[0].artist_id,v.rows[0].track_id,"artist","preview","Nuova versione disponibile per l’ascolto");}
    return result.rowCount?reply({saved:true}):reply({error:"Anteprima non trovata."},404);
  } catch {return reply({error:"Modifica anteprima non disponibile."},503);}
}
