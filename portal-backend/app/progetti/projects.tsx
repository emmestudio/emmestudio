'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { projectKinds, projectStates, projectProgress, type ProjectDraft, type StudioProject } from '@/lib/project-data';
const empty = (): ProjectDraft => ({ title: '', artist: '', kind: 'Singolo', status: 'Pianificazione', deadline: null, vision: '', notes: '', music: 0, live: 0, image: 0 });
const date = (value: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'Europe/Rome' }).format(new Date(value + 'T12:00:00Z'));
export default function Projects() {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Attivi');
  const [editor, setEditor] = useState<StudioProject | 'new' | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(empty());
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const deepLinkOpened = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    fetch('/api/projects', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setProjects(data.projects); setError('');
      if (!deepLinkOpened.current) { deepLinkOpened.current = true; const selectedId = new URLSearchParams(window.location.search).get('project'); const selected = data.projects.find((project: StudioProject) => project.id === selectedId); if (selected) open(selected); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Archivio non disponibile.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => { if (editor && !dialog.current?.open) dialog.current?.showModal(); }, [editor]);
  function open(project?: StudioProject) { setEditor(project ?? 'new'); setDraft(project ? { ...project } : empty()); setId(project?.id ?? crypto.randomUUID()); setEditorError(''); }
  function close() { if (!busy) { dialog.current?.close(); setEditor(null); } }
  async function save() {
    setBusy(true); setEditorError('');
    try {
      const response = await fetch('/api/projects', { method: editor === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, version: editor && editor !== 'new' ? editor.version : undefined, draft }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      dialog.current?.close(); setEditor(null); setMessage('Progetto salvato nell’archivio dello studio.'); setRefresh(value => value + 1);
    } catch (error) { setEditorError(error instanceof Error ? error.message : 'Salvataggio non completato.'); }
    finally { setBusy(false); }
  }
  const shown = projects.filter(project => {
    const state = filter === 'Tutti' || (filter === 'Attivi' ? !['Completato', 'Archiviato'].includes(project.status) : filter === 'Completati' ? project.status === 'Completato' : project.status === 'Archiviato');
    return state && (project.title + ' ' + project.artist).toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it'));
  });
  return <section aria-label="Archivio progetti"><div className="agenda-heading"><p>Produzione musicale, live e immagine: raccogli obiettivi e avanzamento di ogni progetto. I dati sono salvati nel database dedicato allo studio.</p><button className="button" onClick={() => open()}>+ Nuovo progetto</button></div>
    <div className="project-toolbar"><label><span className="sr-only">Cerca progetto o artista</span><input type="search" placeholder="Cerca progetto o artista" value={search} onChange={event => setSearch(event.target.value)} /></label><label><span className="sr-only">Filtra progetti</span><select value={filter} onChange={event => setFilter(event.target.value)}>{['Attivi', 'Tutti', 'Completati', 'Archiviati'].map(state => <option key={state}>{state}</option>)}</select></label><button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Caricamento…' : 'Aggiorna'}</button></div>
    <p role="status">{error || message}</p><div className="project-grid">{shown.map(project => <article className="project-card" key={project.id}><div className="list-heading"><span className="badge">{project.kind}</span><span className="status-pill">{project.status}</span></div><h2>{project.title}</h2><p className="project-artist">{project.artist}</p>{project.vision ? <p className="project-vision">{project.vision}</p> : null}<div className="progress-heading"><span>Aree di lavoro</span><strong>{projectProgress(project)}%</strong></div><progress max={100} value={projectProgress(project)} aria-label={`Avanzamento manuale ${project.title}`} /><div className="area-labels"><span>Musica {project.music}%</span><span>Live {project.live}%</span><span>Immagine {project.image}%</span></div><div className="project-card-footer"><span>{project.deadline ? 'Scadenza ' + date(project.deadline) : 'Scadenza da definire'}</span><button className="text-button" onClick={() => open(project)}>Apri progetto ↗</button></div></article>)}</div>
    {!shown.length ? <div className="empty"><h2>{loading ? 'Caricamento progetti…' : error ? 'Archivio non disponibile' : projects.length ? 'Nessun progetto corrisponde alla ricerca.' : 'Il prossimo progetto parte da qui.'}</h2><p>{error ? 'Usa Aggiorna per riprovare.' : 'Crea una scheda per un singolo, un album, uno show live o un percorso artistico.'}</p></div> : null}
    <dialog ref={dialog} className="event-dialog project-dialog" aria-labelledby="project-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (!busy) setEditor(null); }}><form onSubmit={event => { event.preventDefault(); void save(); }}><div className="dialog-heading"><h2 id="project-title">{editor === 'new' ? 'Nuovo progetto' : 'Scheda progetto'}</h2><button className="secondary" type="button" disabled={busy} onClick={close} aria-label="Chiudi">×</button></div><fieldset disabled={busy}>
      <label>Titolo progetto<input required autoFocus maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label>Artista o gruppo<input required maxLength={200} value={draft.artist} onChange={event => setDraft({ ...draft, artist: event.target.value })} /></label>
      <div className="form-grid"><label>Tipo<select value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value })}>{projectKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label><label>Stato<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{projectStates.map(state => <option key={state}>{state}</option>)}</select></label></div>
      <label>Scadenza<input type="date" value={draft.deadline ?? ''} onChange={event => setDraft({ ...draft, deadline: event.target.value || null })} /></label><label>Visione e obiettivo<textarea rows={3} maxLength={3000} value={draft.vision} onChange={event => setDraft({ ...draft, vision: event.target.value })} /></label>
      <h3>Aree di lavoro</h3><p className="small">L’indicatore è aggiornato manualmente: ogni area ha lo stesso peso.</p><div className="areas-form">{(['music', 'live', 'image'] as const).map((key, index) => <label key={key}>{['Produzione musicale', 'Produzione live', 'Immagine e comunicazione'][index]}<select value={draft[key]} onChange={event => setDraft({ ...draft, [key]: Number(event.target.value) })}><option value={0}>Da avviare · 0%</option><option value={50}>In corso · 50%</option><option value={100}>Completata · 100%</option></select></label>)}</div>
      <label>Note del progetto<textarea rows={5} maxLength={10000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label><p className="small">Per conservare un progetto concluso, imposta lo stato “Archiviato”. Puoi riattivarlo in seguito.</p></fieldset>
      <p role="status" aria-live="polite">{editorError}</p><div className="dialog-actions"><button className="button" disabled={busy} type="submit">{busy ? 'Salvataggio…' : 'Salva progetto'}</button>{editor && editor !== 'new' ? <Link className="text-button" href={'/attivita?project=' + editor.id}>Attività del progetto ↗</Link> : null}</div></form></dialog>
  </section>;
}
