import 'server-only';
import { getAuth } from './auth';
import { configurationReady, ownerAllowed } from './config';
import { getDb } from './db';
import { normalizeEmail, type WorkspaceRole } from './access-policy';
export async function workspaceSession(headers: Headers) {
  if (!configurationReady()) return null;
  const session = await getAuth().api.getSession({ headers });
  if (!session?.user.emailVerified) return null;
  if (ownerAllowed(session.user.email, session.user.emailVerified)) return { ...session, workspaceOwnerId: session.user.id, role: 'admin' as WorkspaceRole };
  // Check the database on every request: revocation also blocks previously issued sessions.
  const result = await getDb().query(`SELECT m.owner_id,m.role FROM portal_members m JOIN "user" u ON u.id=m.owner_id
    WHERE m.email=$1 AND m.active=true AND lower(u.email)=lower($2) AND u."emailVerified"=true`, [normalizeEmail(session.user.email), process.env.PORTAL_OWNER_EMAIL]);
  const member = result.rows[0];
  return member ? { ...session, workspaceOwnerId: member.owner_id as string, role: member.role as WorkspaceRole } : null;
}
