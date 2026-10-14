import { workspaceSession } from "@/lib/workspace-session";
import { canEdit } from "@/lib/access-policy";
import {
  listProduction,
  productionHistory,
  saveProduction,
} from "@/lib/production";
import {
  validateProduction,
  ProductionInputError,
} from "@/lib/production-data";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
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
        ? { history: await productionHistory(s.workspaceOwnerId, id) }
        : {
            items: await listProduction(s.workspaceOwnerId),
            canEdit: canEdit(s.role),
          },
    );
  } catch {
    return reply({ error: "Produzione non disponibile." }, 503);
  }
}
async function save(r: Request, update: boolean) {
  if (!sameOrigin(r.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (!canEdit(s.role)) return reply({ error: "Solo consultazione." }, 403);
    const b = await r.json();
    if (
      !validId(b.id) ||
      (update && (!Number.isSafeInteger(b.version) || b.version < 1))
    )
      return reply({ error: "Identificativo o versione non validi." }, 400);
    await saveProduction(
      s.workspaceOwnerId,
      b.id,
      update ? b.version : undefined,
      validateProduction(b.draft),
      s.user?.name || "Team Emme Studio",
    );
    return reply({ saved: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof ProductionInputError
            ? e.message
            : "Salvataggio non completato. Aggiorna prima di riprovare.",
      },
      e instanceof ProductionInputError ? 400 : 503,
    );
  }
}
export const POST = (r: Request) => save(r, false);
export const PATCH = (r: Request) => save(r, true);
