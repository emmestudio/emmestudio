import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { resolveAssignee } from "./team";
import { type TaskDraft, type StudioTask } from "./task-data";
const select =
  "SELECT t.*,p.title AS project_title,p.status AS project_status FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id";
function view(r: any): StudioTask {
  return {
    id: r.id,
    version: r.version,
    projectId: r.project_id,
    projectTitle: r.project_title,
    projectStatus: r.project_status,
    title: r.title,
    assignee: r.assignee,
    assigneeEmail: r.assignee_email,
    status: r.status,
    priority: r.priority,
    deadline: r.deadline,
    notes: r.notes,
    updatedAt: r.updated_at.toISOString(),
  };
}
export async function listTasks(owner: string) {
  const r = await getDb().query(
    select +
      " WHERE t.owner_id=$1 ORDER BY t.deadline ASC NULLS LAST,t.updated_at DESC LIMIT 5001",
    [owner],
  );
  if (r.rows.length > 5000) throw new Error("TASK_LIST_NEEDS_PAGINATION");
  return r.rows.map(view);
}
export async function saveTask(
  owner: string,
  id: string,
  d: TaskDraft,
  version?: number,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const p = await c.query(
      "SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 AND status<>'Archiviato' FOR UPDATE",
      [owner, d.projectId],
    );
    if (!p.rows[0]) {
      await c.query("ROLLBACK");
      return { error: "Progetto non disponibile o archiviato.", status: 404 };
    }
    const old = await c.query(
      "SELECT * FROM studio_tasks WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    const a =
      old.rows[0]?.assignee_email &&
      old.rows[0].assignee_email === d.assigneeEmail
        ? undefined
        : await resolveAssignee(c, owner, d.assigneeEmail);
    const email =
      a === undefined
        ? (old.rows[0]?.assignee_email ?? null)
        : (a?.email ?? null);
    const name =
      a === undefined && email
        ? (old.rows[0]?.assignee ?? d.assignee)
        : (a?.name ?? d.assignee);
    const values = [
      id,
      owner,
      d.projectId,
      d.title,
      name,
      d.status,
      d.priority,
      d.deadline,
      d.notes,
      email,
    ];
    if (version !== undefined) {
      const r = await c.query(
        "UPDATE studio_tasks SET project_id=$3,title=$4,assignee=$5,status=$6,priority=$7,deadline=$8,notes=$9,assignee_email=$10,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND version=$11 RETURNING id",
        [...values, version],
      );
      if (!r.rows[0]) {
        await c.query("ROLLBACK");
        return {
          error: "L’attività è cambiata. Aggiorna e riaprila.",
          status: 409,
        };
      }
    } else {
      const digest = createHash("sha256")
        .update(JSON.stringify(d))
        .digest("hex");
      if (old.rows[0]) {
        if (old.rows[0].request_digest !== digest) {
          await c.query("ROLLBACK");
          return { error: "Identificativo già utilizzato.", status: 409 };
        }
      } else
        await c.query(
          "INSERT INTO studio_tasks(id,owner_id,project_id,title,assignee,status,priority,deadline,notes,assignee_email,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [...values, digest],
        );
    }
    const saved = await c.query(select + " WHERE t.owner_id=$1 AND t.id=$2", [
      owner,
      id,
    ]);
    await c.query("COMMIT");
    return { task: view(saved.rows[0]), status: 200 };
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      return {
        error: "Seleziona una persona abilitata del team.",
        status: 400,
      };
    throw e;
  } finally {
    c.release();
  }
}
