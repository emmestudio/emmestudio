import "server-only";
import { getDb } from "./db";
import { labelPortal, moodyPhoto, type LabelDraft, type LabelEntry } from "./label-catalog-data";

type LabelRow = { id: string; data: LabelDraft; version: number; published: boolean; published_once: boolean; has_image: boolean };
export const labelColumns = "id,data,version,published,published_once,(image IS NOT NULL) AS has_image";

export function labelEntry(row: LabelRow, publicEntry = false): LabelEntry {
  const imagePath = "/api/label-catalog/image/" + row.id + "?v=" + row.version;
  return { ...row.data, id: row.id, version: row.version, published: row.published, publishedOnce: row.published_once,
    photo: row.has_image ? (publicEntry ? labelPortal : "") + imagePath :
      row.data.kind === "artist" && row.data.slug === "moody" ? moodyPhoto : "" };
}

export async function publicLabel() {
  const result = await getDb().query<LabelRow>(
    `SELECT ${labelColumns} FROM studio_label_catalog
     WHERE published AND owner_id IN (SELECT id FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true)
     ORDER BY updated_at DESC`, [process.env.PORTAL_OWNER_EMAIL],
  );
  return result.rows.map(row => labelEntry(row, true));
}
