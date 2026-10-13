import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarScope, calendarAuthorized, sameOrigin } from '../lib/calendar-policy.ts';
test('identity authorization does not grant calendar access', () => {
  assert.equal(calendarAuthorized(['openid', 'email', 'profile']), false);
  assert.equal(calendarAuthorized([calendarScope]), true);
});
test('creation rejects absent, foreign and malformed origins', () => {
  assert.equal(sameOrigin(null, 'https://portal.example.com'), false);
  assert.equal(sameOrigin('https://evil.example.com', 'https://portal.example.com'), false);
  assert.equal(sameOrigin('invalid', 'https://portal.example.com'), false);
  assert.equal(sameOrigin('https://portal.example.com', 'https://portal.example.com'), true);
});
