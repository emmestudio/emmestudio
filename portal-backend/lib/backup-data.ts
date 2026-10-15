import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
export const backupTables = [
  "studio_artists",
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
  "studio_cost_history",
  "studio_workflow",
  "studio_hours",
  "studio_delivery",
  "studio_work_history",
  "portal_members",
];
export async function restoreBusinessExport(
  c: Pick<PoolClient, "query">,
  owner: string,
  input: unknown,
) {
  const backup = input as {
    format?: string;
    version?: number;
    data?: Record<string, unknown>;
  } | null;
  if (
    !backup ||
    backup.format !== "emme-studio-workspace" ||
    ![1, 2, 3].includes(backup.version ?? 0) ||
    !backup.data ||
    Object.keys(backup.data).some(
      (k) => !backupTables.includes(k) && k !== "team",
    )
  )
    throw new Error("RESTORE_INVALID_FORMAT");
  const data = { ...backup.data };
  if((backup.version ?? 0)<3)data.studio_finance_targets=[];
  if (backup.version === 1)
    for (const k of [
      "studio_workflow",
      "studio_hours",
      "studio_delivery",
      "studio_work_history",
    ])
      data[k] ??= [];
  for (const table of backupTables) {
    const rows = data[table === "portal_members" ? "team" : table];
    if (!Array.isArray(rows) || rows.length > 100000)
      throw new Error("RESTORE_INCOMPLETE_EXPORT");
  }
  await c.query("BEGIN");
  try {
    await c.query("SELECT pg_advisory_xact_lock(187346212)");
    const user = await c.query('SELECT id FROM "user" WHERE id=$1', [owner]);
    if (!user.rows[0]) throw new Error("RESTORE_OWNER_NOT_FOUND");
    for (const table of backupTables) {
      const count = await c.query(`SELECT count(*) AS count FROM ${table}`);
      if (Number(count.rows[0].count) > 0)
        throw new Error("RESTORE_TARGET_NOT_EMPTY");
    }
    for (const table of backupTables) {
      const metadata = await c.query(
        "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
        [table],
      );
      const columns = new Map<string, string>(
        metadata.rows.map((r) => [r.column_name, r.data_type]),
      );
      for (const raw of data[
        table === "portal_members" ? "team" : table
      ] as unknown[]) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new Error("RESTORE_INVALID_ROW");
        const row = { ...(raw as Record<string, unknown>) };
        if (
          Object.keys(row).some(
            (k) =>
              !columns.has(k) || ["owner_id", "request_digest"].includes(k),
          )
        )
          throw new Error("RESTORE_UNKNOWN_COLUMN");
        if (columns.has("owner_id")) row.owner_id = owner;
        if (columns.has("request_digest"))
          row.request_digest = createHash("sha256")
            .update(JSON.stringify(raw))
            .digest("hex");
        if (table === "portal_members") row.active = false;
        const keys = Object.keys(row);
        const values = keys.map((k) =>
          ["json", "jsonb"].includes(columns.get(k) ?? "")
            ? JSON.stringify(row[k])
            : row[k],
        );
        await c.query(
          `INSERT INTO ${table}(${keys.map((k) => '"' + k + '"').join(",")}) VALUES(${keys.map((_, i) => "$" + (i + 1)).join(",")})${table === "studio_finance_targets" ? " ON CONFLICT(id) DO NOTHING" : ""}`,
          values,
        );
        if(table === "studio_finance_targets"){
          const match=await c.query("SELECT id FROM studio_finance_targets WHERE id=$1 AND owner_id=$2 AND project_id IS NOT DISTINCT FROM $3::uuid AND production_id IS NOT DISTINCT FROM $4::uuid",[row.id,owner,row.project_id??null,row.production_id??null]);
          if(!match.rows[0])throw new Error("RESTORE_FINANCE_TARGET_CONFLICT");
        }
      }
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  }
}
