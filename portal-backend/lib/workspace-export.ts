import "server-only";
import {extraArchiveTables} from "./archive-tables";
import { getDb } from "./db";
const tables = [
  "studio_artists",
  "studio_drive_folders",
  "studio_projects",
  "studio_tasks",
  "studio_production",
  "studio_production_history",
  "studio_finance_targets",
  "studio_quotes",
  "studio_quote_history",
  "studio_installments",
  "studio_payments",
  "studio_costs",
  "studio_workflow",
  "studio_hours",
  "studio_delivery",
  "studio_work_history",
];
export async function exportWorkspace(owner: string) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown> = {};
    for (const table of tables) {
      const rows = await c.query(
        `SELECT to_jsonb(t)-'owner_id'-'request_digest' AS data FROM ${table} t WHERE owner_id=$1`,
        [owner],
      );
      data[table] = rows.rows.map((r) => r.data);
    }
    const costs = await c.query(
      "SELECT h.* FROM studio_cost_history h JOIN studio_costs c ON c.id=h.cost_id WHERE c.owner_id=$1",
      [owner],
    );
    data.studio_cost_history = costs.rows;
    const members = await c.query(
      "SELECT email,name,role,active,version FROM portal_members WHERE owner_id=$1",
      [owner],
    );
    data.team = members.rows;
    for(const table of extraArchiveTables){
      const exists=await c.query("SELECT to_regclass($1) AS name",["public."+table]);
      data[table]=exists.rows[0]?.name ? (await c.query(`SELECT to_jsonb(t)-'owner_id' AS data FROM ${table} t WHERE owner_id=$1`,[owner])).rows.map(r=>r.data) : [];
    }
    await c.query("COMMIT");
    return {
      format: "emme-studio-workspace",
      version: 5,
      exportedAt: new Date().toISOString(),
      data,
    };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
