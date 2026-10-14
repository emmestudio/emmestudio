import "server-only";
import { getDb } from "./db";
import { resolveAssignee } from "./team";
import { validateOperations, emptyOperations } from "./operations-data";
import { validId } from "./task-data";
export class OperationsError extends Error {}
const resources = {
  project: { table: "studio_projects", title: "title" },
  production: { table: "studio_production", title: "data->>'title'" },
  task: { table: "studio_tasks", title: "title" },
  artist: { table: "studio_artists", title: "name" },
} as const;
export type ResourceKind = keyof typeof resources;
export async function saveOperations(
  owner: string,
  id: string,
  version: number,
  input: unknown,
  actor: string,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM studio_projects WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",
      [owner, id],
    );
    const p = r.rows[0];
    if (!p || p.version !== version)
      throw new OperationsError(
        "Progetto modificato o non disponibile. Aggiorna e riapri.",
      );
    let d;
    try {
      d = validateOperations(input, p.kind);
    } catch {
      throw new OperationsError(
        "Controlla fase, prossimo passo e data di ricontatto.",
      );
    }
    const previous = { ...emptyOperations(), ...p.operations };
    for (const email of [d.leadEmail, ...d.collaborators].filter(Boolean))
      if (
        email !== previous.leadEmail &&
        !previous.collaborators.includes(email)
      )
        await resolveAssignee(c, owner, email);
    await c.query(
      "UPDATE studio_projects SET operations=$3,version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$2",
      [owner, id, JSON.stringify(d)],
    );
    await c.query(
      "INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,'operations',$3,$4,$5)",
      [id, owner, version + 1, JSON.stringify(d), actor],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      throw new OperationsError("Seleziona persone abilitate del team.");
    throw e;
  } finally {
    c.release();
  }
}
export async function listTrash(owner: string) {
  const result = [];
  for (const [kind, spec] of Object.entries(resources)) {
    const r = await getDb().query(
      `SELECT id,version,${spec.title} AS title,deleted_at AS "deletedAt" FROM ${spec.table} WHERE owner_id=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
      [owner],
    );
    result.push(...r.rows.map((p) => ({ ...p, kind })));
  }
  return result.sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
  );
}
export async function trashResource(
  owner: string,
  kind: ResourceKind,
  id: string,
  version: number,
  restore: boolean,
  confirmation: string,
  actor: string,
) {
  if (!Object.hasOwn(resources, kind) || !validId(id))
    throw new OperationsError("Identificativo non valido.");
  const spec = resources[kind],
    c = await getDb().connect();
  try {
    await c.query("BEGIN");
    // A common workspace lock serializes trash/restore operations and dependency checks.
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,2))", [
      owner,
    ]);
    let r = await c.query(
      `SELECT *,${spec.title} AS label FROM ${spec.table} WHERE owner_id=$1 AND id=$2`,
      [owner, id],
    );
    let p = r.rows[0];
    if (!p) throw new OperationsError("Scheda non disponibile.");
    // Lock the project first, matching production/task writers, then the child resource.
    if (p.project_id) {
      const parent = await c.query(
        "SELECT deleted_at FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, p.project_id],
      );
      if (parent.rows[0]?.deleted_at)
        throw new OperationsError("Ripristina prima il progetto collegato.");
    }
    r = await c.query(
      `SELECT *,${spec.title} AS label FROM ${spec.table} WHERE owner_id=$1 AND id=$2 FOR UPDATE`,
      [owner, id],
    );
    p = r.rows[0];
    if (p.version !== version || Boolean(p.deleted_at) !== restore)
      throw new OperationsError("Scheda modificata. Aggiorna e riprova.");
    if (!restore && confirmation !== p.label)
      throw new OperationsError(
        "Scrivi il titolo esatto per confermare l’eliminazione.",
      );
    if (kind === "artist" && !restore) {
      const links = await c.query(
        "SELECT id FROM studio_projects WHERE owner_id=$1 AND artist_id=$2 AND deleted_at IS NULL LIMIT 1",
        [owner, id],
      );
      if (links.rows[0])
        throw new OperationsError(
          "Elimina o riassegna prima i progetti attivi di questo artista.",
        );
    }
    if (kind === "project" && restore && p.artist_id) {
      const a = await c.query(
        "SELECT deleted_at FROM studio_artists WHERE owner_id=$1 AND id=$2 FOR UPDATE",
        [owner, p.artist_id],
      );
      if (a.rows[0]?.deleted_at)
        throw new OperationsError("Ripristina prima l’artista collegato.");
    }
    if (kind === "production" && restore && p.kind === "track") {
      const missing = await c.query(
        "SELECT d.id FROM studio_delivery d JOIN studio_projects pr ON pr.id=d.project_id AND pr.owner_id=d.owner_id WHERE d.owner_id=$1 AND d.track_id=$2 AND d.required AND NOT d.done AND pr.status='Completato' LIMIT 1",
        [owner, id],
      );
      if (missing.rows[0])
        throw new OperationsError(
          "Riattiva prima il progetto: il brano ha verifiche obbligatorie da completare.",
        );
    }
    if (kind === "production" && restore && p.data.trackId) {
      const track = await c.query(
        "SELECT deleted_at FROM studio_production WHERE owner_id=$1 AND id=$2 AND kind='track'",
        [owner, p.data.trackId],
      );
      if (!track.rows[0] || track.rows[0].deleted_at)
        throw new OperationsError("Ripristina prima il brano collegato.");
    }
    if (kind === "task" && !restore) {
      const dependents = await c.query(
        "SELECT id FROM studio_tasks WHERE owner_id=$1 AND deleted_at IS NULL AND status<>'Completata' AND blocked_by ? $2 LIMIT 1",
        [owner, id],
      );
      if (dependents.rows[0])
        throw new OperationsError(
          "Rimuovi prima le dipendenze delle attività collegate.",
        );
    }
    await c.query(
      `UPDATE ${spec.table} SET deleted_at=${restore ? "NULL" : "now()"},version=version+1,updated_at=now() WHERE owner_id=$1 AND id=$2`,
      [owner, id],
    );
    await c.query(
      "INSERT INTO studio_work_history(resource_id,owner_id,kind,version,snapshot,actor) VALUES($1,$2,$3,$4,$5,$6)",
      [
        id,
        owner,
        "trash-" + kind,
        version + 1,
        JSON.stringify({
          action: restore ? "restore" : "delete",
          title: p.label,
        }),
        actor,
      ],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
