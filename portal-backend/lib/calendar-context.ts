import 'server-only';
import { getAuth } from './auth';
import { getDb } from './db';
import { workspaceSession } from './workspace-session';
import { canEdit } from './access-policy';
import { calendarAuthorized } from './calendar-policy';
import { CalendarError, googleEvents } from './google-events';
export async function calendarContext(request: Request, writing = false) {
  const auth = getAuth();
  const session = await workspaceSession(request.headers);
  if (!session) throw new CalendarError(401, 'Accesso richiesto.');
  if (writing && !canEdit(session.role)) throw new CalendarError(403, 'Il tuo accesso consente solo la consultazione.');
  const [accounts, linked] = await Promise.all([
    getDb().query('SELECT id,scope FROM account WHERE "userId"=$1 AND "providerId"=$2', [session.workspaceOwnerId, 'google']),
    getDb().query("SELECT calendar_id FROM studio_calendar WHERE owner_id=$1 AND state='connected'", [session.workspaceOwnerId])
  ]);
  const account = accounts.rows[0];
  if (!account || !calendarAuthorized((account.scope ?? '').split(/[ ,]+/)) || !linked.rows[0]?.calendar_id) throw new CalendarError(403, 'Il calendario dello studio deve essere collegato dall’amministratore.');
  // Server-only privileged token read after workspace authorization. Never returned to staff.
  const token = await auth.api.getAccessToken({ body: { accountId: account.id, userId: session.workspaceOwnerId } });
  return { events: googleEvents(linked.rows[0].calendar_id, token.accessToken), calendarId: linked.rows[0].calendar_id as string, canEdit: canEdit(session.role), canOpenGoogle: session.role === 'admin' };
}
