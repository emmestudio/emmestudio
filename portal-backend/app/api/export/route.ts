import { workspaceSession } from "@/lib/workspace-session";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
const tables = [
  "studio_artists",
  "studio_projects",
  "studio_tasks",
  "studio_production",
  "studio_production_history",
  "studio_quotes",
  "studio_quote_history",
  "studio_installments",
  "studio_payments",
  "studio_costs",
];
export async function GET(r: Request) {
  const s = await workspaceSession(r.headers);
  if (!s)
    return Response.json({ error: "Accesso richiesto." }, { status: 401 });
  if (s.role !== "admin")
    return Response.json(
      { error: "Riservato all’amministratore." },
      { status: 403 },
    );
  const c = await getDb().connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const data: Record<string, unknown> = {};
    for (const table of tables) {
      const rows = await c.query(
        `SELECT to_jsonb(t)-'owner_id'-'request_digest' AS data FROM ${table} t WHERE owner_id=$1`,
        [s.workspaceOwnerId],
      );
      data[table] = rows.rows.map((r) => r.data);
    }
    const costs = await c.query(
      "SELECT h.* FROM studio_cost_history h JOIN studio_costs c ON c.id=h.cost_id WHERE c.owner_id=$1",
      [s.workspaceOwnerId],
    );
    data.studio_cost_history = costs.rows;
    const members = await c.query(
      "SELECT email,name,role,active,version FROM portal_members WHERE owner_id=$1",
      [s.workspaceOwnerId],
    );
    data.team = members.rows;
    await c.query("COMMIT");
    return new Response(
      JSON.stringify(
        {
          format: "emme-studio-workspace",
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        },
        null,
        2,
      ),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition":
            'attachment; filename="emme-studio-export.json"',
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    await c.query("ROLLBACK");
    return Response.json(
      { error: "Esportazione non disponibile." },
      { status: 503 },
    );
  } finally {
    c.release();
  }
}
