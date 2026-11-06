"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { findFormTemplate } from "@/lib/form-templates";
import { suggestArtistDocuments } from "@/lib/artist-document-rules";
import type { StudioArtist } from "@/lib/artist-data";
import type { StudioProject } from "@/lib/project-data";
import type { ProductionItem } from "@/lib/production-data";
import "./artist-documents.css";

type TrackedDocument = {
  id: string;
  title: string;
  template: string;
  version: number;
  state: "ready" | "draft";
  workId: string | null;
  requiresSignature: boolean;
  signedVersion: number | null;
  signedOn: string | null;
  evidenceUrl: string | null;
};

function templateLink(template: string, artistId: string, workId?: string | null, documentId?: string) {
  const path = template === "studio-services-v1" ? "/modulistica/servizi"
    : "/modulistica/modelli/" + (findFormTemplate(template)?.slug ?? template);
  const params = new URLSearchParams({ artist: artistId });
  if (workId) params.set("work", workId);
  if (documentId) params.set("document", documentId);
  return path + "?" + params;
}

function documentStatus(doc: TrackedDocument) {
  if (doc.signedVersion === doc.version) return "Firmato";
  if (doc.state === "draft") return "Bozza";
  return doc.requiresSignature ? "Da firmare" : "Preparato";
}

export default function ArtistDocuments({ artist, projects, production }: {
  artist: StudioArtist;
  projects: StudioProject[];
  production: ProductionItem[];
}) {
  const [documents, setDocuments] = useState<TrackedDocument[] | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ doc: TrackedDocument; action: "link" | "sign" } | null>(null);
  const [workId, setWorkId] = useState("");
  const [signedOn, setSignedOn] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const endpoint = "/api/forms/artist-tracker";
  const artistId = artist.id;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint + "?artist=" + artistId, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setDocuments(data.documents);
      })
      .catch(err => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [artistId, refresh]);

  const artistProjects = projects.filter(project => project.artistId === artistId && !project.deletedAt);
  const projectIds = new Set(artistProjects.map(project => project.id));
  const works = [
    ...artistProjects,
    ...production.filter(item => ["track", "recording", "live", "service"].includes(item.kind) &&
      (item.projectId ? projectIds.has(item.projectId) : item.artistId === artistId)),
  ];
  const workTitles = new Map(works.map(work => [work.id, work.title]));
  const suggestions = suggestArtistDocuments(artistId, Boolean(artist.labelRoster), projects, production)
    .filter(suggestion => !documents?.some(doc => doc.template === suggestion.template && doc.workId === suggestion.workId));
  const signedCount = documents?.filter(doc => doc.signedVersion === doc.version).length ?? 0;
  const awaitingCount = documents?.filter(doc => documentStatus(doc) === "Da firmare").length ?? 0;
  const draftCount = documents?.filter(doc => doc.state === "draft").length ?? 0;

  function startEdit(doc: TrackedDocument, action: "link" | "sign") {
    setError("");
    setEditing({ doc, action });
    setWorkId(doc.workId ?? "");
    setSignedOn(doc.signedVersion === doc.version ? doc.signedOn ?? today : today);
    setEvidenceUrl(doc.signedVersion === doc.version ? doc.evidenceUrl ?? "" : "");
  }

  async function save(doc: TrackedDocument, action: "link" | "sign" | "clear") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: doc.id, version: doc.version, artistId, action,
          workId: workId || null, signedOn, evidenceUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setEditing(null);
      setRefresh(value => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aggiornamento non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="card artist-document-tracker" aria-label="Modulistica artista">
    <div className="list-heading">
      <h3>Modulistica e firme</h3>
      <Link className="text-button" href="/modulistica">Catalogo modelli ↗</Link>
    </div>
    {error ? <p role="alert">{error} <button type="button" className="text-button" disabled={busy}
      onClick={() => { setError(""); setRefresh(value => value + 1); }}>Ricarica</button></p> : null}
    {documents === null ? <p>{error ? "Verifica il caricamento dei documenti." : "Caricamento documenti…"}</p> : <>
      <ul className="artist-document-counts">
        <li><strong>{signedCount}</strong> firmati</li>
        <li><strong>{awaitingCount}</strong> da firmare</li>
        <li><strong>{draftCount}</strong> bozze</li>
        <li><strong>{suggestions.length}</strong> da valutare</li>
      </ul>

      <h4>Documenti collegati</h4>
      {documents.length === 0 ? <p>Nessun documento collegato. Puoi associare l’artista dal modulo esistente.</p> : null}
      {documents.map(doc => <div className="artist-document-row" key={doc.id}>
        <div className="artist-document-heading">
          <strong>{doc.title}</strong>
          <span className="status-pill">{documentStatus(doc)}</span>
        </div>
        <p className="small">{doc.workId ? workTitles.get(doc.workId) ?? "Lavoro non disponibile" : "Ambito artista"} · v{doc.version}</p>
        {doc.signedVersion && doc.signedOn ? <p className="small">
          Firma registrata il {new Date(doc.signedOn + "T12:00:00").toLocaleDateString("it-IT")} per la versione {doc.signedVersion}.
          {doc.signedVersion !== doc.version ? <> <Link href={"/modulistica/documenti/" + doc.id + "?version=" + doc.signedVersion}>Apri versione sottoscritta</Link></> : null}
          {doc.evidenceUrl ? <> <a href={doc.evidenceUrl} target="_blank" rel="noopener noreferrer">Copia firmata ↗</a></> : null}
        </p> : null}
        <div className="artist-document-actions">
          <Link className="text-button" href={"/modulistica/documenti/" + doc.id}>Anteprima ↗</Link>
          <Link className="text-button" href={templateLink(doc.template, artistId, null, doc.id)}>Modifica</Link>
          <button className="text-button" type="button" disabled={busy} onClick={() => startEdit(doc, "link")}>Associa lavoro</button>
          {doc.state === "ready" && doc.requiresSignature ? <button className="secondary" type="button" disabled={busy}
            onClick={() => startEdit(doc, "sign")}>{doc.signedVersion === doc.version ? "Modifica registrazione" : "Registra firma"}</button> : null}
        </div>
        {editing?.doc.id === doc.id ? <form className="artist-document-edit" onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void save(doc, editing.action);
        }}>
          <fieldset disabled={busy}>
            {editing.action === "link" ? <label>Lavoro collegato
              <select value={workId} onChange={event => setWorkId(event.target.value)}>
                <option value="">Ambito artista</option>
                {workId && !workTitles.has(workId) ? <option value={workId} disabled>Lavoro non disponibile</option> : null}
                {works.map(work => <option value={work.id} key={work.id}>{work.title}</option>)}
              </select>
            </label> : <>
              <p className="small">Registra la firma dopo aver ricevuto tutte le sottoscrizioni previste per la versione {doc.version}.</p>
              <label>Data di firma<input type="date" required max={today} value={signedOn}
                onChange={event => setSignedOn(event.target.value)} /></label>
              <label>Link alla copia firmata (facoltativo)<input type="url" maxLength={2000} placeholder="https://"
                value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} /></label>
            </>}
            <div className="artist-document-actions">
              <button className="button" type="submit">Salva</button>
              <button className="secondary" type="button" onClick={() => setEditing(null)}>Annulla</button>
              {editing.action === "sign" && doc.signedVersion === doc.version ? <button type="button" className="text-button"
                onClick={() => void save(doc, "clear")}>Rimuovi registrazione</button> : null}
            </div>
          </fieldset>
        </form> : null}
      </div>)}

      <h4>Moduli suggeriti da valutare</h4>
      <p className="small">Le proposte dipendono dai lavori registrati e dall’appartenenza al roster.</p>
      {suggestions.length === 0 ? <p>Nessun altro modulo suggerito per il percorso registrato.</p> : null}
      {suggestions.map(suggestion => <div className="artist-document-row" key={suggestion.template + ":" + suggestion.workId}>
        <div className="artist-document-heading">
          <strong>{suggestion.template === "studio-services-v1" ? "Accordo per servizi musicali" : findFormTemplate(suggestion.template)?.title}</strong>
          <span className="status-pill">{suggestion.workTitle || "Ambito artista"}</span>
        </div>
        <p className="small">{suggestion.reason}</p>
        <Link className="text-button" href={templateLink(suggestion.template, artistId, suggestion.workId)}>Compila il modulo ↗</Link>
      </div>)}
    </>}
  </section>;
}
