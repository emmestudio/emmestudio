import { ownerSession } from "@/lib/owner-session";
import { getDb } from "@/lib/db";
import { sameOrigin } from "@/lib/calendar-policy";
import { validId } from "@/lib/task-data";
import { validArtistEmail } from "@/lib/artist-access-policy";
import { deliverArtistEmail } from "@/lib/artist-notifications";

const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);
  const input = await request.json().catch(() => null);
  if (!input || !validId(input.id) || !validId(input.artistId) || !Number.isSafeInteger(input.version) || input.version < 1)
    return reply({ error: "Documento, artista o versione non validi." }, 400);

  const owner = session.user.id;
  let jobId: string | undefined;
  let db;
  try {
    db = await getDb().connect();
    await db.query("BEGIN");
    const doc = (await db.query(
      `SELECT d.title, d.state, d.version,
        COALESCE(d.payload #>> '{definition,signatures}' <> 'none', true) AS "requiresSignature", x.email
       FROM studio_form_documents d
       JOIN studio_artists a ON a.id=$3 AND a.owner_id=d.owner_id AND a.deleted_at IS NULL
       LEFT JOIN studio_artist_access x ON x.owner_id=a.owner_id AND x.artist_id=a.id AND x.enabled
       WHERE d.id=$1 AND d.owner_id=$2 AND d.payload #>> '{draft,artistId}'=$3::text
       FOR UPDATE OF d`, [input.id, owner, input.artistId],
    )).rows[0];
    if (!doc || doc.state !== "ready" || doc.version !== input.version) {
      await db.query("ROLLBACK");
      return reply({ error: "Riapri l’ultima versione preparata e collegata all’artista." }, 409);
    }
    if (!doc.email || !validArtistEmail(doc.email)) {
      await db.query("ROLLBACK");
      return reply({ error: "Prima abilita l’accesso al portale per questo artista con un indirizzo email valido." }, 409);
    }

    const share = (await db.query(
      `INSERT INTO studio_artist_form_shares(owner_id,artist_id,document_id,version,title,requires_signature)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(document_id,version) DO NOTHING RETURNING id`,
      [owner, input.artistId, input.id, input.version, doc.title, doc.requiresSignature],
    )).rows[0];
    if (share) {
      const notice = (await db.query(
        `INSERT INTO studio_artist_notifications(owner_id,artist_id,recipient,event_type,body)
         VALUES($1,$2,'artist','document',$3) RETURNING id`,
        [owner, input.artistId, doc.requiresSignature
          ? "Hai un nuovo documento da stampare, firmare e restituire. Lo trovi in Modulistica nella tua area artista."
          : "Hai un nuovo documento disponibile. Lo trovi in Modulistica nella tua area artista."],
      )).rows[0];
      jobId = (await db.query(
        `INSERT INTO studio_artist_email_outbox(owner_id,notification_id,recipient_email)
         VALUES($1,$2,$3) RETURNING id`, [owner, notice.id, doc.email],
      )).rows[0].id;
      await db.query("UPDATE studio_artist_form_shares SET email_job_id=$2 WHERE id=$1", [share.id, jobId]);
    } else {
      jobId = (await db.query(
        `SELECT email_job_id FROM studio_artist_form_shares
         WHERE document_id=$1 AND version=$2 AND owner_id=$3 AND artist_id=$4`,
        [input.id, input.version, owner, input.artistId],
      )).rows[0]?.email_job_id;
      if (jobId) await db.query(
        `UPDATE studio_artist_email_outbox SET recipient_email=$3
         WHERE id=$1 AND owner_id=$2 AND state IN ('queued','failed')`, [jobId, owner, doc.email],
      );
    }
    await db.query("COMMIT");
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return reply({ error: "Pubblicazione del documento non riuscita." }, 503);
  } finally {
    db?.release();
  }

  if (!jobId) return reply({ published: true, emailState: "uncertain" });
  try {
    await deliverArtistEmail(owner, jobId);
    const job = (await getDb().query("SELECT state FROM studio_artist_email_outbox WHERE id=$1 AND owner_id=$2",
      [jobId, owner])).rows[0];
    return reply({ published: true, emailState: job?.state ?? "uncertain" });
  } catch {
    return reply({ published: true, emailState: "uncertain" });
  }
}
