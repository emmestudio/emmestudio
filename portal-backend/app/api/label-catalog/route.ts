import { ownerSession } from "@/lib/owner-session";
import { getDb } from "@/lib/db";
import { sameOrigin } from "@/lib/calendar-policy";
import { validId } from "@/lib/task-data";
import { validateLabelDraft } from "@/lib/label-catalog-data";
import { labelColumns, labelEntry } from "@/lib/label-catalog";
import sharp from "sharp";

export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);
  try {
    const result = await getDb().query(
      `SELECT ${labelColumns} FROM studio_label_catalog WHERE owner_id=$1 ORDER BY kind,sort_order NULLS LAST,id`, [session.user.id],
    );
    return reply({ entries: result.rows.map(row => labelEntry(row)) });
  } catch { return reply({ error: "Catalogo non disponibile. Riprova." }, 503); }
}

export async function POST(request: Request) {
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  if (Number(request.headers.get("content-length")) > 50000) return reply({ error: "Scheda troppo lunga." }, 413);
  let input, draft;
  try {
    input = await request.json();
    if (typeof input.published !== "boolean" || (input.id && (!validId(input.id) || !Number.isSafeInteger(input.version))))
      throw Error("Scheda o versione non valida.");
    if (input.upload && !validId(input.upload)) throw Error("Immagine non valida.");
    draft = validateLabelDraft(input, input.published);
  } catch (error) { return reply({ error: error instanceof Error ? error.message : "Scheda non valida." }, 400); }
  const owner = session.user.id;
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [owner + "-label-catalog"]);
    const old = input.id ? (await db.query(
      "SELECT kind,slug,version,published_once,(image IS NOT NULL) AS has_image FROM studio_label_catalog WHERE id=$1 AND owner_id=$2 FOR UPDATE",
      [input.id, owner],
    )).rows[0] : null;
    if (input.id && (!old || old.version !== input.version || old.kind !== draft.kind)) {
      await db.query("ROLLBACK");
      return reply({ error: "La scheda è cambiata. Ricarica prima di salvare." }, 409);
    }
    if (old?.published_once && old.slug !== draft.slug) {
      await db.query("ROLLBACK");
      return reply({ error: "L’indirizzo di una scheda già pubblicata resta fisso." }, 400);
    }
    if (draft.artistSlug) {
      const linked = (await db.query(
        "SELECT data->>'name' AS name,published FROM studio_label_catalog WHERE owner_id=$1 AND kind='artist' AND slug=$2",
        [owner, draft.artistSlug],
      )).rows[0];
      if (!linked || (input.published && !linked.published)) {
        await db.query("ROLLBACK");
        return reply({ error: "Per pubblicare, seleziona un artista del roster già online oppure indica il nome a mano." }, 400);
      }
      draft.artistName ||= linked.name;
    }
    let image: Buffer | null = null;
    if (input.upload) {
      const upload = (await db.query(
        `SELECT bytes FROM studio_news_cover_uploads
         WHERE id=$1 AND owner_id=$2 AND received=total AND expires_at>now() FOR UPDATE`, [input.upload, owner],
      )).rows[0];
      if (!upload) {
        await db.query("ROLLBACK");
        return reply({ error: "Immagine non disponibile. Selezionala di nuovo." }, 400);
      }
      try {
        image = await sharp(upload.bytes, { limitInputPixels: 60_000_000 }).rotate()
          .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).webp({ quality: 87 }).toBuffer();
      } catch {
        await db.query("ROLLBACK");
        return reply({ error: "Impossibile leggere l’immagine. Scegli un altro JPG, PNG o WebP." }, 400);
      }
    }
    if (draft.kind === "artist" && input.published && !image && !old?.has_image && !(old?.slug === "moody")) {
      await db.query("ROLLBACK");
      return reply({ error: "Aggiungi una foto prima di pubblicare l’artista." }, 400);
    }
    const params = [owner, draft.kind, draft.slug, JSON.stringify(draft), input.published, image];
    const result = old ? await db.query(
      `UPDATE studio_label_catalog SET kind=$2,slug=$3,data=$4,published=$5,published_once=published_once OR $5,
       image=COALESCE($6,image),image_type=CASE WHEN $6::bytea IS NOT NULL THEN 'image/webp' ELSE image_type END,
       version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$7 RETURNING ${labelColumns}`, [...params, input.id],
    ) : await db.query(
      `INSERT INTO studio_label_catalog(owner_id,kind,slug,data,published,published_once,image,image_type,sort_order)
       VALUES($1,$2,$3,$4,$5,$5,$6,CASE WHEN $6::bytea IS NOT NULL THEN 'image/webp' END,
         (SELECT COALESCE(MAX(sort_order),0)+1 FROM studio_label_catalog WHERE owner_id=$1 AND kind=$2)) RETURNING ${labelColumns}`, params,
    );
    if (input.upload) await db.query("DELETE FROM studio_news_cover_uploads WHERE id=$1 AND owner_id=$2", [input.upload, owner]);
    await db.query("COMMIT");
    return reply({ entry: labelEntry(result.rows[0]) });
  } catch (error) {
    await db.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") return reply({ error: "L’indirizzo è già in uso." }, 409);
    console.error("LABEL_CATALOG_SAVE_FAILED");
    return reply({ error: "Salvataggio non riuscito. Riprova." }, 503);
  } finally { db.release(); }
}

async function changeCatalogue(request: Request, action: "order" | "delete") {
  const session = await ownerSession(request.headers);
  if (!session) return reply({ error: "Accesso riservato al titolare." }, 401);
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Origine non consentita." }, 403);
  const input = await request.json().catch(() => null);
  if (!input || !validId(input.id)) return reply({ error: "Scheda non valida." }, 400);
  if (action === "order" && (!validId(input.neighbor) || ![-1, 1].includes(input.direction)))
    return reply({ error: "Posizione non valida." }, 400);
  if (action === "delete" && (!Number.isSafeInteger(input.version) || input.confirm !== true))
    return reply({ error: "Conferma di eliminazione non valida." }, 400);

  const owner = session.user.id;
  const db = await getDb().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [owner + "-label-catalog"]);
    const rows = (await db.query(
      `SELECT id,kind,slug,version,sort_order,data->>'name' AS name
       FROM studio_label_catalog WHERE owner_id=$1 ORDER BY kind,sort_order NULLS LAST,id`, [owner],
    )).rows;
    const entry = rows.find(row => row.id === input.id);
    const group = rows.filter(row => row.kind === entry?.kind);
    const index = group.findIndex(row => row.id === input.id);
    const neighbor = group.findIndex(row => row.id === input.neighbor);
    if (!entry || (action === "delete" ? entry.version !== input.version : neighbor < 0 || neighbor - index !== input.direction)) {
      await db.query("ROLLBACK");
      return reply({ error: "Il catalogo è cambiato. Ricarica la pagina e riprova." }, 409);
    }

    if (action === "order") {
      await db.query(
        `UPDATE studio_label_catalog SET sort_order=CASE WHEN id=$2 THEN $4::integer ELSE $5::integer END
         WHERE owner_id=$1 AND id IN ($2,$3)`,
        [owner, entry.id, input.neighbor, group[neighbor].sort_order, entry.sort_order],
      );
    } else {
      if (entry.kind === "artist") await db.query(
        `UPDATE studio_label_catalog SET data=data || jsonb_build_object('artistSlug','','artistName',$3::text),
         version=version+1 WHERE owner_id=$1 AND kind='release' AND data->>'artistSlug'=$2`,
        [owner, entry.slug, entry.name],
      );
      await db.query("DELETE FROM studio_label_catalog WHERE owner_id=$1 AND id=$2", [owner, entry.id]);
    }
    const result = await db.query(
      `SELECT ${labelColumns} FROM studio_label_catalog WHERE owner_id=$1 ORDER BY kind,sort_order NULLS LAST,id`,
      [owner],
    );
    await db.query("COMMIT");
    return reply({ entries: result.rows.map(row => labelEntry(row)) });
  } catch {
    await db.query("ROLLBACK");
    return reply({ error: "Modifica del catalogo non riuscita. Riprova." }, 503);
  } finally { db.release(); }
}

export const PATCH = (request: Request) => changeCatalogue(request, "order");
export const DELETE = (request: Request) => changeCatalogue(request, "delete");
