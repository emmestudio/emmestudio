import { workspaceSession } from "@/lib/workspace-session";
import { listLedger, saveMovement } from "@/lib/finance";
import { FinanceInputError } from "@/lib/finance-data";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
export const dynamic = "force-dynamic";
const reply = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (s.role !== "admin")
      return reply({ error: "Sezione riservata all’amministratore." }, 403);
    return reply(await listLedger(s.workspaceOwnerId));
  } catch {
    return reply({ error: "Registro economico non disponibile." }, 503);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (s.role !== "admin")
      return reply({ error: "Sezione riservata all’amministratore." }, 403);
    const b = await request.json();
    if (
      !validId(b.id) ||
      !validId(b.projectId) ||
      !Number.isSafeInteger(b.quoteVersion) ||
      b.quoteVersion < 1
    )
      return reply({ error: "Riferimenti non validi." }, 400);
    await saveMovement(s.workspaceOwnerId, b);
    return reply({ saved: true });
  } catch (e) {
    return reply(
      {
        error:
          e instanceof FinanceInputError
            ? e.message
            : "Salvataggio non completato. Aggiorna il registro prima di riprovare.",
      },
      e instanceof FinanceInputError ? 400 : 503,
    );
  }
}
