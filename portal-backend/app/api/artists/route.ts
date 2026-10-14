import { workspaceSession } from "@/lib/workspace-session";
import { canEdit } from "@/lib/access-policy";
import { listArtists, saveArtist } from "@/lib/artists";
import { validateArtist, ArtistInputError } from "@/lib/artist-data";
import { validId } from "@/lib/task-data";
import { sameOrigin } from "@/lib/calendar-policy";
export const dynamic = "force-dynamic";
const reply = (d: unknown, s = 200) =>
  Response.json(d, { status: s, headers: { "Cache-Control": "no-store" } });
export async function GET(request: Request) {
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    return reply({
      artists: await listArtists(s.workspaceOwnerId),
      canEdit: canEdit(s.role),
    });
  } catch {
    return reply({ error: "Archivio artisti non disponibile." }, 503);
  }
}
async function save(request: Request, update: boolean) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const s = await workspaceSession(request.headers);
    if (!s) return reply({ error: "Accesso richiesto." }, 401);
    if (!canEdit(s.role)) return reply({ error: "Solo consultazione." }, 403);
    const b = await request.json();
    if (
      !validId(b.id) ||
      (update && (!Number.isSafeInteger(b.version) || b.version < 1))
    )
      return reply({ error: "Identificativo o versione non validi." }, 400);
    const ok = await saveArtist(
      s.workspaceOwnerId,
      b.id,
      update ? b.version : undefined,
      validateArtist(b.draft),
    );
    return ok
      ? reply({ saved: true })
      : reply(
          { error: "Profilo già salvato o modificato. Aggiorna e riaprilo." },
          409,
        );
  } catch (e) {
    return reply(
      {
        error:
          e instanceof ArtistInputError
            ? e.message
            : "Salvataggio non completato. Aggiorna prima di riprovare.",
      },
      e instanceof ArtistInputError ? 400 : 503,
    );
  }
}
export const POST = (r: Request) => save(r, false);
export const PATCH = (r: Request) => save(r, true);
