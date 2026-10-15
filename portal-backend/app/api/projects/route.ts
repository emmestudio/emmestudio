import {listFinanceTargets} from "@/lib/finance-targets";
import { workspaceSession } from "@/lib/workspace-session";
import { canEdit } from "@/lib/access-policy";
import { createProject, listProjects, updateProject } from "@/lib/projects";
import { ProjectInputError, validateProject } from "@/lib/project-data";
import { validateArtist, ArtistInputError } from "@/lib/artist-data";
import { validateQuote, FinanceInputError } from "@/lib/finance-data";
import { listLedger } from "@/lib/finance";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  try {
    const session = await workspaceSession(request.headers);
    if (!session) return reply({ error: "Accesso richiesto." }, 401);
    const [projects, ledger, financialTargets] = await Promise.all([
      listProjects(session.workspaceOwnerId, session.role === "admin"),
      session.role === "admin"
        ? listLedger(session.workspaceOwnerId)
        : Promise.resolve(undefined),
      session.role === "admin" ? listFinanceTargets(session.workspaceOwnerId) : Promise.resolve(undefined),
    ]);
    return reply({
      projects: projects.filter((p) => !p.deletedAt),
      financialProjects: session.role === "admin" ? projects : undefined,
      canEdit: canEdit(session.role),
      canManageFinance: session.role === "admin",
      ledger,
      financialTargets,
    });
  } catch {
    return reply(
      { error: "Archivio progetti non disponibile. Riprova tra poco." },
      503,
    );
  }
}
async function save(request: Request, update: boolean) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const session = await workspaceSession(request.headers);
    if (!session) return reply({ error: "Accesso richiesto." }, 401);
    if (!canEdit(session.role))
      return reply(
        { error: "Il tuo accesso consente solo la consultazione." },
        403,
      );
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.id !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
        body.id,
      )
    )
      return reply({ error: "Identificativo progetto non valido." }, 400);
    if (update && (!Number.isSafeInteger(body.version) || body.version < 1))
      return reply(
        { error: "Versione progetto non valida. Aggiorna l’archivio." },
        400,
      );
    const draft = validateProject(body.draft);
    if (body.quote && session.role !== "admin")
      return reply({ error: "Preventivi riservati all’amministratore." }, 403);
    if (body.newArtist && !validId(body.newArtist.id))
      return reply({ error: "Identificativo artista non valido." }, 400);
    if (
      body.quote &&
      (!Number.isSafeInteger(body.quoteVersion) || body.quoteVersion < 0)
    )
      return reply({ error: "Versione preventivo non valida." }, 400);
    const extras = {
      actor: session.user?.email ?? "Team Emme Studio",
      newArtist: body.newArtist
        ? { id: body.newArtist.id, draft: validateArtist(body.newArtist.draft) }
        : undefined,
      quote: body.quote ? validateQuote(body.quote) : undefined,
      quoteVersion: body.quoteVersion,
    };
    const project = update
      ? await updateProject(
          session.workspaceOwnerId,
          body.id,
          body.version,
          draft,
          extras,
        )
      : await createProject(session.workspaceOwnerId, body.id, draft, extras);
    if (!project)
      return reply(
        {
          error:
            "Il progetto è cambiato oppure una richiesta precedente è già stata salvata. Aggiorna l’archivio e riaprilo.",
        },
        409,
      );
    return reply({ project });
  } catch (error) {
    return error instanceof ProjectInputError ||
      error instanceof ArtistInputError ||
      error instanceof FinanceInputError
      ? reply({ error: error.message }, 400)
      : reply(
          {
            error:
              "Salvataggio non completato. Riprova senza chiudere il progetto.",
          },
          503,
        );
  }
}
export const POST = (request: Request) => save(request, false);
export const PATCH = (request: Request) => save(request, true);
