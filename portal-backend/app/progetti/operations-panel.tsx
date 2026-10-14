"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  emptyOperations,
  projectPhases,
  type Operations,
  blockedTask,
} from "@/lib/operations-data";
import type { StudioProject } from "@/lib/project-data";
import type { StudioTask } from "@/lib/task-data";
import type { ProductionItem } from "@/lib/production-data";
import { projectBalance, euro, type Ledger } from "@/lib/finance-data";
import { todayRome, duration, type Delivery, type Hour } from "@/lib/work-data";
type Person = { email: string; name: string };
const phases = [
  "Registrazione strumenti",
  "Registrazione voce",
  "Editing",
  "Mix",
  "Mastering",
];
export default function OperationsPanel({
  project,
  writable,
  ledger,
  onSaved,
}: {
  project: StudioProject;
  writable: boolean;
  ledger: Ledger | null;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Operations>({
      ...emptyOperations(),
      ...project.operations,
    }),
    [team, setTeam] = useState<Person[]>([]),
    [tasks, setTasks] = useState<StudioTask[]>([]),
    [items, setItems] = useState<ProductionItem[]>([]),
    [checks, setChecks] = useState<Delivery[]>([]),
    [hours, setHours] = useState<Hour[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setReady(false);
    setD({ ...emptyOperations(), ...project.operations });
    Promise.all(
      ["/api/team", "/api/tasks", "/api/production", "/api/workflow"].map(
        async (url) => {
          const r = await fetch(url, { cache: "no-store", signal: c.signal });
          const b = await r.json();
          if (!r.ok) throw Error(b.error);
          return b;
        },
      ),
    )
      .then(([t, a, p, w]) => {
        setTeam(t.people);
        setTasks(a.tasks.filter((t: StudioTask) => t.projectId === project.id));
        setItems(
          p.items.filter((t: ProductionItem) => t.projectId === project.id),
        );
        setChecks(
          w.delivery.filter((t: Delivery) => t.projectId === project.id),
        );
        setHours(
          w.hours.filter(
            (t: Hour) => t.projectId === project.id && !t.voidReason,
          ),
        );
        setReady(true);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [project.id, project.version]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "operations",
          id: project.id,
          version: project.version,
          draft: d,
        }),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non completato.");
    } finally {
      setBusy(false);
    }
  }
  const open = tasks.filter((t) => t.status !== "Completata"),
    balance = ledger ? projectBalance(project.id, ledger, todayRome()) : null;
  return (
    <section className="operations-panel">
      <span className="eyebrow">CABINA DI REGIA</span>
      <h3>{project.title}</h3>
      <div className="operation-facts">
        <div>
          <small>Referente</small>
          <strong>
            {team.find((t) => t.email === d.leadEmail)?.name ||
              d.leadEmail ||
              "Da assegnare"}
          </strong>
        </div>
        <div>
          <small>Attività</small>
          <strong>
            {ready
              ? `${tasks.length - open.length}/${tasks.length} completate`
              : "Caricamento…"}
          </strong>
        </div>
        <div>
          <small>Ore registrate</small>
          <strong>
            {ready ? duration(hours.reduce((n, h) => n + h.minutes, 0)) : "—"}
          </strong>
        </div>
        {balance ? (
          <div>
            <small>Incassato / da incassare</small>
            <strong>
              {euro(balance.received)} / {euro(balance.outstanding)}
            </strong>
          </div>
        ) : null}
      </div>
      <p className="small">
        Referente, fase, prossima azione e attese si aggiornano con «Salva
        organizzazione».
      </p>
      <fieldset disabled={!writable || busy}>
        <div className="form-grid">
          <label>
            Referente del progetto
            <select
              value={d.leadEmail ?? ""}
              onChange={(e) =>
                setD({ ...d, leadEmail: e.target.value || null })
              }
            >
              <option value="">Da assegnare</option>
              {d.leadEmail && !team.some((t) => t.email === d.leadEmail) ? (
                <option value={d.leadEmail}>{d.leadEmail} · non attivo</option>
              ) : null}
              {team.map((t) => (
                <option key={t.email} value={t.email}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fase attuale
            <select
              value={d.phase}
              onChange={(e) => setD({ ...d, phase: e.target.value })}
            >
              <option value="">Da definire</option>
              {projectPhases[project.kind]?.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Prossima azione
          <input
            maxLength={1000}
            value={d.nextStep}
            onChange={(e) => setD({ ...d, nextStep: e.target.value })}
          />
        </label>
        <details>
          <summary>
            Collaboratori del progetto · {d.collaborators.length}
          </summary>
          {[
            ...team,
            ...d.collaborators
              .filter((email) => !team.some((t) => t.email === email))
              .map((email) => ({ email, name: email + " · non attivo" })),
          ].map((t) => (
            <label className="checkbox" key={t.email}>
              <input
                type="checkbox"
                checked={d.collaborators.includes(t.email)}
                onChange={(e) =>
                  setD({
                    ...d,
                    collaborators: e.target.checked
                      ? [...d.collaborators, t.email]
                      : d.collaborators.filter((x) => x !== t.email),
                  })
                }
              />
              {t.name}
            </label>
          ))}
        </details>
        <div className="form-grid">
          <label>
            Motivo dell’attesa
            <textarea
              rows={2}
              maxLength={2000}
              placeholder="Materiali, approvazione, disponibilità…"
              value={d.waitingReason}
              onChange={(e) =>
                setD({
                  ...d,
                  waitingReason: e.target.value,
                  followUp: e.target.value ? d.followUp : null,
                })
              }
            />
          </label>
          <label>
            Ricontrollare il
            <input
              type="date"
              value={d.followUp ?? ""}
              onChange={(e) => setD({ ...d, followUp: e.target.value || null })}
            />
          </label>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={!writable || busy}
          onClick={() => void save()}
        >
          {busy ? "Salvataggio…" : "Salva organizzazione"}
        </button>
      </fieldset>
      <p role="status">{error}</p>
      <div className="phase-path">
        {projectPhases[project.kind]?.map((p) => (
          <span className={d.phase === p ? "current" : ""} key={p}>
            {p}
          </span>
        ))}
      </div>
      {ready ? (
        <>
          <details>
            <summary>Attività e dipendenze · {open.length} aperte</summary>
            {open.slice(0, 15).map((t) => (
              <p key={t.id}>
                <strong>{t.title}</strong> · {t.assignee || "Da assegnare"} ·{" "}
                {t.deadline || "Da pianificare"}
                {blockedTask(t, tasks) ? " · In attesa di altre attività" : ""}
              </p>
            ))}
            <Link href={"/attivita?project=" + project.id}>
              Gestisci attività ↗
            </Link>
          </details>
          <details>
            <summary>
              Consegne · {checks.filter((c) => c.done).length}/{checks.length}
            </summary>
            {checks.map((c) => (
              <p key={c.id}>
                {c.done ? "✓" : "○"} {c.label}
                {c.required ? " · obbligatoria" : ""}
              </p>
            ))}
            <Link href={"/lavoro?project=" + project.id + "&tab=Consegne"}>
              Gestisci consegne ↗
            </Link>
          </details>
          {items.some((i) => i.kind === "track") ? (
            <details open>
              <summary>Panoramica dei brani</summary>
              <p className="small">
                Le sessioni mostrano completate / previste. «—» indica una fase
                senza sessioni pianificate; lo stato del brano rimane indicato
                separatamente.
              </p>
              <div className="table-scroll">
                <table className="track-matrix">
                  <thead>
                    <tr>
                      <th>Brano</th>
                      <th>Stato</th>
                      {phases.map((p) => (
                        <th key={p}>{p}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items
                      .filter((i) => i.kind === "track")
                      .map((t) => (
                        <tr key={t.id}>
                          <th>
                            <Link
                              href={
                                "/produzione?project=" +
                                project.id +
                                "&track=" +
                                t.id
                              }
                            >
                              {t.title}
                            </Link>
                          </th>
                          <td>{t.status}</td>
                          {phases.map((p) => {
                            const sessions = items.filter(
                              (i) =>
                                i.kind === "recording" &&
                                i.trackId === t.id &&
                                i.details.phase === p,
                            );
                            return (
                              <td key={p}>
                                {sessions.length
                                  ? `${sessions.filter((s) => ["Completata", "Registrata"].includes(s.status)).length}/${sessions.length}`
                                  : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          ) : null}
        </>
      ) : null}
      <div className="dialog-actions">
        <Link href={"/calendario?project=" + project.id}>
          Pianifica sessione o riunione ↗
        </Link>
        <Link href={"/produzione?project=" + project.id}>Produzione ↗</Link>
      </div>
    </section>
  );
}
