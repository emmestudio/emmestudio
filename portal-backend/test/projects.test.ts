import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, projectProgress } from '../lib/project-data.ts';
const draft = { title: 'Un album', artist: 'Artista', kind: 'Album', status: 'Pianificazione', deadline: null, vision: 'Obiettivo', notes: '', music: 0, live: 50, image: 100 };
test('projects validate controlled states and area progress', () => {
  assert.equal(projectProgress(validateProject(draft)), 50);
  assert.throws(() => validateProject({ ...draft, status: 'Administrator' }), /stato/);
  assert.throws(() => validateProject({ ...draft, music: 99 }), /Avanzamento/);
  assert.throws(() => validateProject({ ...draft, artist: ' ' }), /artista/);
  assert.throws(() => validateProject({ ...draft, deadline: '2026-02-30' }), /Scadenza/);
});
test('mass assignment cannot set owner or revision', () => {
  const result = validateProject({ ...draft, owner_id: 'other', version: 999 });
  assert.equal('owner_id' in result, false);
  assert.equal('version' in result, false);
});
