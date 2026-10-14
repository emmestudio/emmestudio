import { workspaceSession } from "@/lib/workspace-session";
import { canEdit } from "@/lib/access-policy";
import { sameOrigin } from "@/lib/calendar-policy";
import { listWorkflow, saveWorkflow, workHistory } from "@/lib/workflow";
import { WorkInputError } from "@/lib/work-data";
import { validId } from "@/lib/task-data";
export const dynamic = "force-dynamic";
const reply = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    const id = new URL(r.url).searchParams.get("history");
    if (id && !validId(id))
      return reply({ error: "Identificativo non valido." }, 400);
    return reply(
      id
        ? { history: await workHistory(s.workspaceOwnerId, id) }
        : {
            ...(await listWorkflow(s.workspaceOwnerId)),
            selfEmail: s.user.email.toLowerCase(),
            canEdit: canEdit(s.role),
            admin: s.role === "admin",
          },
    );
  } catch {
    return reply({ error: "Organizzazione del lavoro non disponibile." }, 503);
  }
}
export async function POST(r: Request) {
  if (!sameOrigin(r.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (!canEdit(s.role)) return reply({ error: "Solo consultazione." }, 403);
    const b = await r.json();
    if (
      !b ||
      typeof b.action !== "string" ||
      (b.version !== undefined &&
        (!Number.isSafeInteger(b.version) || b.version < 0))
    )
      return reply({ error: "Richiesta non valida." }, 400);
    await saveWorkflow(s.workspaceOwnerId, s.user.email, s.role, b);
    return reply({ saved: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof WorkInputError
            ? e.message
            : "Salvataggio non completato. Aggiorna e riprova.",
      },
      e instanceof WorkInputError ? 400 : 503,
    );
  }
}
