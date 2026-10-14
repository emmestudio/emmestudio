import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import {
  type ProjectDraft,
  type StudioProject,
  ProjectInputError,
} from "./project-data";
import { type ArtistDraft } from "./artist-data";
import { type QuoteDraft } from "./finance-data";
import { writeQuote } from "./finance";
type Row = ProjectDraft & {
  id: string;
  artist_id: string | null;
  version: number;
  created_at: Date;
  updated_at: Date;
};
export function projectView(row: Row): StudioProject {
  return {
    id: row.id,
    version: row.version,
    title: row.title,
    artist: row.artist,
    artistId: row.artist_id,
    service: row.service,
    kind: row.kind,
    status: row.status,
    deadline: row.deadline,
    vision: row.vision,
    notes: row.notes,
    music: row.music,
    live: row.live,
    image: row.image,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
export async function listProjects(ownerId: string) {
  const r = await getDb().query(
    "SELECT p.*, COALESCE(a.name,p.artist) AS artist FROM studio_projects p LEFT JOIN studio_artists a ON a.id=p.artist_id AND a.owner_id=p.owner_id WHERE p.owner_id=$1 ORDER BY p.updated_at DESC LIMIT 501",
    [ownerId],
  );
  if (r.rows.length > 500) throw new Error("PROJECT_LIST_NEEDS_PAGINATION");
  return r.rows.map(projectView);
}
export type ProjectExtras = {
  newArtist?: { id: string; draft: ArtistDraft };
  quote?: QuoteDraft;
  quoteVersion?: number;
};
export async function saveProject(
  owner: string,
  id: string,
  version: number | undefined,
  d: ProjectDraft,
  extras: ProjectExtras = {},
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const digest = createHash("sha256")
      .update(JSON.stringify({ d, extras }))
      .digest("hex");
    const existing = await c.query(
      "SELECT * FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    if (!version && existing.rows[0]) {
      if (existing.rows[0].request_digest !== digest)
        throw new ProjectInputError(
          "Identificativo già utilizzato. Aggiorna e riapri.",
        );
      await c.query("COMMIT");
      return projectView(existing.rows[0]);
    }
    if (
      version &&
      (!existing.rows[0] || existing.rows[0].version !== version)
    ) {
      await c.query("ROLLBACK");
      return null;
    }
    let artistId = d.artistId;
    if (extras.newArtist) {
      const a = extras.newArtist.draft;
      artistId = extras.newArtist.id;
      await c.query(
        "INSERT INTO studio_artists(id,owner_id,name,email,phone,genre,links,notes,direction,director,objectives) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          artistId,
          owner,
          a.name,
          a.email,
          a.phone,
          a.genre,
          a.links,
          a.notes,
          a.direction,
          a.director,
          a.objectives,
        ],
      );
    }
    if (!artistId)
      throw new ProjectInputError(
        "Seleziona un artista oppure creane uno nuovo.",
      );
    const artist = await c.query(
      "SELECT name FROM studio_artists WHERE owner_id=$1 AND id=$2",
      [owner, artistId],
    );
    if (!artist.rows[0])
      throw new ProjectInputError("Artista non disponibile nello studio.");
    const v = [
      id,
      owner,
      d.title,
      artist.rows[0].name,
      d.kind,
      d.status,
      d.deadline,
      d.vision,
      d.notes,
      d.music,
      d.live,
      d.image,
      artistId,
      d.service ?? "Da definire",
    ];
    const r = version
      ? await c.query(
          `UPDATE studio_projects SET title=$3,artist=$4,kind=$5,status=$6,deadline=$7,vision=$8,notes=$9,music=$10,live=$11,image=$12,artist_id=$13,service=$14,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND version=$15 RETURNING *`,
          [...v, version],
        )
      : await c.query(
          `INSERT INTO studio_projects(id,owner_id,title,artist,kind,status,deadline,vision,notes,music,live,image,artist_id,service,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
          [...v, digest],
        );
    if (extras.quote)
      await writeQuote(c, owner, id, extras.quote, extras.quoteVersion ?? 0);
    await c.query("COMMIT");
    return projectView(r.rows[0]);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export const createProject = (
  owner: string,
  id: string,
  d: ProjectDraft,
  extras?: ProjectExtras,
) => saveProject(owner, id, undefined, d, extras);
export const updateProject = (
  owner: string,
  id: string,
  version: number,
  d: ProjectDraft,
  extras?: ProjectExtras,
) => saveProject(owner, id, version, d, extras);
