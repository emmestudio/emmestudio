import { getAuth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ownerAllowed } from '@/lib/config';
import { calendarAuthorized, sameOrigin } from '@/lib/calendar-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function context(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !ownerAllowed(session.user.email, session.user.emailVerified)) return null;
  const accounts = await auth.api.listUserAccounts({ headers: request.headers });
  const google = accounts.find(account => account.providerId === 'google');
  return { auth, session, google };
}

export async function GET(request: Request) {
  try {
    const ctx = await context(request);
    if (!ctx) return reply({ error: 'Accesso richiesto.' }, 401);
    const permission = Boolean(ctx.google && calendarAuthorized(ctx.google.scopes));
    const result = await getDb().query('SELECT calendar_id, state FROM studio_calendar WHERE owner_id=$1', [ctx.session.user.id]);
    const row = result.rows[0];
    return reply({ permission, state: row?.state ?? 'idle', connected: Boolean(row?.calendar_id), calendarName: row?.calendar_id ? 'Emme Studio — Appuntamenti' : null });
  } catch { return reply({ error: 'Impossibile verificare il collegamento. Riprova tra poco.' }, 503); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get('origin'), process.env.BETTER_AUTH_URL)) return reply({ error: 'Richiesta non autorizzata.' }, 403);
  try {
    const ctx = await context(request);
    if (!ctx) return reply({ error: 'Accesso richiesto.' }, 401);
    if (!ctx.google || !calendarAuthorized(ctx.google.scopes)) return reply({ error: 'Autorizza prima Google Calendar.' }, 403);
    const token = await ctx.auth.api.getAccessToken({ body: { accountId: ctx.google.id }, headers: request.headers });
    const client = await getDb().connect();
    try {
      await client.query('SELECT pg_advisory_lock(187346208)');
      try {
        await client.query("INSERT INTO studio_calendar(owner_id,state) VALUES($1,'idle') ON CONFLICT(owner_id) DO NOTHING", [ctx.session.user.id]);
        const selected = await client.query('SELECT calendar_id,state FROM studio_calendar WHERE owner_id=$1', [ctx.session.user.id]);
        const row = selected.rows[0];
        if (row.calendar_id) return reply({ connected: true });
        if (row.state !== 'idle') return reply({ error: 'La creazione precedente deve essere verificata prima di riprovare. Contatta il team.', state: row.state }, 409);
        // Persist intent before external write. Never create a duplicate after an ambiguous failure.
        await client.query("UPDATE studio_calendar SET state='creating',updated_at=now() WHERE owner_id=$1", [ctx.session.user.id]);
        let createdId: string | undefined;
        try {
          const response = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
            method: 'POST', headers: { Authorization: `Bearer ${token.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ summary: 'Emme Studio — Appuntamenti', description: 'Appuntamenti del team Emme Studio, gestiti dal portale.', timeZone: 'Europe/Rome' }),
            signal: AbortSignal.timeout(15000), cache: 'no-store'
          });
          if (!response.ok) {
            // Rejected requests did not create a resource. Server errors may be ambiguous.
            const state = response.status >= 500 ? 'uncertain' : 'idle';
            await client.query('UPDATE studio_calendar SET state=$2,updated_at=now() WHERE owner_id=$1', [ctx.session.user.id, state]);
            return reply({ error: response.status === 403 ? 'Google non ha consentito la creazione. Verifica che Calendar API sia abilitata e autorizza nuovamente Calendar.' : 'Google non ha completato la richiesta. Riprova o verifica il collegamento.', state }, 502);
          }
          const calendar = await response.json() as { id?: string };
          if (!calendar.id) throw new Error('MISSING_CALENDAR_ID');
          createdId = calendar.id;
          await client.query("UPDATE studio_calendar SET calendar_id=$2,state='connected',updated_at=now() WHERE owner_id=$1", [ctx.session.user.id, createdId]);
          return reply({ connected: true });
        } catch {
          // Preserve a returned calendar ID when possible; do not automatically repeat POST to Google.
          await client.query("UPDATE studio_calendar SET calendar_id=COALESCE($2,calendar_id),state=$3,updated_at=now() WHERE owner_id=$1", [ctx.session.user.id, createdId ?? null, createdId ? 'connected' : 'uncertain']).catch(() => {});
          return reply({ error: 'Esito della creazione da verificare. Non verrà creato un secondo calendario automaticamente.' }, 503);
        }
      } finally { await client.query('SELECT pg_advisory_unlock(187346208)'); }
    } finally { client.release(); }
  } catch { return reply({ error: 'Collegamento non disponibile. Autorizza nuovamente Google Calendar e riprova.' }, 503); }
}
