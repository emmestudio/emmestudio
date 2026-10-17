import { workspaceSession } from "@/lib/workspace-session";
import { sameOrigin } from "@/lib/calendar-policy";
import { canEdit } from "@/lib/access-policy";
import {
  listTrash,
  saveOperations,
  trashResource,
  purgeProject,
  purgeProduction,
  purgeSimpleResource,
  OperationsError,
  type ResourceKind,
} from "@/lib/operations";
import { validId } from "@/lib/task-data";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (s.role !== "admin")
      return reply({ error: "Cestino riservato agli amministratori." }, 403);
    return reply({ items: await listTrash(s.workspaceOwnerId) });
  } catch {
    return reply({ error: "Cestino non disponibile." }, 503);
  }
}
export async function POST(r: Request) {
  if (!sameOrigin(r.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    const b = await r.json();
    if (
      !b ||
      !validId(b.id) ||
      !Number.isSafeInteger(b.version) ||
      b.version < 1
    )
      return reply({ error: "Riferimenti non validi." }, 400);
    if (b.action === "operations") {
      if (!canEdit(s.role)) return reply({ error: "Solo consultazione." }, 403);
      await saveOperations(
        s.workspaceOwnerId,
        b.id,
        b.version,
        b.draft,
        s.user.email,
      );
    } else if (b.action === "purge") {
      if (s.role !== "admin") return reply({error:"Eliminazione definitiva riservata agli amministratori."},403);
      if(b.kind==="project")await purgeProject(s.workspaceOwnerId,b.id,b.version,b.confirmation);
      else if(b.kind==="production")await purgeProduction(s.workspaceOwnerId,b.id,b.version,b.confirmation);
      else if(["artist","task"].includes(b.kind))await purgeSimpleResource(s.workspaceOwnerId,b.kind,b.id,b.version,b.confirmation);
      else return reply({error:"Tipo di scheda non valido."},400);
    } else if (["delete", "restore"].includes(b.action)) {
      if (s.role !== "admin")
        return reply(
          { error: "Eliminazione riservata agli amministratori." },
          403,
        );
      await trashResource(
        s.workspaceOwnerId,
        b.kind as ResourceKind,
        b.id,
        b.version,
        b.action === "restore",
        b.confirmation,
        s.user.email,
      );
    } else return reply({ error: "Operazione non valida." }, 400);
    return reply({ saved: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof OperationsError
            ? e.message
            : "Operazione non completata. Aggiorna e riprova.",
      },
      e instanceof OperationsError ? 409 : 503,
    );
  }
}
