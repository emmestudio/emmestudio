import { createHash } from "node:crypto";
import { validateDraft, type EventDraft } from "./event-data.ts";
export type GoogleEvent = {
  id: string;
  etag: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
  attendees?: unknown[];
  start: { date?: string; dateTime?: string };
  end: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};
export class CalendarError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function draftDigest(draft: EventDraft) {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex");
}
export function eventBody(draft: EventDraft) {
  return {
    summary: draft.title,
    description: draft.description,
    location: draft.location,
    start: draft.allDay
      ? { date: draft.start, dateTime: null, timeZone: null }
      : { date: null, dateTime: draft.start, timeZone: "Europe/Rome" },
    end: draft.allDay
      ? { date: draft.end, dateTime: null, timeZone: null }
      : { date: null, dateTime: draft.end, timeZone: "Europe/Rome" },
  };
}
export function mutableEvent(event: GoogleEvent) {
  return (
    !event.recurringEventId &&
    !event.recurrence?.length &&
    !event.attendees?.length &&
    event.status !== "cancelled"
  );
}
export function googleEvents(
  calendarId: string,
  token: string,
  request: typeof fetch = fetch,
) {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  async function call<T>(
    path = "",
    init: RequestInit = {},
    query?: URLSearchParams,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await request(
      base + path + (query ? "?" + query.toString() : ""),
      {
        ...init,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) {
      const message =
        response.status === 412
          ? "L’appuntamento è stato modificato da un’altra sessione. Aggiorna l’elenco e riaprilo prima di salvare."
          : response.status === 401 || response.status === 403
            ? "Autorizzazione Google da rinnovare."
            : response.status === 404 || response.status === 410
              ? "Appuntamento non più disponibile. Aggiorna l’elenco."
              : "Google Calendar non ha completato la richiesta. Riprova tra poco.";
      throw new CalendarError(response.status, message);
    }
    return (response.status === 204 ? null : await response.json()) as T;
  }
  const get = (id: string) => call<GoogleEvent>("/" + encodeURIComponent(id));
  return {
    get,
    async list(timeMin: string, timeMax: string) {
      const items: GoogleEvent[] = [];
      let nextPageToken: string | undefined;
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: "true",
          orderBy: "startTime",
          showDeleted: "false",
          maxResults: "250",
          timeZone: "Europe/Rome",
        });
        if (nextPageToken) query.set("pageToken", nextPageToken);
        const result = await call<{
          items?: GoogleEvent[];
          nextPageToken?: string;
        }>("", {}, query);
        items.push(
          ...(result.items ?? []).filter((item) => item.status !== "cancelled"),
        );
        nextPageToken = result.nextPageToken;
        if (!nextPageToken) return items;
      }
      throw new CalendarError(
        503,
        "Troppi appuntamenti nel periodo. Seleziona un intervallo più breve.",
      );
    },
    async create(id: string, input: unknown) {
      if (!/^e[a-f0-9]{32}$/.test(id))
        throw new CalendarError(400, "Identificativo appuntamento non valido.");
      const draft = validateDraft(input);
      const digest = draftDigest(draft);
      try {
        return await call<GoogleEvent>(
          "",
          {
            method: "POST",
            body: JSON.stringify({
              id,
              ...eventBody(draft),
              extendedProperties: {
                private: {
                  emmeCategory: draft.category,
                  emmeRequestDigest: digest,
                  emmeProjectId: draft.projectId ?? "",
                  emmeParticipants: draft.participants ?? "",
                },
              },
            }),
          },
          new URLSearchParams({ sendUpdates: "none" }),
        );
      } catch (error) {
        if (error instanceof CalendarError && error.status === 409) {
          const existing = await get(id);
          if (
            existing.extendedProperties?.private?.emmeRequestDigest === digest
          )
            return existing;
          throw new CalendarError(
            409,
            "La richiesta precedente risulta già salvata con dati diversi. Aggiorna l’elenco prima di creare un nuovo appuntamento.",
          );
        }
        throw error;
      }
    },
    async update(id: string, etag: string, input: unknown) {
      const existing = await get(id);
      if (!mutableEvent(existing))
        throw new CalendarError(
          409,
          "Gestisci gli eventi ricorrenti o con invitati direttamente in Google Calendar.",
        );
      const draft = validateDraft(input);
      return call<GoogleEvent>(
        "/" + encodeURIComponent(id),
        {
          method: "PATCH",
          headers: { "If-Match": etag },
          body: JSON.stringify({
            ...eventBody(draft),
            extendedProperties: {
              private: {
                ...existing.extendedProperties?.private,
                emmeCategory: draft.category,
                emmeProjectId: draft.projectId ?? "",
                emmeParticipants: draft.participants ?? "",
              },
            },
          }),
        },
        new URLSearchParams({ sendUpdates: "none" }),
      );
    },
    async remove(id: string, etag: string) {
      const existing = await get(id);
      if (!mutableEvent(existing))
        throw new CalendarError(
          409,
          "Gestisci gli eventi ricorrenti o con invitati direttamente in Google Calendar.",
        );
      return call<null>(
        "/" + encodeURIComponent(id),
        { method: "DELETE", headers: { "If-Match": etag } },
        new URLSearchParams({ sendUpdates: "none" }),
      );
    },
  };
}
