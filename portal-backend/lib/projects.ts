import 'server-only';
import { createHash } from 'node:crypto';
import { getDb } from './db';
import { type ProjectDraft, type StudioProject } from './project-data';
type Row = ProjectDraft & { id: string; version: number; created_at: Date; updated_at: Date };
export function projectView(row: Row): StudioProject { return { id: row.id, version: row.version, title: row.title, artist: row.artist, kind: row.kind, status: row.status, deadline: row.deadline, vision: row.vision, notes: row.notes, music: row.music, live: row.live, image: row.image, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString() }; }
export async function listProjects(ownerId: string) {
  const result = await getDb().query('SELECT * FROM studio_projects WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 501', [ownerId]);
  if (result.rows.length > 500) throw new Error('PROJECT_LIST_NEEDS_PAGINATION');
  return result.rows.map(projectView);
}
export async function createProject(ownerId: string, id: string, draft: ProjectDraft) {
  const digest = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
  const result = await getDb().query(`INSERT INTO studio_projects(id,owner_id,title,artist,kind,status,deadline,vision,notes,music,live,image,request_digest)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO NOTHING RETURNING *`,
    [id, ownerId, draft.title, draft.artist, draft.kind, draft.status, draft.deadline, draft.vision, draft.notes, draft.music, draft.live, draft.image, digest]);
  if (result.rows[0]) return projectView(result.rows[0]);
  const existing = await getDb().query('SELECT * FROM studio_projects WHERE owner_id=$1 AND id=$2 AND request_digest=$3', [ownerId, id, digest]);
  return existing.rows[0] ? projectView(existing.rows[0]) : null;
}
export async function updateProject(ownerId: string, id: string, version: number, draft: ProjectDraft) {
  const result = await getDb().query(`UPDATE studio_projects SET title=$4,artist=$5,kind=$6,status=$7,deadline=$8,vision=$9,notes=$10,music=$11,live=$12,image=$13,version=version+1,updated_at=now()
    WHERE owner_id=$1 AND id=$2 AND version=$3 RETURNING *`, [ownerId, id, version, draft.title, draft.artist, draft.kind, draft.status, draft.deadline, draft.vision, draft.notes, draft.music, draft.live, draft.image]);
  return result.rows[0] ? projectView(result.rows[0]) : null;
}
