import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTask, overdueTask } from '../lib/task-data.ts';
const task = { projectId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', title: 'Registrare le chitarre', assignee: 'Team studio', status: 'Da fare', priority: 'Alta', deadline: '2026-10-14', notes: '' };
test('tasks require valid project, priority and deadline', () => {
  assert.equal(validateTask(task).title, task.title);
  assert.throws(() => validateTask({ ...task, projectId: '' }), /progetto/);
  assert.throws(() => validateTask({ ...task, priority: 'Urgentissima' }), /priorità/);
  assert.throws(() => validateTask({ ...task, deadline: '2026-02-30' }), /Scadenza/);
  assert.equal('owner_id' in validateTask({ ...task, owner_id: 'other' }), false);
});
test('overdue excludes completed tasks and tasks due today', () => {
  assert.equal(overdueTask(task, '2026-10-15'), true);
  assert.equal(overdueTask(task, '2026-10-14'), false);
  assert.equal(overdueTask({ ...task, status: 'Completata' }, '2026-10-15'), false);
  assert.equal(overdueTask({ ...task, deadline: null }, '2026-10-15'), false);
});
