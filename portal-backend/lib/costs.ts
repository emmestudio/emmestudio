import "server-only";
import { createHash } from "node:crypto";
import { getDb } from "./db";
import { CostInputError, type CostDraft, type StudioCost } from "./cost-data";
export async function listCosts(owner: string): Promise<StudioCost[]> {
  const r = await getDb().query(
    'SELECT id,version,project_id AS "projectId",description,supplier,category,amount,status,due_date AS "dueDate",paid_date AS "paidDate",notes FROM studio_costs WHERE owner_id=$1 ORDER BY updated_at DESC',
    [owner],
  );
  return r.rows;
}
export async function quoteHistory(owner: string, project: string) {
  const r = await getDb().query(
    'SELECT revision,snapshot,recorded_at AS "recordedAt" FROM studio_quote_history WHERE owner_id=$1 AND project_id=$2 ORDER BY revision DESC',
    [owner, project],
  );
  return r.rows;
}
export async function costHistory(owner: string, id: string) {
  const r = await getDb().query(
    'SELECT h.version,h.snapshot,h.recorded_at AS "recordedAt" FROM studio_cost_history h JOIN studio_costs c ON c.id=h.cost_id WHERE c.owner_id=$1 AND c.id=$2 ORDER BY h.version DESC',
    [owner, id],
  );
  return r.rows;
}
export async function saveCost(
  owner: string,
  id: string,
  version: number | undefined,
  d: CostDraft,
) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    const p = await c.query(
      "SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",
      [owner, d.projectId],
    );
    if (!p.rows[0]) throw new CostInputError("Progetto non disponibile.");
    const old = await c.query(
      "SELECT * FROM studio_costs WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    const digest = createHash("sha256").update(JSON.stringify(d)).digest("hex");
    if (!version && old.rows[0]) {
      if (old.rows[0].request_digest !== digest)
        throw new CostInputError("Identificativo già utilizzato.");
      await c.query("COMMIT");
      return;
    }
    if (
      version &&
      (!old.rows[0] ||
        old.rows[0].version !== version ||
        old.rows[0].project_id !== d.projectId)
    )
      throw new CostInputError("Costo modificato. Aggiorna e riaprilo.");
    const v = [
      id,
      owner,
      d.projectId,
      d.description,
      d.supplier,
      d.category,
      d.amount,
      d.status,
      d.dueDate,
      d.paidDate,
      d.notes,
    ];
    if (version)
      await c.query(
        "UPDATE studio_costs SET description=$4,supplier=$5,category=$6,amount=$7,status=$8,due_date=$9,paid_date=$10,notes=$11,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2 AND project_id=$3",
        v,
      );
    else
      await c.query(
        "INSERT INTO studio_costs(id,owner_id,project_id,description,supplier,category,amount,status,due_date,paid_date,notes,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
        [...v, digest],
      );
    await c.query(
      "INSERT INTO studio_cost_history(cost_id,version,snapshot) VALUES($1,$2,$3)",
      [id, version ? version + 1 : 1, JSON.stringify(d)],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
