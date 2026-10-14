import "server-only";
import { getDb } from "./db";
import type { PoolClient } from "pg";
export type TeamPerson = { email: string; name: string; role: string };
export async function listTeam(owner: string): Promise<TeamPerson[]> {
  const r = await getDb().query(
    `SELECT lower(email) AS email,name,'admin' AS role FROM "user" WHERE id=$1 UNION ALL SELECT email,name,role FROM portal_members WHERE owner_id=$1 AND active=true ORDER BY name`,
    [owner],
  );
  return r.rows;
}
export async function resolveAssignee(
  c: Pick<PoolClient, "query">,
  owner: string,
  email: unknown,
) {
  if (email === undefined) return undefined;
  if (email === null || email === "") return null;
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email)
  )
    throw new Error("ASSIGNEE_INVALID");
  const normalized = email.trim().toLowerCase();
  const r = await c.query(
    `SELECT name FROM "user" WHERE id=$1 AND lower(email)=$2 UNION ALL SELECT name FROM portal_members WHERE owner_id=$1 AND email=$2 AND active=true`,
    [owner, normalized],
  );
  if (!r.rows[0]) throw new Error("ASSIGNEE_INVALID");
  return { email: normalized, name: r.rows[0].name };
}
