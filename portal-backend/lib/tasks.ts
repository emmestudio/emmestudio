import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { validateDependencies } from "./operations-data";
import { resolveAssignee } from "./team";
import { type TaskDraft, type StudioTask } from "./task-data";
const select =
  "SELECT t.*,p.title AS project_title,p.status AS project_status FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id";
function view(r: any): StudioTask {
  return {
    blockedBy: r.blocked_by ?? [],
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
      " WHERE t.owner_id=$1 AND t.deleted_at IS NULL AND p.deleted_at IS NULL ORDER BY t.deadline ASC NULLS LAST,t.updated_at DESC LIMIT 5001",
    [owner],
  );
  if (r.rows.length > 5000) throw new Error("TASK_LIST_NEEDS_PAGINATION");
  return r.rows.map(view);
}
async function rollbackError(c: any, error: string, status: number) {
  await c.query("ROLLBACK");
  return { error, status };
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
      "SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 AND status<>'Archiviato' AND deleted_at IS NULL FOR UPDATE",
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
    if (old.rows[0]?.deleted_at)
      return await rollbackError(c, "Ripristina l’attività dal cestino.", 409);
    if (version === undefined && old.rows[0]) {
      const digest = createHash("sha256")
        .update(JSON.stringify(d))
        .digest("hex");
      if (old.rows[0].request_digest !== digest)
        return await rollbackError(c, "Identificativo già utilizzato.", 409);
      const saved = await c.query(select + " WHERE t.owner_id=$1 AND t.id=$2", [
        owner,
        id,
      ]);
      await c.query("COMMIT");
      return { task: view(saved.rows[0]), status: 200 };
    }
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
    let dependencies: string[];
    try {
      dependencies = validateDependencies(
        d.blockedBy ?? old.rows[0]?.blocked_by ?? [],
      );
    } catch {
      return await rollbackError(c, "Dipendenze non valide.", 400);
    }
    if (old.rows[0] && old.rows[0].project_id !== d.projectId) {
      const refs = await c.query(
        "SELECT id FROM studio_tasks WHERE owner_id=$1 AND deleted_at IS NULL AND blocked_by ? $2 LIMIT 1",
        [owner, id],
      );
      if (dependencies.length || refs.rows[0])
        return await rollbackError(
          c,
          "Rimuovi le dipendenze prima di spostare l’attività in un altro progetto.",
          409,
        );
    }
    const graph = await c.query(
      "SELECT id,status,blocked_by FROM studio_tasks WHERE owner_id=$1 AND project_id=$2 AND deleted_at IS NULL",
      [owner, d.projectId],
    );
    if (
      dependencies.some(
        (dep) => dep === id || !graph.rows.some((t) => t.id === dep),
      )
    )
      return await rollbackError(
        c,
        "Le dipendenze devono essere attività dello stesso progetto.",
        400,
      );
    const reaches = (node: string, seen = new Set<string>()): boolean => {
      if (node === id) return true;
      if (seen.has(node)) return false;
      seen.add(node);
      return (graph.rows.find((t) => t.id === node)?.blocked_by ?? []).some(
        (next: string) => reaches(next, seen),
      );
    };
    if (dependencies.some((dep) => reaches(dep)))
      return await rollbackError(c, "Questa dipendenza crea un ciclo.", 400);
    if (
      d.status !== "Da fare" &&
      dependencies.some(
        (dep) => graph.rows.find((t) => t.id === dep)?.status !== "Completata",
      )
    )
      return await rollbackError(
        c,
        "Completa prima le attività da cui dipende questo lavoro.",
        409,
      );
    if (
      old.rows[0]?.status === "Completata" &&
      d.status !== "Completata" &&
      graph.rows.some(
        (t) =>
          t.id !== id &&
          t.status !== "Da fare" &&
          (t.blocked_by ?? []).includes(id),
      )
    )
      return await rollbackError(
        c,
        "Riporta prima a Da fare le attività dipendenti.",
        409,
      );
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
    await c.query(
      "UPDATE studio_tasks SET blocked_by=$3 WHERE owner_id=$1 AND id=$2",
      [owner, id, JSON.stringify(dependencies)],
    );
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
