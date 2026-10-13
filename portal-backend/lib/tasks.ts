import 'server-only';
import { createHash } from 'node:crypto';
import { getDb } from './db';
import { type TaskDraft, type StudioTask } from './task-data';
type Row = Omit<TaskDraft, 'projectId'> & { id: string; version: number; project_id: string; project_title: string; project_status: string; updated_at: Date };
function view(row: Row): StudioTask { return { id: row.id, version: row.version, projectId: row.project_id, projectTitle: row.project_title, projectStatus: row.project_status, title: row.title, assignee: row.assignee, status: row.status, priority: row.priority, deadline: row.deadline, notes: row.notes, updatedAt: row.updated_at.toISOString() }; }
const select = 'SELECT t.*,p.title AS project_title,p.status AS project_status FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id';
export async function listTasks(ownerId: string) {
  const result = await getDb().query(select + " WHERE t.owner_id=$1 ORDER BY t.deadline ASC NULLS LAST, CASE t.priority WHEN 'Alta' THEN 0 WHEN 'Normale' THEN 1 ELSE 2 END,t.updated_at DESC LIMIT 1001", [ownerId]);
  if (result.rows.length > 1000) throw new Error('TASK_LIST_NEEDS_PAGINATION');
  return result.rows.map(view);
}
export async function saveTask(ownerId: string, id: string, draft: TaskDraft, version?: number) {
  const project = await getDb().query("SELECT id FROM studio_projects WHERE id=$1 AND owner_id=$2 AND status<>'Archiviato'", [draft.projectId, ownerId]);
  if (!project.rows[0]) return { error: 'Progetto non disponibile o archiviato.', status: 404 };
  const values = [id, ownerId, draft.projectId, draft.title, draft.assignee, draft.status, draft.priority, draft.deadline, draft.notes];
  let result;
  if (version !== undefined) {
    result = await getDb().query('UPDATE studio_tasks SET project_id=$3,title=$4,assignee=$5,status=$6,priority=$7,deadline=$8,notes=$9,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND version=$10 RETURNING id', [...values, version]);
    if (!result.rows[0]) return { error: 'L’attività è cambiata. Aggiorna la bacheca e riaprila.', status: 409 };
  } else {
    const digest = createHash('sha256').update(JSON.stringify(draft)).digest('hex');
    result = await getDb().query('INSERT INTO studio_tasks(id,owner_id,project_id,title,assignee,status,priority,deadline,notes,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO NOTHING RETURNING id', [...values, digest]);
    if (!result.rows[0]) {
      const existing = await getDb().query('SELECT id FROM studio_tasks WHERE owner_id=$1 AND id=$2 AND request_digest=$3', [ownerId, id, digest]);
      if (!existing.rows[0]) return { error: 'Una richiesta precedente è già salvata con dati diversi. Aggiorna la bacheca.', status: 409 };
    }
  }
  const saved = await getDb().query(select + ' WHERE t.owner_id=$1 AND t.id=$2', [ownerId, id]);
  return { task: view(saved.rows[0]), status: 200 };
}
