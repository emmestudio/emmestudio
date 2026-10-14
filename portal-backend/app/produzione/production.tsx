"use client";
import AssigneeField from "../assignee-field";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import TrackWorkspace from "./track-workspace";
import {
  productionSpecs,
  sessionPhases,
  emptyProduction,
  type ProductionKind,
  type ProductionDraft,
  type ProductionItem,
  type ProductionHistory,
} from "@/lib/production-data";
import type { StudioProject } from "@/lib/project-data";
const kinds: ProductionKind[] = ["track", "recording", "live"];
export default function Production() {
  const [items, setItems] = useState<ProductionItem[]>([]),
    [projects, setProjects] = useState<StudioProject[]>([]),
    [writable, setWritable] = useState(false),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [error, setError] = useState("");
  const [project, setProject] = useState(""),
    [kind, setKind] = useState<ProductionKind>("track"),
    [search, setSearch] = useState(""),
    [onlyOpen, setOnlyOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ProductionItem | "new" | null>(null),
    [draft, setDraft] = useState<ProductionDraft>(emptyProduction("track")),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState(""),
    [history, setHistory] = useState<ProductionHistory[]>([]),
    [historyError, setHistoryError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    initial = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    Promise.all(
      ["/api/production", "/api/projects"].map(async (url) => {
        const r = await fetch(url, { cache: "no-store", signal: c.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    )
      .then(([a, p]) => {
        setItems(a.items);
        setWritable(a.canEdit);
        setProjects(p.projects);
        setError("");
        if (!initial.current) {
          initial.current = true;
          const q = new URLSearchParams(window.location.search);
          setProject(q.get("project") ?? "");
          const tab = q.get("kind");
          if (kinds.includes(tab as ProductionKind))
            setKind(tab as ProductionKind);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [refresh]);
  useEffect(() => {
    if (editor && !dialog.current?.open) dialog.current?.showModal();
    if (!editor || editor === "new") {
      setHistory([]);
      return;
    }
    const c = new AbortController();
    setHistory([]);
    setHistoryError("");
    fetch("/api/production?history=" + editor.id, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setHistory(d.history);
      })
      .catch((e) => {
        if (!c.signal.aborted) setHistoryError(e.message);
      });
    return () => c.abort();
  }, [editor]);
  function open(item?: ProductionItem) {
    setEditor(item ?? "new");
    setDraft(
      item
        ? { ...item }
        : {
            ...emptyProduction(kind, project),
            trackId: null,
            details:
              kind === "recording"
                ? {
                    ...emptyProduction(kind, project).details,
                    phase: "Registrazione strumenti",
                  }
                : emptyProduction(kind, project).details,
          },
    );
    setId(item?.id ?? crypto.randomUUID());
    setFormError("");
  }
  function close() {
    if (!busy) {
      dialog.current?.close();
      setEditor(null);
    }
  }
  async function save() {
    setBusy(true);
    setFormError("");
    try {
      const r = await fetch("/api/production", {
        method: editor === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          version: editor && editor !== "new" ? editor.version : undefined,
          draft,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      dialog.current?.close();
      setEditor(null);
      setRefresh((x) => x + 1);
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Salvataggio non completato.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectedTrack =
    items.find((i) => i.kind === "track" && i.id === selectedTrackId) ?? null;
  const unattached = items.filter(
    (i) =>
      (i.kind === "material" || i.kind === "revision") &&
      !i.trackId &&
      (!project || i.projectId === project),
  );
  const closed = (i: ProductionItem) =>
    [
      "Consegnato",
      "Consegnata",
      "Approvata",
      "Realizzato",
      "Archiviato",
      "Archiviata",
      "Registrata",
    ].includes(i.status);
  const shown = items.filter(
    (i) =>
      i.kind === kind &&
      (!project || i.projectId === project) &&
      (kind !== "recording" || !i.trackId) &&
      (!onlyOpen || !closed(i)) &&
      (
        i.title +
        " " +
        i.assignee +
        " " +
        (projects.find((p) => p.id === i.projectId)?.artist ?? "")
      )
        .toLocaleLowerCase("it")
        .includes(search.toLocaleLowerCase("it")),
  );
  const canWrite =
    writable &&
    projects.find((p) => p.id === draft.projectId)?.status !== "Archiviato";
  function openChild(childKind: ProductionKind, parent: ProductionItem) {
    setEditor("new");
    const newDraft = emptyProduction(childKind, parent.projectId);
    setDraft({
      ...newDraft,
      trackId: parent.id,
      details:
        childKind === "recording"
          ? { ...newDraft.details, phase: "Registrazione strumenti" }
          : newDraft.details,
    });
    setId(crypto.randomUUID());
    setFormError("");
  }
  return (
    <section>
      <div className="agenda-heading">
        <p>
          Ogni brano raccoglie sessioni, voci, mix, mastering, materiali e
          revisioni. Le registrazioni indipendenti restano in una sezione
          separata.
        </p>
        <button
          className="button"
          disabled={!writable || loading || !!error}
          onClick={() => open()}
        >
          +{" "}
          {kind === "recording"
            ? "Registrazione autonoma"
            : productionSpecs[kind].singular}
        </button>
      </div>
      <div
        className="production-tabs"
        role="group"
        aria-label="Aree produzione"
      >
        {kinds.map((k) => (
          <button
            key={k}
            className={kind === k ? "selected" : ""}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {productionSpecs[k].label}
            <span>
              {
                items.filter(
                  (i) =>
                    i.kind === k &&
                    (!project || i.projectId === project) &&
                    (k !== "recording" || !i.trackId),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="production-toolbar">
        <label>
          Progetto
          <select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">Tutti i progetti</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {p.artist}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cerca
          <input
            type="search"
            value={search}
            placeholder="Titolo, artista o responsabile"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="list-heading">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          Solo lavori aperti
        </label>
        <button
          className="secondary"
          disabled={loading}
          onClick={() => setRefresh((x) => x + 1)}
        >
          Aggiorna
        </button>
      </div>
      <p role="status">{error}</p>
      <div className="project-grid">
        {shown.map((i) => (
          <article className="project-card" key={i.id}>
            <div className="list-heading">
              <Link
                className="task-project"
                href={"/progetti?project=" + i.projectId}
              >
                {projects.find((p) => p.id === i.projectId)?.title}
              </Link>
              <span className="status-pill">{i.status}</span>
            </div>
            <h2>{i.title}</h2>
            <p className="project-artist">
              {projects.find((p) => p.id === i.projectId)?.artist}
              {i.trackId
                ? " · " + items.find((t) => t.id === i.trackId)?.title
                : ""}
            </p>
            {i.kind === "track" ? (
              <div className="phase-path">
                {productionSpecs.track.states
                  .filter((s) => s !== "Archiviato")
                  .map((s) => (
                    <span key={s} className={s === i.status ? "current" : ""}>
                      {s}
                    </span>
                  ))}
              </div>
            ) : null}
            {i.kind === "recording" ? (
              <p className="small">
                {i.details.phase || "Registrazione strumenti"} ·{" "}
                {i.details.instrument ||
                  i.details.musician ||
                  "Sessione autonoma"}
                {i.details.recordedOn
                  ? " · " +
                    new Date(
                      i.details.recordedOn + "T12:00:00Z",
                    ).toLocaleDateString("it-IT")
                  : ""}
              </p>
            ) : null}
            {i.kind === "material" || i.kind === "revision" ? (
              <p className="small">
                {i.details.versionLabel}
                {i.kind === "material" ? " · " + i.details.category : ""}
              </p>
            ) : null}
            {i.kind === "revision" ? (
              <p className="project-vision">{i.details.feedback}</p>
            ) : null}
            {i.kind === "live" ? (
              <p className="small">
                {i.details.venue || "Venue da definire"}
                {i.details.showDate
                  ? " · " +
                    new Date(
                      i.details.showDate + "T12:00:00Z",
                    ).toLocaleDateString("it-IT")
                  : ""}
              </p>
            ) : null}
            {i.kind === "track" ? (
              <div
                className="production-counts"
                aria-label="Lavorazioni collegate"
              >
                {(
                  ["recording", "material", "revision"] as ProductionKind[]
                ).map((k) => (
                  <span key={k}>
                    {k === "recording" ? "Sessioni" : productionSpecs[k].label}{" "}
                    ·{" "}
                    {
                      items.filter(
                        (child) => child.kind === k && child.trackId === i.id,
                      ).length
                    }
                  </span>
                ))}
              </div>
            ) : null}
            <div className="project-card-footer">
              <span>
                {i.assignee || "Responsabile da assegnare"}
                {i.deadline
                  ? " · " +
                    new Date(i.deadline + "T12:00:00Z").toLocaleDateString(
                      "it-IT",
                    )
                  : ""}
              </span>
              <button
                className="text-button"
                onClick={() =>
                  i.kind === "track" ? setSelectedTrackId(i.id) : open(i)
                }
              >
                {i.kind === "track" ? "Apri scheda brano ↗" : "Apri scheda ↗"}
              </button>
            </div>
            {i.details.url ? (
              <a
                className="text-button"
                target="_blank"
                rel="noopener noreferrer"
                href={i.details.url}
              >
                Apri materiale ↗
              </a>
            ) : null}
          </article>
        ))}
      </div>
      {!shown.length ? (
        <div className="empty">
          <h2>
            {loading
              ? "Caricamento…"
              : error
                ? "Archivio non disponibile"
                : "Il prossimo passo prende forma qui."}
          </h2>
          <p>
            Seleziona il progetto e aggiungi una scheda. I materiali restano nei
            servizi collegati tramite link.
          </p>
        </div>
      ) : null}
      {unattached.length ? (
        <section
          className="card"
          aria-label="Materiali e revisioni da collegare"
        >
          <h2>Materiali e revisioni da assegnare</h2>
          <p className="small">
            Queste schede precedenti non hanno un brano collegato: conservale e
            assegna il brano corretto senza perdere la cronologia.
          </p>
          <div className="track-entry-list">
            {unattached.map((i) => (
              <div className="track-entry" key={i.id}>
                <strong>{i.title}</strong>{" "}
                <span className="badge">{productionSpecs[i.kind].label}</span>
                <p className="small">
                  {projects.find((p) => p.id === i.projectId)?.title}
                </p>
                <button className="text-button" onClick={() => open(i)}>
                  Collega al brano ↗
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <TrackWorkspace
        track={selectedTrack}
        project={projects.find((p) => p.id === selectedTrack?.projectId)}
        items={items}
        writable={writable}
        onClose={() => setSelectedTrackId(null)}
        onEdit={(item) => open(item)}
        onAdd={openChild}
      />
      <dialog
        ref={dialog}
        className="event-dialog production-dialog"
        aria-labelledby="production-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="dialog-heading">
            <h2 id="production-title">
              {draft.kind === "recording"
                ? "Sessione di produzione"
                : productionSpecs[draft.kind].singular}
            </h2>
            <button
              type="button"
              disabled={busy}
              className="secondary"
              onClick={close}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
          <fieldset disabled={busy || !canWrite}>
            <label>
              Progetto
              <select
                required
                disabled={editor !== "new"}
                value={draft.projectId}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    projectId: e.target.value,
                    trackId: null,
                  })
                }
              >
                <option value="">Seleziona progetto</option>
                {projects.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.status === "Archiviato"}
                  >
                    {p.title} · {p.artist}
                  </option>
                ))}
              </select>
            </label>
            {draft.projectId ? (
              <p className="small">
                Artista:{" "}
                <strong>
                  {projects.find((p) => p.id === draft.projectId)?.artist ||
                    "Da definire"}
                </strong>
              </p>
            ) : null}
            <label>
              Titolo
              <input
                autoFocus
                required
                maxLength={300}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Stato
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value })
                  }
                >
                  {productionSpecs[draft.kind].states.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <AssigneeField
                email={draft.assigneeEmail}
                name={draft.assignee}
                onChange={(assigneeEmail, assignee) =>
                  setDraft({ ...draft, assigneeEmail, assignee })
                }
              />
            </div>
            <label>
              Scadenza operativa
              <input
                type="date"
                value={draft.deadline ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, deadline: e.target.value || null })
                }
              />
            </label>
            {draft.kind !== "track" && draft.kind !== "live" ? (
              <label>
                Brano collegato
                <select
                  required={
                    draft.kind === "material" || draft.kind === "revision"
                  }
                  value={draft.trackId ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, trackId: e.target.value || null })
                  }
                >
                  <option value="">
                    {draft.kind === "recording"
                      ? "Sessione autonoma, senza brano collegato"
                      : "Seleziona il brano da documentare"}
                  </option>
                  {items
                    .filter(
                      (t) =>
                        t.kind === "track" && t.projectId === draft.projectId,
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            {productionSpecs[draft.kind].fields.map((f) => (
              <label key={f.key}>
                {f.label}
                {f.key === "phase" ? (
                  <select
                    required
                    value={draft.details.phase || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        details: { ...draft.details, phase: e.target.value },
                      })
                    }
                  >
                    <option value="">Seleziona fase</option>
                    {sessionPhases.map((phase) => (
                      <option key={phase} value={phase}>
                        {phase}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    rows={4}
                    required={f.required}
                    maxLength={10000}
                    value={draft.details[f.key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        details: { ...draft.details, [f.key]: e.target.value },
                      })
                    }
                  />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    required={
                      f.required ||
                      (draft.kind === "recording" &&
                        ["instrument", "musician"].includes(f.key) &&
                        !["Editing", "Mix", "Mastering", "Altro"].includes(
                          draft.details.phase || "Registrazione strumenti",
                        ))
                    }
                    maxLength={1000}
                    value={draft.details[f.key] ?? ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        details: { ...draft.details, [f.key]: e.target.value },
                      })
                    }
                  />
                )}
              </label>
            ))}
            <label>
              Note interne
              <textarea
                rows={4}
                maxLength={10000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
          </fieldset>
          <p className="small">
            Scadenze e piano prove sono dati interni. Per un appuntamento
            sincronizzato usa il Calendario. I permessi dei file si gestiscono
            nel servizio che li ospita.
          </p>
          <p role="status">{formError}</p>
          <div className="dialog-actions">
            <button className="button" disabled={busy || !canWrite}>
              {busy
                ? "Salvataggio…"
                : canWrite
                  ? "Salva scheda"
                  : "Solo consultazione"}
            </button>
            <Link
              className="text-button"
              href={"/attivita?project=" + draft.projectId}
            >
              Attività del progetto ↗
            </Link>
          </div>
        </form>
        {editor && editor !== "new" ? (
          <details className="history-panel">
            <summary>Cronologia · {history.length} versioni</summary>
            <p role="status">{historyError}</p>
            {history.map((h) => (
              <details key={h.version}>
                <summary>
                  v{h.version} · {h.data.status} · {h.actor} ·{" "}
                  {new Date(h.recordedAt).toLocaleString("it-IT", {
                    timeZone: "Europe/Rome",
                  })}
                </summary>
                <p>
                  {h.data.title} · {h.data.assignee}
                </p>
                <p className="preserve-lines">{h.data.notes}</p>
                {productionSpecs[draft.kind].fields.map((f) =>
                  h.data.details[f.key] ? (
                    <p className="preserve-lines small" key={f.key}>
                      <strong>{f.label}:</strong> {h.data.details[f.key]}
                    </p>
                  ) : null,
                )}
              </details>
            ))}
          </details>
        ) : null}
      </dialog>
    </section>
  );
}
