import { ownerSession } from '@/lib/owner-session';
import { getDb } from '@/lib/db';
import { MemberInputError, validateMember } from '@/lib/access-policy';
import { sameOrigin } from '@/lib/calendar-policy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  try {
    const session = await ownerSession(request.headers); if (!session) return reply({ error: 'Accesso amministratore richiesto.' }, 403);
    const result = await getDb().query(`SELECT m.email,m.name,m.role,m.active,m.version,
      EXISTS(SELECT 1 FROM "user" u WHERE lower(u.email)=m.email AND u."emailVerified"=true) AS registered
      FROM portal_members m WHERE m.owner_id=$1 ORDER BY m.name`, [session.user.id]);
    return reply({ members: result.rows });
  } catch { return reply({ error: 'Gestione accessi non disponibile. Riprova.' }, 503); }
}
async function save(request: Request, update: boolean) {
  if (!sameOrigin(request.headers.get('origin'), process.env.BETTER_AUTH_URL)) return reply({ error: 'Richiesta non autorizzata.' }, 403);
  try {
    const session = await ownerSession(request.headers); if (!session) return reply({ error: 'Accesso amministratore richiesto.' }, 403);
    const body = await request.json().catch(() => null); const member = validateMember(body?.member, process.env.PORTAL_OWNER_EMAIL!);
    if (update && (!Number.isSafeInteger(body?.version) || body.version < 1)) return reply({ error: 'Versione accesso non valida.' }, 400);
    const result = update ? await getDb().query('UPDATE portal_members SET name=$3,role=$4,active=$5,version=version+1,updated_at=now() WHERE owner_id=$1 AND email=$2 AND version=$6 RETURNING email', [session.user.id, member.email, member.name, member.role, member.active, body.version]) : await getDb().query('INSERT INTO portal_members(owner_id,email,name,role,active) VALUES($1,$2,$3,$4,$5) ON CONFLICT(email) DO NOTHING RETURNING email', [session.user.id, member.email, member.name, member.role, member.active]);
    if (!result.rows[0]) return reply({ error: 'Accesso già presente o modificato da un’altra sessione. Aggiorna l’elenco.' }, 409);
    return reply({ saved: true });
  } catch (error) { return error instanceof MemberInputError ? reply({ error: error.message }, 400) : reply({ error: 'Accesso non salvato. Riprova.' }, 503); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
