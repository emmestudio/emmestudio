import { getDb } from "@/lib/db";
import { validId } from "@/lib/task-data";
import { calendarContext } from "@/lib/calendar-context";
import { sameOrigin } from "@/lib/calendar-policy";
import {
  CalendarError,
  mutableEvent,
  type GoogleEvent,
} from "@/lib/google-events";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
function failure(error: unknown) {
  if (error instanceof CalendarError)
    return reply(
      { error: error.message },
      [400, 401, 403, 404, 409, 410, 412].includes(error.status)
        ? error.status
        : 502,
    );
  return reply(
    {
      error:
        "Connessione a Calendar non disponibile. Riprova; se il problema persiste rinnova l’autorizzazione.",
    },
    503,
  );
}
function view(event: GoogleEvent) {
  return {
    projectId: event.extendedProperties?.private?.emmeProjectId || null,
    participants: event.extendedProperties?.private?.emmeParticipants ?? "",
    id: event.id,
    etag: event.etag,
    title: event.summary ?? "(Senza titolo)",
    description: event.description ?? "",
    location: event.location ?? "",
    allDay: Boolean(event.start.date),
    start: event.start.date ?? event.start.dateTime,
    end: event.end.date ?? event.end.dateTime,
    category: event.extendedProperties?.private?.emmeCategory ?? "Altro",
    editable: mutableEvent(event),
    url:
      event.htmlLink?.startsWith("https://www.google.com/calendar/") ||
      event.htmlLink?.startsWith("https://calendar.google.com/")
        ? event.htmlLink
        : null,
  };
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const start = params.get("start") ?? "";
    const end = params.get("end") ?? "";
    if (
      !/^\d{4}-\d{2}-\d{2}T/.test(start) ||
      !/^\d{4}-\d{2}-\d{2}T/.test(end) ||
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      Date.parse(end) <= Date.parse(start) ||
      Date.parse(end) - Date.parse(start) > 400 * 86400000
    )
      return reply({ error: "Intervallo calendario non valido." }, 400);
    const { events, canEdit, canOpenGoogle } = await calendarContext(request);
    return reply({
      events: (await events.list(start, end)).map(view),
      checkedAt: new Date().toISOString(),
      canEdit,
      canOpenGoogle,
    });
  } catch (error) {
    return failure(error);
  }
}
async function mutate(
  request: Request,
  action: "create" | "update" | "remove",
) {
  if (!sameOrigin(request.headers.get("origin"), process.env.BETTER_AUTH_URL))
    return reply({ error: "Richiesta non autorizzata." }, 403);
  try {
    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.id !== "string" ||
      !/^[a-zA-Z0-9_-]{5,1024}$/.test(body.id)
    )
      return reply({ error: "Richiesta appuntamento non valida." }, 400);
    if (
      action !== "create" &&
      (typeof body.etag !== "string" ||
        !body.etag ||
        body.etag.length > 200 ||
        /[\r\n]/.test(body.etag))
    )
      return reply(
        { error: "Versione appuntamento non valida. Aggiorna l’elenco." },
        400,
      );
    const { events, workspaceOwnerId } = await calendarContext(request, true);
    if (action !== "remove" && body.draft?.projectId) {
      if (!validId(body.draft.projectId))
        return reply({ error: "Progetto non valido." }, 400);
      const p = await getDb().query(
        "SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL",
        [workspaceOwnerId, body.draft.projectId],
      );
      if (!p.rows[0])
        return reply(
          {
            error:
              "Progetto non disponibile. Rimuovi il collegamento oppure ripristina il progetto.",
          },
          400,
        );
    }
    if (action === "remove") {
      await events.remove(body.id, body.etag);
      return reply({ removed: true });
    }
    let event: GoogleEvent;
    try {
      event =
        action === "create"
          ? await events.create(body.id, body.draft)
          : await events.update(body.id, body.etag, body.draft);
    } catch (error) {
      if (
        !(error instanceof CalendarError) &&
        error instanceof Error &&
        !["AbortError", "TimeoutError", "TypeError"].includes(error.name)
      )
        return reply({ error: error.message }, 400);
      throw error;
    }
    return reply({ event: view(event) });
  } catch (error) {
    return failure(error);
  }
}
export const POST = (request: Request) => mutate(request, "create");
export const PATCH = (request: Request) => mutate(request, "update");
export const DELETE = (request: Request) => mutate(request, "remove");
