import 'server-only';
import { getDb } from './db';
import { ownerAllowed } from './config';
import { normalizeEmail } from './access-policy';
export async function allowedLogin(email: string, verified: boolean) {
  if (!verified) return false;
  if (ownerAllowed(email, verified)) return true;
  const result = await getDb().query(`SELECT m.email FROM portal_members m JOIN "user" u ON u.id=m.owner_id
    WHERE m.email=$1 AND m.active=true AND lower(u.email)=lower($2) AND u."emailVerified"=true`, [normalizeEmail(email), process.env.PORTAL_OWNER_EMAIL]);
  if (result.rows[0]) return true;
  // Artists can authenticate with verified Google email, but never become team members.
  const artist=await getDb().query(`SELECT 1 FROM studio_artist_access x
    JOIN "user" u ON u.id=x.owner_id
    JOIN studio_artists a ON a.owner_id=x.owner_id AND a.id=x.artist_id
    WHERE lower(x.email)=$1 AND x.enabled=true AND a.deleted_at IS NULL
    AND lower(u.email)=lower($2) AND u."emailVerified"=true LIMIT 1`,
    [normalizeEmail(email),process.env.PORTAL_OWNER_EMAIL]);
  return Boolean(artist.rows[0]);
}
