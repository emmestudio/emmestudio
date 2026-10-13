import { ownerSession } from '@/lib/owner-session';
import { createProject, listProjects, updateProject } from '@/lib/projects';
import { ProjectInputError, validateProject } from '@/lib/project-data';
import { sameOrigin } from '@/lib/calendar-policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: Request) {
  try {
    const session = await ownerSession(request.headers);
    if (!session) return reply({ error: 'Accesso richiesto.' }, 401);
    return reply({ projects: await listProjects(session.user.id) });
  } catch { return reply({ error: 'Archivio progetti non disponibile. Riprova tra poco.' }, 503); }
}
async function save(request: Request, update: boolean) {
  if (!sameOrigin(request.headers.get('origin'), process.env.BETTER_AUTH_URL)) return reply({ error: 'Richiesta non autorizzata.' }, 403);
  try {
    const session = await ownerSession(request.headers);
    if (!session) return reply({ error: 'Accesso richiesto.' }, 401);
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.id)) return reply({ error: 'Identificativo progetto non valido.' }, 400);
    if (update && (!Number.isSafeInteger(body.version) || body.version < 1)) return reply({ error: 'Versione progetto non valida. Aggiorna l’archivio.' }, 400);
    const draft = validateProject(body.draft);
    const project = update ? await updateProject(session.user.id, body.id, body.version, draft) : await createProject(session.user.id, body.id, draft);
    if (!project) return reply({ error: 'Il progetto è cambiato oppure una richiesta precedente è già stata salvata. Aggiorna l’archivio e riaprilo.' }, 409);
    return reply({ project });
  } catch (error) { return error instanceof ProjectInputError ? reply({ error: error.message }, 400) : reply({ error: 'Salvataggio non completato. Riprova senza chiudere il progetto.' }, 503); }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
