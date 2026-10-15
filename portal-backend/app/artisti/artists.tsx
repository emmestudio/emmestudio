"use client";
import type {FinanceTarget} from "@/lib/finance-targets";
import {productionSpecs, type ProductionItem} from "@/lib/production-data";
import RemoveButton from "../remove-button";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  emptyArtist,
  workGroup,
  type ArtistDraft,
  type StudioArtist,
} from "@/lib/artist-data";
import { projectProgress, type StudioProject } from "@/lib/project-data";
import { type Ledger, projectBalance, euro } from "@/lib/finance-data";
export default function Artists() {
  const [financialTargets,setFinancialTargets]=useState<FinanceTarget[]>([]);
  const [production,setProduction] = useState<ProductionItem[]>([]);
  const [admin, setAdmin] = useState(false);
  const [artists, setArtists] = useState<StudioArtist[]>([]),
    [projects, setProjects] = useState<StudioProject[]>([]),
    [ledger, setLedger] = useState<Ledger | null>(null);
  const [writable, setWritable] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [refresh, setRefresh] = useState(0),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("Tutti");
  const [selected, setSelected] = useState<StudioArtist | null>(null),
    [editor, setEditor] = useState<StudioArtist | "new" | null>(null),
    [draft, setDraft] = useState<ArtistDraft>(emptyArtist()),
    [id, setId] = useState(""),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    Promise.all(
      ["/api/artists", "/api/projects", "/api/production"].map(async (url) => {
        const r = await fetch(url, { cache: "no-store", signal: c.signal });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    )
      .then(([a, p, pr]) => {
        setProduction(pr.items);
        setAdmin(Boolean(p.canManageFinance));
        setArtists(a.artists);
        setWritable(a.canEdit);
        setProjects(p.projects);
        setLedger(p.ledger ?? null);
        setFinancialTargets(p.financialTargets ?? []);
        setError("");
        setSelected(
          (old) =>
            a.artists.find(
              (x: StudioArtist) =>
                x.id ===
                (old?.id ??
                  new URLSearchParams(window.location.search).get("artist")),
            ) ?? null,
        );
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
  }, [editor]);
  function open(a?: StudioArtist) {
    setEditor(a ?? "new");
    setDraft(a ? { ...a } : emptyArtist());
    setId(a?.id ?? crypto.randomUUID());
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
    try {
      const r = await fetch("/api/artists", {
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
  const shown = artists.filter(
    (a) =>
      (filter !== "Direzione artistica" || a.direction) &&
      (a.name + " " + (a.firstName || "") + " " + (a.lastName || "") + " " + a.genre)
        .toLocaleLowerCase("it")
        .includes(search.toLocaleLowerCase("it")),
  );
  const works = projects.filter((p) => p.artistId === selected?.id);
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Rome",
  });
  return (
    <section>
      <div className="agenda-heading">
        <p>
          Profili, contatti e direzione artistica. Ogni scheda riunisce il
          lavoro dello studio per l’artista, dalla prima idea ai progetti
          conclusi.
        </p>
        <button className="button" disabled={!writable} onClick={() => open()}>
          + Nuovo artista
        </button>
      </div>
      <div className="project-toolbar">
        <label>
          <span className="sr-only">Cerca artista</span>
          <input
            type="search"
            placeholder="Cerca artista o genere"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filtro artisti</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>Tutti</option>
            <option>Direzione artistica</option>
          </select>
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
      <div className="artist-layout">
        <aside className="artist-index" aria-label="Artisti">
          {shown.map((a) => (
            <button
              className={
                "artist-choice" + (selected?.id === a.id ? " selected" : "")
              }
              key={a.id}
              onClick={() => setSelected(a)}
            >
              <span className="artist-monogram">
                {a.name.slice(0, 2).toLocaleUpperCase("it")}
              </span>
              <span>
                <strong>{a.name}</strong>
                <small>
                  {a.direction
                    ? "Direzione artistica"
                    : a.genre || "Profilo artista"}{" "}
                  · {projects.filter((p) => p.artistId === a.id).length}{" "}
                  progetti
                </small>
              </span>
              <span>↗</span>
            </button>
          ))}
          {!shown.length ? (
            <p>
              {loading
                ? "Caricamento…"
                : error
                  ? "Archivio non disponibile."
                  : "Nessun artista trovato."}
            </p>
          ) : null}
        </aside>
        {selected ? (
          <div className="artist-detail">
            <section className="card artist-hero">
              <span className="eyebrow">
                {selected.direction ? "DIREZIONE ARTISTICA" : "PROFILO ARTISTA"}
              </span>
              <h2>{selected.name}</h2>
              {selected.firstName || selected.lastName ? <p>{[selected.firstName,selected.lastName].filter(Boolean).join(" ")}</p> : null}
              <p>{selected.genre || "Genere e identità da definire"}</p>
              <div className="contact-chips">
                {selected.email ? (
                  <a href={"mailto:" + selected.email}>{selected.email}</a>
                ) : null}
                {selected.phone ? <span>{selected.phone}</span> : null}
              </div>
              {selected.direction ? (
                <p>
                  <strong>Referente del percorso:</strong>{" "}
                  {selected.director || "Team Emme Studio"}
                </p>
              ) : null}
              {selected.objectives ? (
                <p className="preserve-lines">{selected.objectives}</p>
              ) : null}
              <div className="dialog-actions">
                <button className="secondary" onClick={() => open(selected)}>
                  {writable ? "Modifica profilo" : "Consulta profilo"}
                </button>
                {writable ? (
                  <Link
                    className="button"
                    href={"/progetti?artist=" + selected.id}
                  >
                    + Progetto per l’artista
                  </Link>
                ) : null}
                {writable ? <><Link className="button" href={"/produzione?artist="+selected.id+"&kind=track&new=1"}>+ Brano singolo</Link><Link className="secondary" href={"/produzione?artist="+selected.id+"&kind=recording&new=1"}>+ Registrazione</Link><Link className="secondary" href={"/produzione?artist="+selected.id+"&kind=service&new=1"}>+ Servizio singolo</Link></> : null}
              </div>
            </section>
            <div className="artist-counts">
              {["Da realizzare", "In realizzazione", "Realizzati"].map((g) => (
                <div key={g}>
                  <strong>
                    {works.filter((p) => workGroup(p.status) === g).length + production.filter(i=>i.artistId===selected.id && !i.projectId && !i.trackId && ( ["Consegnato","Completato","Registrata","Completata","Realizzato","Archiviato","Archiviata"].includes(i.status) ? "Realizzati" : ["Preproduzione","Pianificata","Da pianificare"].includes(i.status) ? "Da realizzare" : "In realizzazione") === g).length}
                  </strong>
                  <span>{g}</span>
                </div>
              ))}
            </div>
            <section className="card">
              <h3>Brani e servizi singoli</h3><p className="small">Lavori direttamente collegati all’artista, senza progetto.</p>
              {production.filter(i=>i.artistId===selected.id && !i.projectId && !i.trackId).map(i=><div className="ledger-row" key={i.id}><div><strong>{i.title}</strong><p className="small">{productionSpecs[i.kind].singular} · {i.status}</p></div><Link className="text-button" href={"/produzione?artist="+selected.id+"&kind="+i.kind+(i.kind==="track"?"&track="+i.id:"")}>Apri ↗</Link></div>)}
              {!production.some(i=>i.artistId===selected.id && !i.projectId && !i.trackId) ? <p>Nessun lavoro singolo presente.</p> : null}
            </section>
            {ledger ? (
              <section className="card">
                <h3>Situazione economica · riservata</h3>
                <div className="finance-inline">
                  <span>
                    Incassato{" "}
                    <strong>
                      {euro(
                        financialTargets.filter(p=>p.artistId===selected.id).reduce(
                          (s, p) =>
                            s + projectBalance(p.id, ledger, today).received,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                  <span>
                    Da incassare{" "}
                    <strong>
                      {euro(
                        financialTargets.filter(p=>p.artistId===selected.id).reduce(
                          (s, p) =>
                            s + projectBalance(p.id, ledger, today).outstanding,
                          0,
                        ),
                      )}
                    </strong>
                  </span>
                  <Link
                    className="text-button"
                    href={"/guadagni?artist=" + selected.id}
                  >
                    Registro e scadenze ↗
                  </Link>
                </div>
              </section>
            ) : null}
            {[
              "In realizzazione",
              "Da realizzare",
              "Realizzati",
              "Archivio",
            ].map((g) => (
              <section className="card" key={g}>
                <div className="list-heading">
                  <h3>{g}</h3>
                  <span className="status-pill">
                    {works.filter((p) => workGroup(p.status) === g).length + production.filter(i=>i.artistId===selected.id && !i.projectId && !i.trackId && ( ["Consegnato","Completato","Registrata","Completata","Realizzato","Archiviato","Archiviata"].includes(i.status) ? "Realizzati" : ["Preproduzione","Pianificata","Da pianificare"].includes(i.status) ? "Da realizzare" : "In realizzazione") === g).length}
                  </span>
                </div>
                {works
                  .filter((p) => workGroup(p.status) === g)
                  .map((p) => (
                    <Link
                      key={p.id}
                      className="dashboard-project"
                      href={"/progetti?project=" + p.id}
                    >
                      <div>
                        <span className="badge">
                          {p.service} · {p.status}
                        </span>
                        <h3>{p.title}</h3>
                        <p>
                          {p.deadline
                            ? "Scadenza " +
                              new Date(
                                p.deadline + "T12:00:00Z",
                              ).toLocaleDateString("it-IT")
                            : "Scadenza da definire"}
                        </p>
                      </div>
                      <span className="project-percent">
                        {projectProgress(p)}%
                      </span>
                    </Link>
                  ))}
                {!works.some((p) => workGroup(p.status) === g) ? (
                  <p className="small">Nessun progetto in questa fase.</p>
                ) : null}
              </section>
            ))}
            {selected.links || selected.notes ? (
              <details className="card">
                <summary>Link e note dell’artista</summary>
                <p className="preserve-lines">{selected.links}</p>
                <p className="preserve-lines">{selected.notes}</p>
              </details>
            ) : null}
          </div>
        ) : (
          <div className="empty">
            <h2>Il percorso in una sola scheda.</h2>
            <p>
              Seleziona un artista per vedere progetti, obiettivi e direzione
              artistica.
            </p>
          </div>
        )}
      </div>
      <dialog
        ref={dialog}
        className="event-dialog"
        aria-labelledby="artist-title"
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
            <h2 id="artist-title">
              {editor === "new" ? "Nuovo artista" : "Profilo artista"}
            </h2>
            <button
              type="button"
              className="secondary"
              onClick={close}
              disabled={busy}
            >
              ×
            </button>
          </div>
          <fieldset disabled={busy || !writable}>
            <div className="form-grid">
              <label>Nome<input maxLength={200} autoComplete="given-name" value={draft.firstName ?? ""} onChange={e=>setDraft({...draft,firstName:e.target.value})}/></label>
              <label>Cognome<input maxLength={200} autoComplete="family-name" value={draft.lastName ?? ""} onChange={e=>setDraft({...draft,lastName:e.target.value})}/></label>
            </div>
            <label>
              Nome artista / gruppo
              <input
                autoFocus
                required
                maxLength={200}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Email
                <input
                  type="email"
                  maxLength={200}
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                />
              </label>
              <label>
                Telefono
                <input
                  type="tel"
                  maxLength={200}
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              Genere e identità
              <input
                maxLength={200}
                value={draft.genre}
                onChange={(e) => setDraft({ ...draft, genre: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.direction}
                onChange={(e) =>
                  setDraft({ ...draft, direction: e.target.checked })
                }
              />
              Percorso in direzione artistica
            </label>
            <label>
              Referente della direzione artistica
              <input
                placeholder="Team Emme Studio o referente assegnato"
                maxLength={200}
                value={draft.director}
                onChange={(e) =>
                  setDraft({ ...draft, director: e.target.value })
                }
              />
            </label>
            <label>
              Obiettivi del percorso
              <textarea
                rows={4}
                maxLength={5000}
                value={draft.objectives}
                onChange={(e) =>
                  setDraft({ ...draft, objectives: e.target.value })
                }
              />
            </label>
            <label>
              Link social, streaming e portfolio
              <textarea
                maxLength={5000}
                value={draft.links}
                onChange={(e) => setDraft({ ...draft, links: e.target.value })}
              />
            </label>
            <label>
              Note interne
              <textarea
                maxLength={5000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
          </fieldset>
          <p role="status">{formError}</p>
          <button className="button" disabled={busy || !writable}>
            {busy ? "Salvataggio…" : "Salva artista"}
          </button>
        </form>
        {admin && editor && editor !== "new" ? (
          <RemoveButton
            key={editor.id}
            kind="artist"
            id={editor.id}
            version={editor.version}
            title={editor.name}
            onRemoved={() => {
              dialog.current?.close();
              setEditor(null);
              setSelected(null);
              setRefresh((n) => n + 1);
            }}
          />
        ) : null}
      </dialog>
    </section>
  );
}
