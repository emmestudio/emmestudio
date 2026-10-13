'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { taskStates, taskPriorities, overdueTask, type StudioTask, type TaskDraft } from '@/lib/task-data';
import type { StudioProject } from '@/lib/project-data';
import { localDisplay } from '@/lib/event-data';
const blank = (projectId: string): TaskDraft => ({ projectId, title: '', assignee: '', status: 'Da fare', priority: 'Normale', deadline: null, notes: '' });
const date = (value: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'Europe/Rome' }).format(new Date(value + 'T12:00:00Z'));
export default function Tasks() {
  const [writable, setWritable] = useState(false);
  const [tasks, setTasks] = useState<StudioTask[]>([]);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [editor, setEditor] = useState<StudioTask | 'new' | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(blank(''));
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [editorError, setEditorError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const initialFilter = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    const read = async (url: string) => { const response = await fetch(url, { cache: 'no-store', signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; };
    Promise.all([read('/api/tasks'), read('/api/projects')]).then(([taskData, projectData]) => {
      setTasks(taskData.tasks); setProjects(projectData.projects); setWritable(Boolean(taskData.canEdit)); setError('');
      if (!initialFilter.current) { initialFilter.current = true; const query = new URLSearchParams(window.location.search).get('project'); if (projectData.projects.some((project: StudioProject) => project.id === query)) setFilter(query!); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Bacheca non disponibile.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => { if (editor && !dialog.current?.open) dialog.current?.showModal(); }, [editor]);
  const available = projects.filter(project => project.status !== 'Archiviato');
  const shown = tasks.filter(task => (filter ? task.projectId === filter : task.projectStatus !== 'Archiviato') && (task.title + ' ' + task.assignee + ' ' + task.projectTitle).toLocaleLowerCase('it').includes(search.toLocaleLowerCase('it')));
  function open(task?: StudioTask) { setEditor(task ?? 'new'); setId(task?.id ?? crypto.randomUUID()); setDraft(task ? { ...task } : blank(available.some(project => project.id === filter) ? filter : available[0]?.id ?? '')); setEditorError(''); }
  function close() { if (!busy) { dialog.current?.close(); setEditor(null); } }
  async function save() {
    setBusy(true); setEditorError('');
    try {
      const response = await fetch('/api/tasks', { method: editor === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, version: editor && editor !== 'new' ? editor.version : undefined, draft }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      dialog.current?.close(); setEditor(null); setRefresh(value => value + 1); setMessage('Attività salvata.');
    } catch (error) { setEditorError(error instanceof Error ? error.message : 'Salvataggio non completato.'); }
    finally { setBusy(false); }
  }
  return <section aria-label="Bacheca attività"><div className="agenda-heading"><p>Organizza il lavoro dei progetti: priorità, responsabilità e scadenze. Per fissare una sessione o una riunione, usa il <Link href="/calendario" className="text-button">Calendario</Link>.</p><button className="button" disabled={!writable || !available.length || loading} onClick={() => open()}>+ Nuova attività</button></div>
    <div className="project-toolbar"><label><span className="sr-only">Cerca attività o responsabile</span><input type="search" value={search} placeholder="Cerca attività, progetto o responsabile" onChange={event => setSearch(event.target.value)} /></label><label><span className="sr-only">Filtra per progetto</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="">Progetti attivi</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}{project.status === 'Archiviato' ? ' · Archiviato' : ''}</option>)}</select></label><button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Caricamento…' : 'Aggiorna'}</button></div>
    <p role="status">{error || message}</p>{!available.length && !loading && !error ? <div className="empty"><h2>Inizia da un progetto.</h2><p>Crea una scheda o riattiva un progetto archiviato per organizzare le sue attività.</p><Link href="/progetti" className="button">Apri progetti ↗</Link></div> : null}
    <div className="task-board">{taskStates.map(state => <section key={state} className="task-column" aria-label={state}><div className="list-heading"><h2>{state}</h2><span className="status-pill">{shown.filter(task => task.status === state).length}</span></div>{shown.filter(task => task.status === state).map(task => <article className="task-card" key={task.id}><div className="list-heading"><span className="badge">{task.priority}</span>{overdueTask(task, localDisplay(new Date().toISOString()).slice(0, 10)) ? <span className="danger small">Scaduta</span> : null}</div><h3>{task.title}</h3><Link className="task-project" href={'/progetti?project=' + task.projectId}>{task.projectTitle}</Link><p>{task.assignee || 'Responsabile da assegnare'}</p><div className="project-card-footer"><span>{task.deadline ? date(task.deadline) : 'Scadenza da definire'}</span>{task.projectStatus !== 'Archiviato' ? <button className="text-button" onClick={() => open(task)}>Gestisci ↗</button> : <span className="small">Progetto archiviato</span>}</div></article>)}{!shown.some(task => task.status === state) ? <p className="small">{loading ? 'Caricamento…' : error ? 'Dati non disponibili.' : 'Nessuna attività.'}</p> : null}</section>)}</div>
    <p className="small">Le scadenze delle attività restano nella bacheca. Gli appuntamenti si gestiscono su Google Calendar. Il responsabile è un riferimento organizzativo; gli accessi del team saranno aggiunti separatamente.</p>
    <dialog ref={dialog} className="event-dialog" aria-labelledby="task-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (!busy) setEditor(null); }}><form onSubmit={event => { event.preventDefault(); void save(); }}><div className="dialog-heading"><h2 id="task-title">{editor === 'new' ? 'Nuova attività' : 'Scheda attività'}</h2><button type="button" className="secondary" aria-label="Chiudi" disabled={busy} onClick={close}>×</button></div><fieldset disabled={busy || !writable}>
      <label>Progetto<select required value={draft.projectId} onChange={event => setDraft({ ...draft, projectId: event.target.value })}><option value="">Seleziona un progetto</option>{available.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label><label>Attività<input required autoFocus maxLength={300} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label><label>Responsabile<input maxLength={200} placeholder="Nome della persona o del gruppo di lavoro" value={draft.assignee} onChange={event => setDraft({ ...draft, assignee: event.target.value })} /></label>
      <div className="form-grid"><label>Stato<select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{taskStates.map(state => <option key={state}>{state}</option>)}</select></label><label>Priorità<select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}>{taskPriorities.map(priority => <option key={priority}>{priority}</option>)}</select></label></div><label>Scadenza<input type="date" value={draft.deadline ?? ''} onChange={event => setDraft({ ...draft, deadline: event.target.value || null })} /></label><label>Note<textarea rows={5} maxLength={10000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label></fieldset><p role="status" aria-live="polite">{editorError}</p><button type="submit" className="button" disabled={busy || !writable}>{!writable ? 'Solo consultazione' : busy ? 'Salvataggio…' : 'Salva attività'}</button></form></dialog>
  </section>;
}
