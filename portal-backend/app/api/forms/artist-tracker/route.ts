import { ownerSession } from "@/lib/owner-session";
import { getDb } from "@/lib/db";
import { sameOrigin } from "@/lib/calendar-policy";
import { validId } from "@/lib/task-data";
import { validDate } from "@/lib/event-data";
import { safeLink } from "@/lib/production-data";
import { listFinanceTargets } from "@/lib/finance-targets";

export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);
  const artistId = new URL(request.url).searchParams.get("artist");
  if (!validId(artistId)) return reply({ error: "Artista non valido." }, 400);

  try {
    const result = await getDb().query(
      `SELECT d.id, d.title, d.template, d.state, d.version, d.work_id AS "workId",
         COALESCE(d.payload #>> '{definition,signatures}' <> 'none', true) AS "requiresSignature",
         signature.version AS "signedVersion", signature.signed_on::text AS "signedOn",
         signature.evidence_url AS "evidenceUrl"
       FROM studio_form_documents d
       JOIN studio_artists a ON a.id=$2 AND a.owner_id=d.owner_id AND a.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT s.version,s.signed_on,s.evidence_url FROM studio_form_signatures s
         JOIN studio_form_history h ON h.document_id=s.document_id AND h.version=s.version
         WHERE s.document_id=d.id AND h.payload #>> '{draft,artistId}'=$2::text
         ORDER BY s.version DESC LIMIT 1
       ) signature ON true
       WHERE d.owner_id=$1 AND d.payload #>> '{draft,artistId}'=$2::text
       ORDER BY d.updated_at DESC`,
      [session.user.id, artistId],
    );
    return reply({ documents: result.rows });
  } catch {
    return reply({ error: "Documenti dell’artista non disponibili." }, 503);
  }
}

export async function PATCH(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);

  const input = await request.json().catch(() => null);
  if (!input || !validId(input.id) || !validId(input.artistId) ||
      !Number.isSafeInteger(input.version) || input.version < 1)
    return reply({ error: "Documento o versione non validi." }, 400);

  const action = input.action;
  if (!["link", "sign", "clear"].includes(action))
    return reply({ error: "Operazione non valida." }, 400);
  if (action === "link" && input.workId !== null && !validId(input.workId))
    return reply({ error: "Lavoro non valido." }, 400);
  const evidenceUrl = typeof input.evidenceUrl === "string" ? input.evidenceUrl.trim() : "";
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
  if (action === "sign" && (typeof input.signedOn !== "string" ||
      !validDate(input.signedOn) || input.signedOn > today ||
      evidenceUrl.length > 2000 || (evidenceUrl && !safeLink(evidenceUrl))))
    return reply({ error: "Verifica la data di firma e l’eventuale link HTTPS." }, 400);

  try {
    if (action === "link" && input.workId &&
        !(await listFinanceTargets(session.user.id)).some(t => t.id === input.workId && t.artistId === input.artistId))
      return reply({ error: "Il lavoro selezionato non appartiene a questo artista." }, 400);

    const db = await getDb().connect();
    try {
      await db.query("BEGIN");
      const document = (await db.query(
        `SELECT d.version, d.state, d.payload #>> '{definition,signatures}' AS signatures
         FROM studio_form_documents d
         JOIN studio_artists a ON a.id=$3 AND a.owner_id=d.owner_id AND a.deleted_at IS NULL
         WHERE d.id=$1 AND d.owner_id=$2 AND d.payload #>> '{draft,artistId}'=$3::text
         FOR UPDATE OF d`,
        [input.id, session.user.id, input.artistId],
      )).rows[0];
      if (!document || document.version !== input.version) {
        await db.query("ROLLBACK");
        return reply({ error: "Documento modificato o non disponibile. Aggiorna la scheda." }, 409);
      }

      if (action === "link") {
        await db.query("UPDATE studio_form_documents SET work_id=$2 WHERE id=$1", [input.id, input.workId]);
      } else if (action === "clear") {
        await db.query("DELETE FROM studio_form_signatures WHERE document_id=$1 AND version=$2", [input.id, input.version]);
      } else {
        if (document.state !== "ready" || document.signatures === "none") {
          await db.query("ROLLBACK");
          return reply({ error: "Puoi registrare la firma di un documento preparato che prevede sottoscrizione." }, 400);
        }
        await db.query(
          `INSERT INTO studio_form_signatures(document_id,version,signed_on,evidence_url)
           VALUES($1,$2,$3,$4) ON CONFLICT(document_id,version)
           DO UPDATE SET signed_on=excluded.signed_on,evidence_url=excluded.evidence_url`,
          [input.id, input.version, input.signedOn, evidenceUrl],
        );
      }
      await db.query("COMMIT");
      return reply({ saved: true });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  } catch {
    return reply({ error: "Aggiornamento dei documenti non riuscito." }, 503);
  }
}
