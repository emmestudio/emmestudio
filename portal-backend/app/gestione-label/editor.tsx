"use client";

import { useEffect, useState } from "react";
import { labelSite, labelSlug, labelSocials, releaseTypes, type LabelEntry } from "@/lib/label-catalog-data";
import { newsCoverMaxBytes } from "@/lib/news-data";

const endpoint = "/api/label-catalog";
const empty = (kind: LabelEntry["kind"]): LabelEntry => ({
  id: "", version: 0, published: false, publishedOnce: false, kind, name: "", slug: "", tagline: "", body: "",
  photo: "", links: {}, artistSlug: "", artistName: "", type: "", date: "", spotify: "",
});

export default function Editor() {
  const [entries, setEntries] = useState<LabelEntry[]>([]);
  const [draft, setDraft] = useState(empty("artist"));
  const [upload, setUpload] = useState("");
  const [localPhoto, setLocalPhoto] = useState("");
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const artist = draft.kind === "artist";
  const patch = (value: Partial<LabelEntry>) => { setDraft(previous => ({ ...previous, ...value })); setDirty(true); };
  useEffect(() => {
    fetch(endpoint, { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setEntries(data.entries);
      setReady(true);
    }).catch(() => setError("Catalogo non disponibile. Ricarica la pagina.")).finally(() => setBusy(false));
  }, []);
  useEffect(() => () => { if (localPhoto) URL.revokeObjectURL(localPhoto); }, [localPhoto]);

  function open(entry: LabelEntry) {
    if (dirty && !window.confirm("Cambiare scheda e scartare le modifiche non salvate?")) return;
    setDraft(entry);
    setUpload("");
    setLocalPhoto("");
    setDirty(false);
    setError("");
    setNotice("");
  }

  async function selectImage(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    if (!file.size || file.size > newsCoverMaxBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Scegli un JPG, PNG o WebP fino a 30 MB.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const start = await fetch("/api/news/cover-upload?action=start", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: file.size, type: file.type }),
      });
      const ticket = await start.json();
      if (!start.ok || !ticket.id || !(ticket.chunkSize > 0)) throw Error(ticket.error || "Caricamento non disponibile.");
      for (let offset = 0; offset < file.size; offset += ticket.chunkSize) {
        const end = Math.min(offset + ticket.chunkSize, file.size);
        const response = await fetch("/api/news/cover-upload?action=chunk", {
          method: "POST", headers: { "x-upload-id": ticket.id, "x-upload-offset": String(offset) },
          body: file.slice(offset, end),
        });
        const result = await response.json();
        if (!response.ok || result.received !== end) throw Error(result.error || "Caricamento interrotto.");
        setProgress(Math.round(end / file.size * 100));
      }
      setUpload(ticket.id);
      setLocalPhoto(URL.createObjectURL(file));
      setDirty(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Caricamento non riuscito."); }
    finally { setBusy(false); setProgress(null); }
  }

  async function save(published: boolean) {
    if (draft.published && !published && !window.confirm("Ritirare questa scheda dal sito pubblico?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, published, upload }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      const entry: LabelEntry = data.entry;
      setEntries(previous => previous.some(item => item.id === entry.id)
        ? previous.map(item => item.id === entry.id ? entry : item) : [...previous, entry]);
      setDraft(entry);
      setUpload("");
      setLocalPhoto("");
      setDirty(false);
      setNotice(published ? "Scheda pubblicata sul sito." : "Bozza salvata nel portale.");
    } catch (err) { setError(err instanceof Error ? err.message : "Salvataggio non riuscito."); }
    finally { setBusy(false); }
  }

  async function changeCatalogue(method: "PATCH" | "DELETE", input: object) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setEntries(data.entries);
      if (method === "DELETE") {
        setDraft(empty(draft.kind));
        setUpload("");
        setLocalPhoto("");
        setDirty(false);
      }
      setNotice(method === "PATCH" ? "Ordine aggiornato sul sito." : "Scheda eliminata.");
    } catch (err) { setError(err instanceof Error ? err.message : "Aggiornamento non riuscito."); }
    finally { setBusy(false); }
  }

  function remove() {
    const detail = artist ? " Le uscite collegate restano nel catalogo con il nome dell’artista." : "";
    if (!window.confirm(`Eliminare definitivamente «${draft.name}»?${detail}`)) return;
    void changeCatalogue("DELETE", { id: draft.id, version: draft.version, confirm: true });
  }

  const photo = localPhoto || draft.photo;
  const publicPage = artist ? draft.slug === "moody" ? "/label-moody.html" : "/label-artista.html?artista=" + draft.slug
    : "/label.html#uscita-" + draft.slug;
  return <div className="redazione-layout">
    <aside className="redazione-list">
      <div className="redazione-actions">
        <button type="button" disabled={busy || !ready} onClick={() => open(empty("artist"))}>Nuovo artista</button>
        <button type="button" className="secondary" disabled={busy || !ready} onClick={() => open(empty("release"))}>Nuova uscita</button>
      </div>
      {(["artist", "release"] as const).map(kind => {
        const group = entries.filter(entry => entry.kind === kind);
        return <section key={kind}>
          <h2>{kind === "artist" ? "Roster" : "Pubblicazioni"}</h2>
          <ol className="label-order-list">
            {group.map((entry, index) => <li key={entry.id}>
              <button type="button" className={"secondary news-list-item" + (entry.id === draft.id ? " selected" : "")}
                disabled={busy} aria-pressed={entry.id === draft.id} onClick={() => open(entry)}>
                {entry.name} · {entry.published ? "Online" : "Bozza"}
              </button>
              <div className="label-order-actions">
                {([-1, 1] as const).map(direction => <button type="button" className="secondary" key={direction}
                  disabled={busy || !group[index + direction]}
                  aria-label={(direction === -1 ? "Sposta su " : "Sposta giù ") + entry.name}
                  onClick={() => void changeCatalogue("PATCH", {
                    id: entry.id, neighbor: group[index + direction].id, direction,
                  })}>{direction === -1 ? "↑ Su" : "↓ Giù"}</button>)}
              </div>
            </li>)}
          </ol>
        </section>;
      })}
    </aside>
    <section>
      <h2>{artist ? "Scheda artista" : "Scheda pubblicazione"}</h2>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {progress !== null && <p role="status">Caricamento immagine… {progress}%</p>}
      <form onSubmit={event => { event.preventDefault(); void save(false); }}>
        <fieldset disabled={busy || !ready}>
          <div className="redazione-fields">
            <label>{artist ? "Nome d’arte" : "Titolo dell’uscita"}<input value={draft.name} maxLength={160} onChange={event => {
              const name = event.target.value;
              patch({ name, ...(!draft.id ? { slug: labelSlug(name) } : {}) });
            }}/></label>
            <label>Indirizzo breve<input value={draft.slug} maxLength={100} readOnly={draft.publishedOnce} onChange={event => patch({ slug: event.target.value })}/></label>
          </div>
          {artist ? <>
            <label>Sottotitolo<input value={draft.tagline} maxLength={240} placeholder="Nome e cognome · Autore & Producer"
              onChange={event => patch({ tagline: event.target.value })}/></label>
          </> : <>
            <div className="redazione-fields">
              <label>Artista del roster<select value={draft.artistSlug} onChange={event => patch({ artistSlug: event.target.value, artistName: "" })}>
                <option value="">Inserisci un nome a mano</option>
                {entries.filter(entry => entry.kind === "artist").map(entry =>
                  <option key={entry.id} value={entry.slug}>{entry.name}{entry.published ? "" : " · Bozza"}</option>)}
              </select></label>
              {!draft.artistSlug && <label>Nome artista<input value={draft.artistName} maxLength={160}
                onChange={event => patch({ artistName: event.target.value })}/></label>}
              <label>Formato<select value={draft.type} onChange={event => patch({ type: event.target.value })}>
                <option value="">Scegli il formato</option>{releaseTypes.map(type => <option key={type}>{type}</option>)}
              </select></label>
              <label>Data di uscita<input type="date" value={draft.date} onChange={event => patch({ date: event.target.value })}/></label>
            </div>
            <label>Link Spotify<input type="url" value={draft.spotify} maxLength={1500} placeholder="https://open.spotify.com/track/…"
              onChange={event => patch({ spotify: event.target.value })}/><small>Incolla il link del brano, dell’EP o dell’album. Il sito crea il player da questo indirizzo.</small></label>
          </>}
          <label>{artist ? "Foto artista" : "Copertina (facoltativa)"}<input type="file" accept="image/jpeg,image/png,image/webp"
            onChange={event => void selectImage(event.target.files?.[0])}/><small>JPG, PNG o WebP fino a 30 MB.</small></label>
          {photo && <div className="redazione-cover">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo} alt="Anteprima immagine selezionata"/></div>}
          <label>{artist ? "Biografia" : "Testo della pubblicazione"}<textarea value={draft.body} rows={8} maxLength={15000}
            onChange={event => patch({ body: event.target.value })}/><small>Separa i paragrafi con una riga vuota.</small></label>
          {artist && <div className="redazione-fields">{labelSocials.map(social =>
            <label key={social}>{social}<input type="url" maxLength={1500} value={draft.links[social] || ""}
              placeholder="https://…" onChange={event => patch({ links: { ...draft.links, [social]: event.target.value } })}/></label>)}</div>}
          <div className="redazione-actions">
            <button type="submit" className="secondary">{draft.published ? "Ritira e salva come bozza" : "Salva bozza"}</button>
            <button type="button" onClick={() => void save(true)}>{draft.published ? "Aggiorna sul sito" : "Pubblica sul sito"}</button>
            {draft.id && <button type="button" className="secondary news-delete-button" onClick={remove}>Elimina scheda</button>}
            {draft.published && <a className="button secondary" href={labelSite + publicPage} target="_blank" rel="noreferrer">Apri sul sito</a>}
          </div>
        </fieldset>
      </form>
    </section>
  </div>;
}
