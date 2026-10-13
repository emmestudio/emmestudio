import 'server-only';
import { getAuth } from './auth';
import { getDb } from './db';
import { ownerAllowed } from './config';
import { calendarAuthorized } from './calendar-policy';
import { CalendarError, googleEvents } from './google-events';
export async function calendarContext(request: Request) {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !ownerAllowed(session.user.email, session.user.emailVerified)) throw new CalendarError(401, 'Accesso richiesto.');
  const [accounts, linked] = await Promise.all([
    auth.api.listUserAccounts({ headers: request.headers }),
    getDb().query("SELECT calendar_id FROM studio_calendar WHERE owner_id=$1 AND state='connected'", [session.user.id])
  ]);
  const account = accounts.find(item => item.providerId === 'google');
  if (!account || !calendarAuthorized(account.scopes) || !linked.rows[0]?.calendar_id) throw new CalendarError(403, 'Collega prima Google Calendar.');
  const token = await auth.api.getAccessToken({ body: { accountId: account.id }, headers: request.headers });
  return { events: googleEvents(linked.rows[0].calendar_id, token.accessToken), calendarId: linked.rows[0].calendar_id as string };
}
