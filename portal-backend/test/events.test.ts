import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plusDay, romeLocal, validateDraft } from '../lib/event-data.ts';
import { CalendarError, draftDigest, googleEvents, type GoogleEvent } from '../lib/google-events.ts';
const draft = { title: 'Sessione', description: 'Note', location: 'Studio', category: 'Registrazione', allDay: false, start: '2026-10-14T08:00:00.000Z', end: '2026-10-14T09:00:00.000Z' };
test('Rome conversion handles summer, winter and invalid DST hours', () => {
  assert.equal(romeLocal('2026-10-14T10:00'), draft.start);
  assert.equal(romeLocal('2026-12-14T10:00'), '2026-12-14T09:00:00.000Z');
  assert.throws(() => romeLocal('2026-03-29T02:30'), /non esiste/);
  assert.throws(() => romeLocal('2026-10-25T02:30'), /si ripete/);
  assert.throws(() => romeLocal('2026-02-30T10:00'), /non valido/);
});
test('all-day exclusive end handles month and leap year boundaries', () => {
  assert.equal(plusDay('2026-10-31'), '2026-11-01');
  assert.equal(plusDay('2028-02-28'), '2028-02-29');
  assert.throws(() => validateDraft({ ...draft, end: draft.start }), /fine/);
  assert.throws(() => validateDraft({ ...draft, title: '' }), /titolo/);
  assert.throws(() => validateDraft({ ...draft, start: '2026-02-30T10:00:00Z', end: '2026-03-03T10:00:00Z' }), /orari/);
});
test('event listing follows pagination and skips cancelled events', async () => {
  const queries: string[] = [];
  const stub = (async (url: string | URL | Request) => {
    queries.push(String(url));
    return Response.json(queries.length === 1 ? { items: [{ id: 'one', status: 'confirmed' }, { id: 'gone', status: 'cancelled' }], nextPageToken: 'next' } : { items: [{ id: 'two', status: 'confirmed' }] });
  }) as typeof fetch;
  const events = await googleEvents('calendar@example.com', 'test-token', stub).list(draft.start, draft.end);
  assert.deepEqual(events.map(event => event.id), ['one', 'two']);
  assert.match(queries[1], /pageToken=next/);
});
test('retry of the same creation returns the existing event', async () => {
  let count = 0;
  const stub = (async () => ++count === 1 ? new Response('', { status: 409 }) : Response.json({ id: 'saved', extendedProperties: { private: { emmeRequestDigest: draftDigest(validateDraft(draft)) } } })) as typeof fetch;
  assert.equal((await googleEvents('calendar', 'token', stub).create('e' + 'a'.repeat(32), draft)).id, 'saved');
});
test('changed payload cannot reuse an ambiguous creation ID', async () => {
  let count = 0;
  const stub = (async () => ++count === 1 ? new Response('', { status: 409 }) : Response.json({ id: 'saved', extendedProperties: { private: { emmeRequestDigest: 'different' } } })) as typeof fetch;
  await assert.rejects(googleEvents('calendar', 'token', stub).create('e' + 'a'.repeat(32), draft), error => error instanceof CalendarError && error.status === 409);
});
test('concurrent update uses original etag and surfaces conflict', async () => {
  let count = 0;
  const stub = (async (_url: unknown, init: RequestInit) => {
    if (++count === 1) return Response.json({ id: 'event', etag: 'new' });
    assert.equal(new Headers(init.headers).get('If-Match'), 'old');
    return new Response('', { status: 412 });
  }) as typeof fetch;
  await assert.rejects(googleEvents('calendar', 'token', stub).update('event', 'old', draft), error => error instanceof CalendarError && error.status === 412);
});
test('recurring and invited events cannot be deleted by the simplified portal', async () => {
  const stub = (async () => Response.json({ recurringEventId: 'series' } satisfies Partial<GoogleEvent>)) as typeof fetch;
  await assert.rejects(googleEvents('calendar', 'token', stub).remove('event', 'etag'), error => error instanceof CalendarError && error.status === 409);
});
