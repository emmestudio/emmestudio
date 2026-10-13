import 'server-only';
import { getDb } from './db';
import { ownerAllowed } from './config';
import { normalizeEmail } from './access-policy';
export async function allowedLogin(email: string, verified: boolean) {
  if (!verified) return false;
  if (ownerAllowed(email, verified)) return true;
  const result = await getDb().query(`SELECT m.email FROM portal_members m JOIN "user" u ON u.id=m.owner_id
    WHERE m.email=$1 AND m.active=true AND lower(u.email)=lower($2) AND u."emailVerified"=true`, [normalizeEmail(email), process.env.PORTAL_OWNER_EMAIL]);
  return Boolean(result.rows[0]);
}
