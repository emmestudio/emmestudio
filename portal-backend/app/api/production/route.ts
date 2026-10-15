import { autoSyncDrive } from "@/lib/drive-archive";
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
import {validateQuote,FinanceInputError} from "@/lib/finance-data";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
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
    let financial;
    if(b.quote !== undefined){
      if(s.role!=="admin")return reply({error:"Preventivi riservati all’amministratore."},403);
      if(!Number.isSafeInteger(b.quoteVersion)||b.quoteVersion<0)return reply({error:"Versione preventivo non valida."},400);
      const kind=b.draft?.kind;
      if(!["track","recording","live","service"].includes(kind))return reply({error:"Preventivo non disponibile per questa scheda."},400);
      financial={quote:validateQuote(b.quote),quoteVersion:b.quoteVersion};
    }
    await saveProduction(
      s.workspaceOwnerId,
      b.id,
      update ? b.version : undefined,
      validateProduction(b.draft),
      s.user?.name || "Team Emme Studio",
      financial,
    );
    const drive=b.draft?.kind === "live" ? await autoSyncDrive(s.workspaceOwnerId,"live",b.id) : undefined;
    return reply({ saved: true, drive });
  } catch (e) {
    return reply(
      {
        error:
          (e instanceof ProductionInputError || e instanceof FinanceInputError)
            ? e.message
            : "Salvataggio non completato. Aggiorna prima di riprovare.",
      },
      (e instanceof ProductionInputError || e instanceof FinanceInputError) ? 400 : 503,
    );
  }
}
export const POST = (r: Request) => save(r, false);
export const PATCH = (r: Request) => save(r, true);
