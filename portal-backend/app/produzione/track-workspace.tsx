"use client";
import TrackSharing from "./track-sharing";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  productionSpecs,
  sessionPhases,
  type ProductionItem,
  type ProductionKind,
} from "@/lib/production-data";
import type { StudioProject } from "@/lib/project-data";

type Tab = "overview" | "recording" | "material" | "revision" | "sharing";
type Props = {
  track: ProductionItem | null;
  artistName?: string;
  project: StudioProject | undefined;
  items: ProductionItem[];
  writable: boolean;
  onClose: () => void;
  onEdit: (item: ProductionItem) => void;
  onAdd: (kind: ProductionKind, track: ProductionItem) => void;
};
const fmtDate = (value: string | null | undefined) =>
  value
    ? new Date(value + "T12:00:00Z").toLocaleDateString("it-IT")
    : "Da definire";

const views: { key: Tab; label: string }[] = [
  { key: "overview", label: "Panoramica" },
  { key: "recording", label: "Sessioni" },
  { key: "material", label: "Materiali e versioni" },
  { key: "revision", label: "Revisioni" },
  { key: "sharing", label: "Area Artista" },
];
export default function TrackWorkspace({
  track,
  artistName,
  project,
  items,
  writable,
  onClose,
  onEdit,
  onAdd,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>("overview");
  useEffect(() => {
    if (track && !dialog.current?.open) dialog.current?.showModal();
    if (!track && dialog.current?.open) dialog.current.close();
  }, [track]);
  useEffect(() => setTab("overview"), [track?.id]);
  const children = items.filter((item) => item.trackId === track?.id);
  const counts = (kind: ProductionKind) =>
    children.filter((item) => item.kind === kind).length;
  const canWrite = writable && (!track?.projectId || (!!project && project.status !== "Archiviato"));
  const details = track?.details ?? {};
  return (
    <dialog
      ref={dialog}
      className="event-dialog track-workspace"
      aria-labelledby="track-workspace-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      {track ? (
        <div className="track-workspace-content">
          <div className="dialog-heading">
            <div>
              <span className="eyebrow">EMME STUDIO · SCHEDA BRANO</span>
              <p className="track-breadcrumb">
                <Link href={track.projectId ? "/progetti?project=" + track.projectId : "/artisti?artist=" + track.artistId}>
                  {project?.title ?? "Brano singolo"}
                </Link>
                <span aria-hidden="true"> / </span>
                {artistName || project?.artist || "Artista da definire"}
              </p>
              <h2 id="track-workspace-title">{track.title}</h2>
              <span className="status-pill">{track.status}</span>
            </div>
            <button className="secondary track-close" type="button" onClick={onClose} aria-label="Chiudi scheda brano">
              ×
            </button>
          </div>
          <div className="track-summary" aria-label="Riepilogo brano">
            <div><span>Artista</span><strong>{artistName || project?.artist || "Da definire"}</strong></div>
            <div><span>BPM</span><strong>{details.bpm || "—"}</strong></div>
            <div><span>Tonalità</span><strong>{details.key || "—"}</strong></div>
            <div><span>Durata</span><strong>{details.duration || "—"}</strong></div>
            <div><span>Responsabile</span><strong>{track.assignee || "Da assegnare"}</strong></div>
            <div><span>Scadenza</span><strong>{fmtDate(track.deadline)}</strong></div>
          </div>
          <div className="phase-path track-phase">
            {productionSpecs.track.states
              .filter((state) => state !== "Archiviato")
              .map((state) => (
                <span key={state} className={state === track.status ? "current" : ""}>
                  {state}
                </span>
              ))}
          </div>
          <div className="track-nav" role="group" aria-label="Sezioni della scheda brano">
            {views.map((view) => (
              <button
                type="button"
                key={view.key}
                aria-pressed={tab === view.key}
                className={tab === view.key ? "selected" : ""}
                onClick={() => setTab(view.key)}
              >
                {view.label}
                {view.key !== "overview" && view.key !== "sharing" ? <span>{counts(view.key)}</span> : null}
              </button>
            ))}
          </div>
          {tab === "sharing" ? (track.artistId || project?.artistId) ? <TrackSharing key={track.id} trackId={track.id} artistId={(project?.artistId || track.artistId)!}/> : <p>Assegna prima un artista al brano.</p> : tab === "overview" ? (
            <section className="track-panel" aria-label="Informazioni brano">
              <div className="track-panel-heading">
                <div>
                  <h3>Identità e lavorazione</h3>
                  <p>Le informazioni centrali del brano e la sua direzione musicale.</p>
                </div>
                <button type="button" className="secondary" disabled={!canWrite} onClick={() => onEdit(track)}>
                  Modifica brano
                </button>
              </div>
              <div className="track-details">
                {[
                  ["Genere / sound", details.genre],
                  ["Uscita prevista", details.releaseDate ? fmtDate(details.releaseDate) : ""],
                  ["Crediti e musicisti", details.credits],
                  ["Arrangiamento e produzione", details.arrangement],
                  ["Significato e direzione", details.meaning],
                  ["Note operative", track.notes],
                  ["Testo", details.lyrics],
                ].map(([label, value]) => (
                  <div key={label} className="track-detail">
                    <span>{label}</span>
                    <p className="preserve-lines">{value || "Non ancora compilato"}</p>
                  </div>
                ))}
              </div>
              {details.reference ? (
                <a className="text-button" href={details.reference} target="_blank" rel="noopener noreferrer">
                  Apri reference ↗
                </a>
              ) : null}
              {track.projectId ? <Link className="text-button" href={"/attivita?project=" + track.projectId}>
                Vai alle attività del progetto ↗
              </Link> : null}
            </section>
          ) : (
            <section className="track-panel" aria-label={views.find((v) => v.key === tab)?.label}>
              <div className="track-panel-heading">
                <div>
                  <h3>
                    {tab === "recording" ? "Sessioni di produzione" : productionSpecs[tab].label}
                  </h3>
                  <p>
                    {tab === "recording"
                      ? "Registrazione strumenti e voce, editing, mix e mastering: tutto collegato a questo brano."
                      : tab === "material"
                        ? "Sessioni, bounce, mix, master e file condivisi, organizzati per versione."
                        : "Feedback, interventi e approvazioni registrate dal team per ogni versione."}
                  </p>
                </div>
                <button type="button" className="button" disabled={!canWrite} onClick={() => onAdd(tab, track)}>
                  + {tab === "recording" ? "Nuova sessione" : tab === "material" ? "Nuovo materiale" : "Nuova revisione"}
                </button>
              </div>
              {tab === "recording" ? (
                <div className="track-phase-counts">
                  {sessionPhases.map((phase) => (
                    <span key={phase}>
                      {phase} <strong>{children.filter((c) => c.kind === "recording" && (c.details.phase || "Registrazione strumenti") === phase).length}</strong>
                    </span>
                  ))}
                </div>
              ) : null}
              {children.filter((item) => item.kind === tab).length ? (
                <div className="track-entry-list">
                  {children.filter((item) => item.kind === tab).map((item) => (
                    <article key={item.id} className="track-entry">
                      <div className="list-heading">
                        <span className="badge">
                          {item.kind === "recording"
                            ? item.details.phase || "Registrazione strumenti"
                            : item.kind === "material"
                              ? item.details.category
                              : item.details.versionLabel}
                        </span>
                        <span className="status-pill">{item.status}</span>
                      </div>
                      <h4>{item.title}</h4>
                      <p className="small">
                        {item.kind === "recording"
                          ? [item.details.instrument, item.details.musician, item.details.engineer, item.details.studio, item.details.recordedOn && fmtDate(item.details.recordedOn)]
                              .filter(Boolean).join(" · ")
                          : item.kind === "material"
                            ? item.details.versionLabel
                            : item.details.versionLabel + (item.details.approvalOn ? " · " + fmtDate(item.details.approvalOn) : "")}
                      </p>
                      {item.kind === "recording" && item.details.result ? <p className="preserve-lines">{item.details.result}</p> : null}
                      {item.kind === "revision" && item.details.feedback ? <p className="preserve-lines">{item.details.feedback}</p> : null}
                      <div className="track-entry-actions">
                        <button type="button" className="text-button" onClick={() => onEdit(item)}>
                          {canWrite ? "Apri / modifica ↗" : "Visualizza dettagli ↗"}
                        </button>
                        {(item.details.sessionLink || item.details.url) ? (
                          <a className="text-button" href={item.details.sessionLink || item.details.url} target="_blank" rel="noopener noreferrer">
                            Apri file ↗
                          </a>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty track-empty">
                  <h3>Nessuna scheda presente</h3>
                  <p>
                    {canWrite
                      ? "Aggiungi la prima scheda per documentare questa fase di lavorazione."
                      : "Le schede registrate dal team saranno consultabili qui."}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
