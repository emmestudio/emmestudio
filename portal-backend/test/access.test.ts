import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canEdit, canManageAccess, validateMember } from '../lib/access-policy.ts';
test('consultation and unknown roles never grant write or administration', () => {
  for (const role of ['viewer', '', 'artist', 'unknown']) { assert.equal(canEdit(role), false); assert.equal(canManageAccess(role), false); }
  assert.equal(canEdit('editor'), true); assert.equal(canManageAccess('editor'), false);
  assert.equal(canEdit('admin'), true); assert.equal(canManageAccess('admin'), true);
});
test('member creation cannot elevate role or modify the protected owner', () => {
  const member = { email: ' Team@Example.com ', name: 'Team', role: 'viewer', active: true };
  assert.equal(validateMember(member, 'owner@example.com').email, 'team@example.com');
  assert.throws(() => validateMember({ ...member, role: 'admin' }, 'owner@example.com'), /ruolo/);
  assert.throws(() => validateMember({ ...member, email: 'OWNER@example.com' }, 'owner@example.com'), /amministratore/);
  assert.throws(() => validateMember({ ...member, active: 'true' }, 'owner@example.com'), /stato/);
});
