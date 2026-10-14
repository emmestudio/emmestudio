"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { boardColumns, boardColumn, blockedTask } from "@/lib/operations-data";
import { romeLocal } from "@/lib/event-data";
import type { StudioProject } from "@/lib/project-data";
import type { StudioTask } from "@/lib/task-data";
import type { ProductionItem } from "@/lib/production-data";
import { todayRome, dueGroup, type Delivery } from "@/lib/work-data";
type Appointment = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  projectId?: string | null;
  participants?: string;
};
type Person = { email: string; name: string };
export default function ProjectBoard({
  projects,
  onOpen,
  view,
  revision,
}: {
  projects: StudioProject[];
  onOpen: (p: StudioProject) => void;
  view: "Bacheca" | "Settimana";
  revision: number;
}) {
  const [tasks, setTasks] = useState<StudioTask[]>([]),
    [items, setItems] = useState<ProductionItem[]>([]),
    [team, setTeam] = useState<Person[]>([]),
    [checks, setChecks] = useState<Delivery[]>([]),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]),
    [calendarError, setCalendarError] = useState("");
  const sourceKey = projects.map((p) => p.id + ":" + p.version).join("|");
  useEffect(() => {
    const c = new AbortController();
    setLoaded(false);
    Promise.all(
      ["/api/tasks", "/api/production", "/api/team", "/api/workflow"].map(
        async (url) => {
          const r = await fetch(url, { cache: "no-store", signal: c.signal });
          const d = await r.json();
          if (!r.ok) throw Error(d.error);
          return d;
        },
      ),
    )
      .then(([t, p, m, w]) => {
        setTasks(t.tasks);
        setItems(p.items);
        setTeam(m.people);
        setChecks(w.delivery);
        setError("");
        setLoaded(true);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [sourceKey, revision]);
  const active = projects.filter(
      (p) => !["Completato", "Archiviato"].includes(p.status),
    ),
    activeIds = new Set(active.map((p) => p.id)),
    today = todayRome();
  useEffect(() => {
    if (view !== "Settimana") return;
    const c = new AbortController();
    const end = new Date(today + "T12:00:00Z");
    end.setUTCDate(end.getUTCDate() + 8);
    const query = new URLSearchParams({
      start: romeLocal(today + "T00:00"),
      end: romeLocal(end.toISOString().slice(0, 10) + "T00:00"),
    });
    fetch("/api/calendar/events?" + query, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Agenda non disponibile.");
        setAppointments(d.events);
        setCalendarError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setCalendarError(e.message);
      });
    return () => c.abort();
  }, [view, today, revision]);
  const pending = tasks.filter(
    (t) => activeIds.has(t.projectId) && t.status !== "Completata",
  );
  const people = new Map(team.map((p) => [p.email, p]));
  for (const assigned of [
    ...pending,
    ...items.filter((i) => activeIds.has(i.projectId)),
  ])
    if (assigned.assigneeEmail && !people.has(assigned.assigneeEmail))
      people.set(assigned.assigneeEmail, {
        email: assigned.assigneeEmail,
        name:
          (assigned.assignee || assigned.assigneeEmail) +
          " · accesso non attivo",
      });
  const near = (date: string | null) =>
    ["In ritardo", "Entro 7 giorni"].includes(dueGroup(date, today));
  if (view === "Settimana")
    return (
      <div className="weekly-work">
        <p className="small">
          Da oggi ai prossimi 7 giorni, inclusi i lavori già in ritardo. Il
          carico mostra attività e schede assegnate ancora aperte.
        </p>
        <p role="status">
          {error || (!loaded ? "Caricamento riepilogo…" : "")}
        </p>
        <div className="operation-facts">
          <div>
            <small>Progetti attivi</small>
            <strong>{active.length}</strong>
          </div>
          <div>
            <small>Attività urgenti</small>
            <strong>{pending.filter((t) => near(t.deadline)).length}</strong>
          </div>
          <div>
            <small>Attese da ricontrollare</small>
            <strong>
              {
                active.filter(
                  (p) =>
                    p.operations?.waitingReason && near(p.operations.followUp),
                ).length
              }
            </strong>
          </div>
          <div>
            <small>Verifiche di consegna</small>
            <strong>
              {
                checks.filter(
                  (c) =>
                    activeIds.has(c.projectId) && !c.done && near(c.dueDate),
                ).length
              }
            </strong>
          </div>
        </div>
        <div className="project-grid">
          <section className="card">
            <h2>Scadenze e consegne</h2>
            {active
              .filter((p) => near(p.deadline))
              .map((p) => (
                <p key={p.id}>
                  <button className="text-button" onClick={() => onOpen(p)}>
                    {p.title}
                  </button>{" "}
                  · {p.deadline}
                </p>
              ))}
            {pending
              .filter((t) => near(t.deadline))
              .slice(0, 20)
              .map((t) => (
                <p key={t.id}>
                  <Link href={"/attivita?project=" + t.projectId}>
                    {t.title}
                  </Link>{" "}
                  · {t.deadline} · {t.assignee || "Da assegnare"}
                  {blockedTask(t, tasks) ? " · bloccata" : ""}
                </p>
              ))}
            {checks
              .filter(
                (c) => activeIds.has(c.projectId) && !c.done && near(c.dueDate),
              )
              .map((c) => (
                <p key={c.id}>
                  <Link
                    href={"/lavoro?project=" + c.projectId + "&tab=Consegne"}
                  >
                    {c.label}
                  </Link>{" "}
                  · {c.dueDate}
                </p>
              ))}
            {loaded &&
            !active.some((p) => near(p.deadline)) &&
            !pending.some((t) => near(t.deadline)) &&
            !checks.some(
              (c) => activeIds.has(c.projectId) && !c.done && near(c.dueDate),
            ) ? (
              <p>Nessuna scadenza imminente.</p>
            ) : null}
          </section>
          <section className="card">
            <h2>Carico del team</h2>
            {[
              ...people.values(),
              { email: "", name: "Non collegato a un account" },
            ].map((p) => {
              const ts = pending.filter(
                  (t) => (t.assigneeEmail ?? "") === p.email,
                ),
                ps = items.filter(
                  (i) =>
                    activeIds.has(i.projectId) &&
                    (i.assigneeEmail ?? "") === p.email &&
                    ![
                      "Consegnato",
                      "Archiviato",
                      "Archiviata",
                      "Completata",
                      "Registrata",
                      "Realizzato",
                      "Approvata",
                      "Definitivo",
                    ].includes(i.status),
                );
              return (
                <div className="ledger-row" key={p.email}>
                  <strong>{p.name}</strong>
                  <span>
                    {ts.length} attività · {ps.length} schede
                  </span>
                </div>
              );
            })}
          </section>
          <section className="card">
            <h2>Attese da ricontrollare</h2>
            {active
              .filter((p) => p.operations?.waitingReason)
              .map((p) => (
                <div className="ledger-row" key={p.id}>
                  <div>
                    <button className="text-button" onClick={() => onOpen(p)}>
                      {p.title}
                    </button>
                    <p>{p.operations?.waitingReason}</p>
                    <small>
                      {p.operations?.followUp ||
                        "Data di ricontatto da definire"}
                    </small>
                  </div>
                </div>
              ))}
          </section>
          <section className="card">
            <h2>Sessioni previste</h2>
            <p className="small" role="status">
              {calendarError}
            </p>
            {appointments
              .filter((e) => !e.projectId || activeIds.has(e.projectId))
              .map((e) => (
                <p key={e.id}>
                  <strong>{e.title}</strong>
                  <br />
                  {e.allDay
                    ? e.start
                    : new Date(e.start).toLocaleString("it-IT", {
                        timeZone: "Europe/Rome",
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                  {!e.allDay
                    ? " · " +
                      Math.round(
                        (Date.parse(e.end) - Date.parse(e.start)) / 60000,
                      ) +
                      " min"
                    : " · tutto il giorno"}
                  {e.participants ? " · " + e.participants : ""}
                </p>
              ))}
            {items
              .filter(
                (i) =>
                  activeIds.has(i.projectId) &&
                  i.kind === "recording" &&
                  !["Completata", "Registrata", "Archiviata"].includes(
                    i.status,
                  ) &&
                  near(i.details.recordedOn || i.deadline),
              )
              .map((i) => (
                <p key={i.id}>
                  <Link
                    href={
                      "/produzione?project=" + i.projectId + "&kind=recording"
                    }
                  >
                    {i.title}
                  </Link>{" "}
                  · {i.details.recordedOn || i.deadline} ·{" "}
                  {i.assignee || "Da assegnare"}
                </p>
              ))}
            <Link href="/calendario">Apri agenda sincronizzata ↗</Link>
          </section>
        </div>
      </div>
    );
  return (
    <>
      <p role="status">{error || (!loaded ? "Caricamento attività…" : "")}</p>
      <div className="project-board">
        {boardColumns.map((column) => (
          <section className="board-column" key={column}>
            <div className="list-heading">
              <h2>{column}</h2>
              <span className="badge">
                {projects.filter((p) => boardColumn(p) === column).length}
              </span>
            </div>
            {projects
              .filter((p) => boardColumn(p) === column)
              .map((p) => {
                const own = tasks.filter((t) => t.projectId === p.id),
                  next = own.find(
                    (t) => t.status !== "Completata" && !blockedTask(t, tasks),
                  );
                return (
                  <article className="board-project" key={p.id}>
                    <span className="badge">{p.kind}</span>
                    <h3>
                      <button className="text-button" onClick={() => onOpen(p)}>
                        {p.title}
                      </button>
                    </h3>
                    <p>{p.artist}</p>
                    <span className="small">
                      {p.operations?.phase || p.status}
                    </span>
                    <dl>
                      <dt>Responsabile</dt>
                      <dd>
                        {team.find((t) => t.email === p.operations?.leadEmail)
                          ?.name ||
                          p.operations?.leadEmail ||
                          "Da assegnare"}
                      </dd>
                      <dt>Prossimo passo</dt>
                      <dd>
                        {p.operations?.nextStep || next?.title || "Da definire"}
                      </dd>
                      <dt>Scadenza</dt>
                      <dd>{p.deadline || "Da pianificare"}</dd>
                    </dl>
                    {p.operations?.waitingReason ? (
                      <p className="waiting-note">
                        {p.operations.waitingReason}
                        <br />
                        <small>
                          Ricontrollo:{" "}
                          {p.operations.followUp || "Da pianificare"}
                        </small>
                      </p>
                    ) : null}
                    <small>
                      {loaded
                        ? `${own.filter((t) => t.status === "Completata").length}/${own.length} attività completate`
                        : "Caricamento…"}
                    </small>
                    <div className="board-actions">
                      <button className="text-button" onClick={() => onOpen(p)}>
                        Apri progetto ↗
                      </button>
                      <Link href={"/produzione?project=" + p.id}>
                        Produzione
                      </Link>
                    </div>
                  </article>
                );
              })}
            {!projects.some((p) => boardColumn(p) === column) ? (
              <p className="small">Nessun progetto.</p>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
