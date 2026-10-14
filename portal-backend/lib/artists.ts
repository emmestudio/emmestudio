import "server-only";
import { getDb } from "./db";
import { type ArtistDraft, type StudioArtist } from "./artist-data";
export async function listArtists(owner: string): Promise<StudioArtist[]> {
  const r = await getDb().query(
    "SELECT id,version,name,email,phone,genre,links,notes,direction,director,objectives FROM studio_artists WHERE owner_id=$1 ORDER BY lower(name),id LIMIT 1001",
    [owner],
  );
  if (r.rows.length > 1000) throw new Error("ARTIST_LIST_NEEDS_PAGINATION");
  return r.rows;
}
export async function saveArtist(
  owner: string,
  id: string,
  version: number | undefined,
  d: ArtistDraft,
) {
  const values = [
    id,
    owner,
    d.name,
    d.email,
    d.phone,
    d.genre,
    d.links,
    d.notes,
    d.direction,
    d.director,
    d.objectives,
  ];
  const r = version
    ? await getDb().query(
        `UPDATE studio_artists SET name=$3,email=$4,phone=$5,genre=$6,links=$7,notes=$8,direction=$9,director=$10,objectives=$11,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND version=$12 RETURNING id`,
        [...values, version],
      )
    : await getDb().query(
        `INSERT INTO studio_artists(id,owner_id,name,email,phone,genre,links,notes,direction,director,objectives) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING RETURNING id`,
        values,
      );
  return Boolean(r.rows[0]);
}
