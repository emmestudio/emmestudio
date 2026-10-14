import "server-only";
import { resolveAssignee } from "./team";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import {
  ProductionInputError,
  type ProductionDraft,
  type ProductionItem,
} from "./production-data";
export async function listProduction(owner: string): Promise<ProductionItem[]> {
  const r = await getDb().query(
    "SELECT id,version,data,updated_at FROM studio_production WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 5001",
    [owner],
  );
  if (r.rows.length > 5000) throw new Error("PRODUCTION_NEEDS_PAGINATION");
  return r.rows.map((r) => ({
    ...r.data,
    id: r.id,
    version: r.version,
    updatedAt: r.updated_at.toISOString(),
  }));
}
export async function productionHistory(owner: string, id: string) {
  const r = await getDb().query(
    'SELECT version,actor,recorded_at AS "recordedAt",data FROM studio_production_history WHERE owner_id=$1 AND item_id=$2 ORDER BY version DESC',
    [owner, id],
  );
  return r.rows;
}
export async function saveProduction(
  owner: string,
  id: string,
  version: number | undefined,
  d: ProductionDraft,
  actor: string,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const p = await c.query(
      "SELECT status FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, d.projectId],
    );
    if (!p.rows[0] || p.rows[0].status === "Archiviato")
      throw new ProductionInputError(
        "Il progetto non è disponibile oppure è archiviato.",
      );
    const old = await c.query(
      "SELECT * FROM studio_production WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    const digest = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    if (!version && old.rows[0]) {
      if (old.rows[0].request_digest !== digest)
        throw new ProductionInputError("Identificativo già utilizzato.");
      await c.query("COMMIT");
      return;
    }
    if (
      version &&
      (!old.rows[0] ||
        old.rows[0].version !== version ||
        old.rows[0].project_id !== d.projectId ||
        old.rows[0].kind !== d.kind)
    )
      throw new ProductionInputError(
        "Scheda modificata. Aggiorna prima di riprovare.",
      );
    if (d.trackId) {
      const track = await c.query(
        "SELECT id FROM studio_production WHERE owner_id=$1 AND project_id=$2 AND id=$3 AND kind='track'",
        [owner, d.projectId, d.trackId],
      );
      if (!track.rows[0])
        throw new ProductionInputError(
          "Il brano deve appartenere a questo progetto.",
        );
    }
    const a =
      old.rows[0]?.data?.assigneeEmail &&
      old.rows[0].data.assigneeEmail === d.assigneeEmail
        ? undefined
        : await resolveAssignee(c, owner, d.assigneeEmail);
    d = {
      ...d,
      assigneeEmail:
        a === undefined
          ? (old.rows[0]?.data?.assigneeEmail ?? null)
          : (a?.email ?? null),
      assignee:
        a === undefined && old.rows[0]?.data?.assigneeEmail
          ? old.rows[0].data.assignee
          : (a?.name ?? d.assignee),
    };
    if (d.kind === "track" && d.status === "Consegnato") {
      const missing = await c.query(
        "SELECT id FROM studio_delivery WHERE owner_id=$1 AND project_id=$2 AND track_id=$3 AND required=true AND done=false LIMIT 1",
        [owner, d.projectId, id],
      );
      if (missing.rows[0])
        throw new ProductionInputError(
          "Completa le verifiche obbligatorie del brano prima della consegna.",
        );
    }
    const next = version ? version + 1 : 1;
    if (version)
      await c.query(
        "UPDATE studio_production SET data=$3,version=$4,updated_at=now() WHERE owner_id=$1 AND id=$2",
        [owner, id, JSON.stringify(d), next],
      );
    else
      await c.query(
        "INSERT INTO studio_production(id,owner_id,project_id,kind,data,request_digest) VALUES($1,$2,$3,$4,$5,$6)",
        [id, owner, d.projectId, d.kind, JSON.stringify(d), digest],
      );
    await c.query(
      "INSERT INTO studio_production_history(item_id,owner_id,version,data,actor) VALUES($1,$2,$3,$4,$5)",
      [id, owner, next, JSON.stringify(d), actor],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    if (e instanceof Error && e.message === "ASSIGNEE_INVALID")
      throw new ProductionInputError(
        "Seleziona una persona abilitata del team.",
      );
    throw e;
  } finally {
    c.release();
  }
}
