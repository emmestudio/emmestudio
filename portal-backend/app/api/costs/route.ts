import { workspaceSession } from "@/lib/workspace-session";
import { listCosts, saveCost, quoteHistory, costHistory } from "@/lib/costs";
import { validateCost, CostInputError } from "@/lib/cost-data";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
export const dynamic = "force-dynamic";
const reply = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET(r: Request) {
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (s.role !== "admin")
      return reply({ error: "Riservato all’amministratore." }, 403);
    const query = new URL(r.url).searchParams;
    const id = query.get("quote") ?? query.get("history");
    if (id && !validId(id))
      return reply({ error: "Identificativo non valido." }, 400);
    return reply(
      id
        ? {
            history: query.has("quote")
              ? await quoteHistory(s.workspaceOwnerId, id)
              : await costHistory(s.workspaceOwnerId, id),
          }
        : { costs: await listCosts(s.workspaceOwnerId) },
    );
  } catch {
    return reply({ error: "Registro costi non disponibile." }, 503);
  }
}
async function save(r: Request, update: boolean) {
  if (!sameOrigin(r.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(r.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (s.role !== "admin")
      return reply({ error: "Riservato all’amministratore." }, 403);
    const b = await r.json();
    if (
      !validId(b.id) ||
      (update && (!Number.isSafeInteger(b.version) || b.version < 1))
    )
      return reply({ error: "Riferimenti non validi." }, 400);
    await saveCost(
      s.workspaceOwnerId,
      b.id,
      update ? b.version : undefined,
      validateCost(b.draft),
    );
    return reply({ saved: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof CostInputError
            ? e.message
            : "Salvataggio non completato. Aggiorna prima di riprovare.",
      },
      e instanceof CostInputError ? 400 : 503,
    );
  }
}
export const POST = (r: Request) => save(r, false);
export const PATCH = (r: Request) => save(r, true);
