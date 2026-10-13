import { ownerSession } from '@/lib/owner-session';
import { sameOrigin } from '@/lib/calendar-policy';
import { listTasks, saveTask } from '@/lib/tasks';
import { TaskInputError, validId, validateTask } from '@/lib/task-data';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  try { const session = await ownerSession(request.headers); if (!session) return reply({ error: 'Accesso richiesto.' }, 401); return reply({ tasks: await listTasks(session.user.id) }); }
  catch { return reply({ error: 'Bacheca attività non disponibile. Riprova tra poco.' }, 503); }
}
async function save(request: Request, update: boolean) {
  if (!sameOrigin(request.headers.get('origin'), process.env.BETTER_AUTH_URL)) return reply({ error: 'Richiesta non autorizzata.' }, 403);
  try {
    const session = await ownerSession(request.headers); if (!session) return reply({ error: 'Accesso richiesto.' }, 401);
    const body = await request.json().catch(() => null);
    if (!body || !validId(body.id) || (update && (!Number.isSafeInteger(body.version) || body.version < 1))) return reply({ error: 'Richiesta attività non valida.' }, 400);
    const result = await saveTask(session.user.id, body.id, validateTask(body.draft), update ? body.version : undefined);
    return reply(result.task ? { task: result.task } : { error: result.error }, result.status);
  } catch (error) { return error instanceof TaskInputError ? reply({ error: error.message }, 400) : reply({ error: 'Salvataggio non completato. Riprova senza chiudere l’attività.' }, 503); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
