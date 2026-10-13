// Explicit one-time deployment verification. Creates and removes only its own temporary event.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { betterAuth } from 'better-auth';
import { CalendarError, googleEvents } from '../lib/google-events.ts';
if (process.env.VERCEL_PROJECT_ID !== 'prj_wYBGT1TA8DnuvDY0fIaYnLS1P8MK' || process.env.VERCEL_ENV !== 'production') throw new Error('VERIFY_WRONG_PROJECT');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 15000 });
const eventId = 'e' + randomUUID().replaceAll('-', '');
let api; let created = false; let removed = false;
try {
  const result = await pool.query(`SELECT a.id AS account_id,u.id AS user_id,c.calendar_id
    FROM "user" u JOIN account a ON a."userId"=u.id JOIN studio_calendar c ON c.owner_id=u.id
    WHERE lower(u.email)=lower($1) AND u."emailVerified"=true AND a."providerId"='google' AND c.state='connected'`, [process.env.PORTAL_OWNER_EMAIL]);
  if (result.rows.length !== 1) throw new Error('VERIFY_CALENDAR_NOT_CONNECTED');
  const row = result.rows[0];
  const auth = betterAuth({ database: pool, secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL,
    account: { encryptOAuthTokens: true }, socialProviders: { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } } });
  const token = await auth.api.getAccessToken({ body: { accountId: row.account_id, userId: row.user_id } });
  api = googleEvents(row.calendar_id, token.accessToken);
  const start = new Date(Date.now() + 86400000); start.setUTCHours(10, 0, 0, 0);
  const end = new Date(start.getTime() + 1800000);
  const draft = { title: 'TEST TEMPORANEO EMME STUDIO — verifica automatica', description: 'Evento tecnico temporaneo: viene rimosso al termine della verifica. Nessun invito.', location: 'Test portale', category: 'Altro', allDay: false, start: start.toISOString(), end: end.toISOString() };
  const first = await api.create(eventId, draft); created = true;
  assert.equal(first.summary, draft.title);
  assert.equal((await api.create(eventId, draft)).id, eventId);
  const changed = await api.update(eventId, first.etag, { ...draft, title: draft.title + ' · aggiornato' });
  await assert.rejects(api.update(eventId, first.etag, draft), error => error instanceof CalendarError && error.status === 412);
  assert.equal((await api.get(eventId)).summary, changed.summary);
  const list = await api.list(new Date(start.getTime() - 86400000).toISOString(), new Date(end.getTime() + 86400000).toISOString());
  assert.equal(list.find(event => event.id === eventId)?.summary, changed.summary);
  const day = start.toISOString().slice(0, 10);
  const followingDay = new Date(start.getTime() + 86400000).toISOString().slice(0, 10);
  const daily = await api.update(eventId, changed.etag, { ...draft, allDay: true, start: day, end: followingDay });
  assert.equal(daily.start.date, day);
  const timed = await api.update(eventId, daily.etag, draft);
  assert.ok(timed.start.dateTime);
  await api.remove(eventId, timed.etag); removed = true;
  await assert.rejects(api.get(eventId), error => error instanceof CalendarError && [404, 410].includes(error.status));
  console.log('CALENDAR_VERIFIED: create, retry, update, conflict, list, all-day conversion and delete. Temporary event removed.');
} catch (error) {
  console.error('CALENDAR_VERIFICATION_FAILED:', error instanceof CalendarError ? error.status : error.message?.startsWith('VERIFY_') ? error.message : 'CHECK_FAILED');
  process.exitCode = 1;
} finally {
  if (api && !removed) {
    try { const event = await api.get(eventId); if (event.summary?.startsWith('TEST TEMPORANEO EMME STUDIO')) { await api.remove(eventId, event.etag); console.log('CALENDAR_TEST_EVENT_CLEANED_UP'); } }
    catch (error) { if (created && !(error instanceof CalendarError && [404, 410].includes(error.status))) { console.error('CALENDAR_TEST_CLEANUP_NEEDS_REVIEW'); process.exitCode = 1; } }
  }
  await pool.end();
}
