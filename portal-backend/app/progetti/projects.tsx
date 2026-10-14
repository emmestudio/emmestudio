"use client";
import QuoteFields from "./quote-fields";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  projectKinds,
  projectStates,
  projectProgress,
  type ProjectDraft,
  type StudioProject,
} from "@/lib/project-data";
import {
  emptyArtist,
  type ArtistDraft,
  type StudioArtist,
} from "@/lib/artist-data";
import {
  moneyInput,
  euro,
  quoteStates,
  type Ledger,
  type QuoteDraft,
} from "@/lib/finance-data";
const empty = (): ProjectDraft => ({
  title: "",
  artist: "",
  artistId: null,
  service: "Produzione musicale",
  kind: "Singolo",
  status: "Pianificazione",
  deadline: null,
  vision: "",
  notes: "",
  music: 0,
  live: 0,
  image: 0,
});
const date = (value: string) =>
  new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeZone: "Europe/Rome",
  }).format(new Date(value + "T12:00:00Z"));
export default function Projects() {
  const [artists, setArtists] = useState<StudioArtist[]>([]);
  const [financial, setFinancial] = useState(false),
    [ledger, setLedger] = useState<Ledger | null>(null);
  const [newArtist, setNewArtist] = useState(false),
    [artistDraft, setArtistDraft] = useState<ArtistDraft>(emptyArtist()),
    [artistId, setArtistId] = useState("");
  const [quote, setQuote] = useState<QuoteDraft>({
      amount: 0,
      status: "Bozza",
      notes: "",
    }),
    [amount, setAmount] = useState("0.00"),
    [quoteVersion, setQuoteVersion] = useState(0);
  const [writable, setWritable] = useState(false);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Attivi");
  const [editor, setEditor] = useState<StudioProject | "new" | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(empty());
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all(
      ["/api/projects", "/api/artists"].map(async (url) => {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      }),
    )
      .then(([data, a]) => {
        setArtists(a.artists);
        setFinancial(data.canManageFinance);
        setLedger(data.ledger ?? null);
        setProjects(data.projects);
        setWritable(Boolean(data.canEdit));
        setError("");
        if (!deepLinkOpened.current) {
          deepLinkOpened.current = true;
          const selectedId = new URLSearchParams(window.location.search).get(
            "project",
          );
          const selected = data.projects.find(
            (project: StudioProject) => project.id === selectedId,
          );
          if (selected) open(selected, data.ledger);
          else {
            const aId = new URLSearchParams(window.location.search).get(
              "artist",
            );
            const picked = a.artists.find(
              (item: StudioArtist) => item.id === aId,
            );
            if (picked) {
              open(undefined, data.ledger);
              setDraft({
                ...empty(),
                artistId: picked.id,
                artist: picked.name,
              });
            }
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Archivio non disponibile.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (editor && !dialog.current?.open) dialog.current?.showModal();
  }, [editor]);
  function open(project?: StudioProject, currentLedger = ledger) {
    const q = currentLedger?.quotes.find((q) => q.projectId === project?.id);
    setQuote(q ?? { amount: 0, status: "Bozza", notes: "" });
    setAmount(((q?.amount ?? 0) / 100).toFixed(2));
    setQuoteVersion(q?.version ?? 0);
    setNewArtist(false);
    setArtistDraft(emptyArtist());
    setArtistId(crypto.randomUUID());
    setEditor(project ?? "new");
    setDraft(project ? { ...project } : empty());
    setId(project?.id ?? crypto.randomUUID());
    setEditorError("");
  }
  function close() {
    if (!busy) {
      dialog.current?.close();
      setEditor(null);
    }
  }
  async function save() {
    setBusy(true);
    setEditorError("");
    try {
      const response = await fetch("/api/projects", {
        method: editor === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          version: editor && editor !== "new" ? editor.version : undefined,
          draft: {
            ...draft,
            artist: newArtist ? artistDraft.name : draft.artist,
          },
          newArtist: newArtist
            ? { id: artistId, draft: artistDraft }
            : undefined,
          quote: financial
            ? { ...quote, amount: moneyInput(amount) }
            : undefined,
          quoteVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      dialog.current?.close();
      setEditor(null);
      setMessage("Progetto salvato nell’archivio dello studio.");
      setRefresh((value) => value + 1);
    } catch (error) {
      setEditorError(
        error instanceof Error ? error.message : "Salvataggio non completato.",
      );
    } finally {
      setBusy(false);
    }
  }
  const shown = projects.filter((project) => {
    const state =
      filter === "Tutti" ||
      (filter === "Attivi"
        ? !["Completato", "Archiviato"].includes(project.status)
        : filter === "Completati"
          ? project.status === "Completato"
          : project.status === "Archiviato");
    return (
      state &&
      (project.title + " " + project.artist)
        .toLocaleLowerCase("it")
        .includes(search.toLocaleLowerCase("it"))
    );
  });
  return (
    <section aria-label="Archivio progetti">
      <div className="agenda-heading">
        <p>
          Produzione musicale, live e immagine: raccogli obiettivi e avanzamento
          di ogni progetto. I dati sono salvati nel database dedicato allo
          studio.
        </p>
        <button className="button" disabled={!writable} onClick={() => open()}>
          + Nuovo progetto
        </button>
      </div>
      <div className="project-toolbar">
        <label>
          <span className="sr-only">Cerca progetto o artista</span>
          <input
            type="search"
            placeholder="Cerca progetto o artista"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span className="sr-only">Filtra progetti</span>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            {["Attivi", "Tutti", "Completati", "Archiviati"].map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
        </label>
        <button
          className="secondary"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? "Caricamento…" : "Aggiorna"}
        </button>
      </div>
      <p role="status">{error || message}</p>
      <div className="project-grid">
        {shown.map((project) => (
          <article className="project-card" key={project.id}>
            <div className="list-heading">
              <span className="badge">{project.kind}</span>
              <span className="status-pill">{project.status}</span>
            </div>
            <h2>{project.title}</h2>
            <p className="project-artist">
              {project.artistId ? (
                <Link href={"/artisti?artist=" + project.artistId}>
                  {project.artist}
                </Link>
              ) : (
                project.artist
              )}
            </p>
            <span className="small">{project.service}</span>
            {financial &&
            ledger?.quotes.find((q) => q.projectId === project.id) ? (
              <p className="small">
                Preventivo{" "}
                {euro(
                  ledger.quotes.find((q) => q.projectId === project.id)!.amount,
                )}{" "}
                ·{" "}
                {ledger.quotes.find((q) => q.projectId === project.id)!.status}
              </p>
            ) : null}
            {project.vision ? (
              <p className="project-vision">{project.vision}</p>
            ) : null}
            <div className="progress-heading">
              <span>Aree di lavoro</span>
              <strong>{projectProgress(project)}%</strong>
            </div>
            <progress
              max={100}
              value={projectProgress(project)}
              aria-label={`Avanzamento manuale ${project.title}`}
            />
            <div className="area-labels">
              <span>Musica {project.music}%</span>
              <span>Live {project.live}%</span>
              <span>Immagine {project.image}%</span>
            </div>
            <div className="project-card-footer">
              <span>
                {project.deadline
                  ? "Scadenza " + date(project.deadline)
                  : "Scadenza da definire"}
              </span>
              <button className="text-button" onClick={() => open(project)}>
                Apri progetto ↗
              </button>
            </div>
          </article>
        ))}
      </div>
      {!shown.length ? (
        <div className="empty">
          <h2>
            {loading
              ? "Caricamento progetti…"
              : error
                ? "Archivio non disponibile"
                : projects.length
                  ? "Nessun progetto corrisponde alla ricerca."
                  : "Il prossimo progetto parte da qui."}
          </h2>
          <p>
            {error
              ? "Usa Aggiorna per riprovare."
              : "Crea una scheda per un singolo, un album, uno show live o un percorso artistico."}
          </p>
        </div>
      ) : null}
      <dialog
        ref={dialog}
        className="event-dialog project-dialog"
        aria-labelledby="project-title"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          if (!busy) setEditor(null);
        }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="dialog-heading">
            <h2 id="project-title">
              {editor === "new" ? "Nuovo progetto" : "Scheda progetto"}
            </h2>
            <button
              className="secondary"
              type="button"
              disabled={busy}
              onClick={close}
              aria-label="Chiudi"
            >
              ×
            </button>
          </div>
          <fieldset disabled={busy || !writable}>
            <label>
              Titolo progetto
              <input
                required
                autoFocus
                maxLength={200}
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
              />
            </label>
            <label>
              Artista registrato
              <select
                required={!newArtist}
                value={newArtist ? "new" : (draft.artistId ?? "")}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewArtist(value === "new");
                  const a = artists.find((a) => a.id === value);
                  setDraft({
                    ...draft,
                    artistId: a?.id ?? null,
                    artist: a?.name ?? "",
                  });
                }}
              >
                <option value="">Seleziona artista</option>
                {artists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.email ? " · " + a.email : ""}
                  </option>
                ))}
                <option value="new">+ Crea un nuovo artista</option>
              </select>
            </label>
            {newArtist ? (
              <div className="inline-panel">
                <h3>Nuovo profilo artista</h3>
                <label>
                  Nome artista
                  <input
                    required
                    maxLength={200}
                    value={artistDraft.name}
                    onChange={(e) =>
                      setArtistDraft({ ...artistDraft, name: e.target.value })
                    }
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Email
                    <input
                      type="email"
                      maxLength={200}
                      value={artistDraft.email}
                      onChange={(e) =>
                        setArtistDraft({
                          ...artistDraft,
                          email: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Telefono
                    <input
                      maxLength={200}
                      value={artistDraft.phone}
                      onChange={(e) =>
                        setArtistDraft({
                          ...artistDraft,
                          phone: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={artistDraft.direction}
                    onChange={(e) =>
                      setArtistDraft({
                        ...artistDraft,
                        direction: e.target.checked,
                      })
                    }
                  />
                  In direzione artistica
                </label>
                <p className="small">
                  Profilo e progetto vengono salvati insieme. Completa la scheda
                  nella sezione Artisti.
                </p>
              </div>
            ) : null}
            <label>
              Servizio
              <input
                required
                list="studio-services"
                maxLength={200}
                value={draft.service ?? "Da definire"}
                onChange={(e) =>
                  setDraft({ ...draft, service: e.target.value })
                }
              />
              <datalist id="studio-services">
                {[
                  "Produzione musicale",
                  "Registrazione",
                  "Mix e mastering",
                  "Produzione tecnica live",
                  "Direzione artistica",
                  "Immagine e comunicazione",
                  "Percorso completo",
                  "Altro",
                ].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
            <div className="form-grid">
              <label>
                Tipo
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft({ ...draft, kind: event.target.value })
                  }
                >
                  {projectKinds.map((kind) => (
                    <option key={kind}>{kind}</option>
                  ))}
                </select>
              </label>
              <label>
                Stato
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value })
                  }
                >
                  {projectStates.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Scadenza
              <input
                type="date"
                value={draft.deadline ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, deadline: event.target.value || null })
                }
              />
            </label>
            <label>
              Visione e obiettivo
              <textarea
                rows={3}
                maxLength={3000}
                value={draft.vision}
                onChange={(event) =>
                  setDraft({ ...draft, vision: event.target.value })
                }
              />
            </label>
            {financial ? (
              <div className="inline-panel">
                <h3>Preventivo · riservato</h3>
                <QuoteFields
                  quote={quote}
                  setQuote={setQuote}
                  amount={amount}
                  setAmount={setAmount}
                />
                <p className="small">
                  Solo i preventivi confermati alimentano gli importi da
                  incassare. Rate e incassi si gestiscono in Guadagni.
                </p>
                {editor && editor !== "new" ? (
                  <Link
                    className="text-button"
                    href={"/guadagni?project=" + editor.id}
                  >
                    Incassi e scadenze di questo progetto ↗
                  </Link>
                ) : null}
              </div>
            ) : null}
            <h3>Aree di lavoro</h3>
            <p className="small">
              L’indicatore è aggiornato manualmente: ogni area ha lo stesso
              peso.
            </p>
            <div className="areas-form">
              {(["music", "live", "image"] as const).map((key, index) => (
                <label key={key}>
                  {
                    [
                      "Produzione musicale",
                      "Produzione live",
                      "Immagine e comunicazione",
                    ][index]
                  }
                  <select
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft({ ...draft, [key]: Number(event.target.value) })
                    }
                  >
                    <option value={0}>Da avviare · 0%</option>
                    <option value={50}>In corso · 50%</option>
                    <option value={100}>Completata · 100%</option>
                  </select>
                </label>
              ))}
            </div>
            <label>
              Note del progetto
              <textarea
                rows={5}
                maxLength={10000}
                value={draft.notes}
                onChange={(event) =>
                  setDraft({ ...draft, notes: event.target.value })
                }
              />
            </label>
            <p className="small">
              Per conservare un progetto concluso, imposta lo stato
              “Archiviato”. Puoi riattivarlo in seguito.
            </p>
          </fieldset>
          <p role="status" aria-live="polite">
            {editorError}
          </p>
          <div className="dialog-actions">
            <button
              className="button"
              disabled={busy || !writable}
              type="submit"
            >
              {!writable
                ? "Solo consultazione"
                : busy
                  ? "Salvataggio…"
                  : "Salva progetto"}
            </button>
            {editor && editor !== "new" ? (
              <Link
                className="text-button"
                href={"/produzione?project=" + editor.id}
              >
                Brani, materiali e show ↗
              </Link>
            ) : null}
            {editor && editor !== "new" ? (
              <Link
                className="text-button"
                href={"/attivita?project=" + editor.id}
              >
                Attività del progetto ↗
              </Link>
            ) : null}
          </div>
        </form>
      </dialog>
    </section>
  );
}
