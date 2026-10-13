'use client';
import { useEffect, useRef, useState } from 'react';
import { categories, localDisplay, plusDay, romeLocal, type EventDraft } from '@/lib/event-data';
type Appointment = EventDraft & { id: string; etag: string; editable: boolean; url: string | null };
const dayFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' });
const timeFormatter = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const todayRome = () => localDisplay(new Date().toISOString()).slice(0, 10);
function moveMonth(month: string, direction: number) { const [year, number] = month.split('-').map(Number); return new Date(Date.UTC(year, number - 1 + direction, 1)).toISOString().slice(0, 7); }
function range(month: string) { return { start: romeLocal(month + '-01T00:00'), end: romeLocal(moveMonth(month, 1) + '-01T00:00') }; }
function eventDate(event: Appointment) { return event.allDay ? event.start : localDisplay(event.start).slice(0, 10); }
function onDay(event: Appointment, day: string) { return event.allDay ? event.start <= day && event.end > day : Date.parse(event.start) < Date.parse(romeLocal(plusDay(day) + 'T00:00')) && Date.parse(event.end) > Date.parse(romeLocal(day + 'T00:00')); }
function displayEvent(event: Appointment) { return event.allDay ? 'Tutto il giorno' : `${timeFormatter.format(new Date(event.start))} – ${timeFormatter.format(new Date(event.end))}`; }
function emptyDraft(day: string): EventDraft { return { title: '', description: '', location: 'Emme Studio', category: 'Registrazione', allDay: false, start: day + 'T10:00', end: day + 'T11:00' }; }
function editDraft(event: Appointment): EventDraft { return { ...event, start: event.allDay ? event.start : localDisplay(event.start), end: event.allDay ? new Date(Date.parse(event.end) - 86400000).toISOString().slice(0, 10) : localDisplay(event.end), category: categories.includes(event.category) ? event.category : 'Altro' }; }

export default function Appointments() {
  const [month, setMonth] = useState(todayRome().slice(0, 7));
  const [events, setEvents] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [readError, setReadError] = useState('');
  const [checked, setChecked] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState<Appointment | 'new' | null>(null);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft(todayRome()));
  const [creatingId, setCreatingId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editorMessage, setEditorMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true; let current: AbortController | undefined;
    async function load() {
      current?.abort(); const controller = new AbortController(); current = controller;
      setLoading(true);
      try {
        const response = await fetch('/api/calendar/events?' + new URLSearchParams(range(month)), { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active && !controller.signal.aborted) { setEvents(data.events); setChecked(data.checkedAt); setReadError(''); }
      } catch (error) { if (active && !controller.signal.aborted) setReadError(error instanceof Error ? error.message : 'Aggiornamento non riuscito.'); }
      finally { if (active && current === controller) setLoading(false); }
    }
    setEvents([]); setChecked(''); setFilter(''); void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60000);
    const visible = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', visible); document.addEventListener('visibilitychange', visible);
    return () => { active = false; current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible); };
  }, [month, refresh]);
  useEffect(() => { if (editor && !dialog.current?.open) dialog.current?.showModal(); }, [editor]);

  function openEditor(event?: Appointment) {
    setEditor(event ?? 'new'); setDraft(event ? editDraft(event) : emptyDraft(filter || (month === todayRome().slice(0, 7) ? todayRome() : month + '-01')));
    setCreatingId('e' + crypto.randomUUID().replaceAll('-', '')); setDeleteConfirm(false); setEditorMessage('');
  }
  function close() { if (!saving) { dialog.current?.close(); setEditor(null); } }
  async function mutate(method: 'POST' | 'PATCH' | 'DELETE') {
    setSaving(true); setEditorMessage('');
    try {
      const selected = editor && editor !== 'new' ? editor : null;
      const converted: EventDraft | undefined = method === 'DELETE' ? undefined : { ...draft, start: draft.allDay ? draft.start : romeLocal(draft.start), end: draft.allDay ? plusDay(draft.end) : romeLocal(draft.end) };
      const response = await fetch('/api/calendar/events', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected?.id ?? creatingId, etag: selected?.etag, draft: converted }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      dialog.current?.close(); setEditor(null); setRefresh(value => value + 1);
      setMessage(method === 'DELETE' ? 'Appuntamento eliminato da Google Calendar.' : 'Appuntamento salvato su Google Calendar.');
    } catch (error) { setEditorMessage(error instanceof Error ? error.message : 'Richiesta non completata. Riprova.'); }
    finally { setSaving(false); }
  }
  const shown = filter ? events.filter(event => onDay(event, filter)) : events;
  const first = new Date(month + '-01T12:00:00Z');
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return <section className="appointments" aria-label="Appuntamenti dello studio">
    <div className="agenda-heading"><div><span className="badge">EMME STUDIO — APPUNTAMENTI</span><h2>Il nostro calendario.</h2><p>Gli appuntamenti vengono salvati direttamente su Google Calendar. Le modifiche da Google compaiono all’apertura e ogni minuto mentre questa pagina è visibile.</p></div><button className="button" onClick={() => openEditor()}>+ Nuovo appuntamento</button></div>
    <div className="agenda-toolbar"><div className="month-control"><button className="secondary" aria-label="Mese precedente" onClick={() => setMonth(value => moveMonth(value, -1))}>←</button><label><span className="sr-only">Mese</span><input type="month" value={month} min="2000-01" max="2100-12" onChange={event => { if (event.target.value) setMonth(event.target.value); }} /></label><button className="secondary" aria-label="Mese successivo" onClick={() => setMonth(value => moveMonth(value, 1))}>→</button></div><button className="secondary" disabled={loading} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Aggiornamento…' : 'Aggiorna'}</button></div>
    <p className="sync-status" role="status">{readError || message || (checked ? `Aggiornato alle ${timeFormatter.format(new Date(checked))} · Europe/Rome` : 'Caricamento calendario…')}</p>
    <div className="agenda-layout"><div className="month-grid card"><div className="weekdays">{['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((day, index) => <span key={index}>{day}</span>)}</div><div className="days">{Array.from({ length: offset }, (_, index) => <span key={'empty' + index} />)}{Array.from({ length: days }, (_, index) => {
      const day = month + '-' + String(index + 1).padStart(2, '0'); const count = events.filter(event => onDay(event, day)).length;
      return <button key={day} aria-label={`${index + 1}, ${count} appuntamenti`} aria-pressed={filter === day} className={`${day === todayRome() ? 'today' : ''} ${filter === day ? 'selected' : ''}`} onClick={() => setFilter(filter === day ? '' : day)}><span>{index + 1}</span>{count > 0 ? <small>{count}</small> : null}</button>;
    })}</div><p className="small">Seleziona un giorno per filtrare l’agenda.</p></div>
    <div className="agenda-list"><div className="list-heading"><h3>{filter ? dayFormatter.format(new Date(filter + 'T12:00:00Z')) : 'Agenda del mese'}</h3>{filter ? <button className="text-button" onClick={() => setFilter('')}>Mostra tutto</button> : null}</div>
      {!shown.length ? <div className="empty"><p>{loading ? 'Caricamento…' : readError ? 'Agenda non disponibile. Usa Aggiorna per riprovare.' : 'Nessun appuntamento in questo periodo.'}</p></div> : shown.map(event => <article key={event.id} className="event-row"><div className="event-date"><strong>{dayFormatter.format(new Date(event.allDay ? event.start + 'T12:00:00Z' : event.start))}</strong><span>{displayEvent(event)}</span></div><div className="event-info"><span className="badge">{event.category}</span><h3>{event.title}</h3>{event.location ? <p>{event.location}</p> : null}{event.allDay && event.end !== plusDay(event.start) ? <p>Fino al {dayFormatter.format(new Date(Date.parse(event.end) - 86400000))}</p> : null}</div><div className="event-actions">{event.editable ? <button className="secondary" onClick={() => openEditor(event)}>Gestisci</button> : <span className="small">Ricorrenza o invitati</span>}{event.url ? <a href={event.url} target="_blank" rel="noopener noreferrer" className="text-button">Google Calendar ↗</a> : null}</div></article>)}
    </div></div>
    <dialog ref={dialog} className="event-dialog" aria-labelledby="event-editor-title" onCancel={event => { event.preventDefault(); close(); }} onClose={() => { if (!saving) setEditor(null); }}>
      <form onSubmit={event => { event.preventDefault(); void mutate(editor === 'new' ? 'POST' : 'PATCH'); }}><div className="dialog-heading"><h2 id="event-editor-title">{editor === 'new' ? 'Nuovo appuntamento' : 'Gestisci appuntamento'}</h2><button type="button" className="secondary" aria-label="Chiudi" disabled={saving} onClick={close}>×</button></div>
        <fieldset disabled={saving}><label>Titolo<input required autoFocus maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
        <div className="form-grid"><label>Tipo<select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.map(category => <option key={category}>{category}</option>)}</select></label><label>Luogo<input maxLength={500} value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} /></label></div>
        <label className="checkbox"><input type="checkbox" checked={draft.allDay} onChange={event => { const allDay = event.target.checked; setDraft({ ...draft, allDay, start: allDay ? draft.start.slice(0, 10) : draft.start.slice(0, 10) + 'T10:00', end: allDay ? draft.end.slice(0, 10) : draft.end.slice(0, 10) + 'T11:00' }); }} />Tutto il giorno</label>
        <div className="form-grid"><label>Inizio<input required type={draft.allDay ? 'date' : 'datetime-local'} value={draft.start} onChange={event => setDraft({ ...draft, start: event.target.value })} /></label><label>{draft.allDay ? 'Ultimo giorno incluso' : 'Fine'}<input required type={draft.allDay ? 'date' : 'datetime-local'} value={draft.end} onChange={event => setDraft({ ...draft, end: event.target.value })} /></label></div>
        <p className="small">Orari nel fuso Europe/Rome. Il salvataggio aggiorna Google Calendar.</p><label>Note<textarea rows={3} maxLength={5000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label></fieldset>
        <p role="status" aria-live="polite">{editorMessage}</p><div className="dialog-actions"><button className="button" type="submit" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva appuntamento'}</button>{editor && editor !== 'new' ? <button type="button" className="text-button danger" disabled={saving} onClick={() => setDeleteConfirm(true)}>Elimina</button> : null}</div>
        {deleteConfirm ? <div className="delete-confirm"><p>Eliminare questo appuntamento anche da Google Calendar?</p><button className="secondary danger" disabled={saving} type="button" onClick={() => void mutate('DELETE')}>Conferma eliminazione</button><button className="text-button" type="button" disabled={saving} onClick={() => setDeleteConfirm(false)}>Annulla</button></div> : null}
      </form></dialog>
  </section>;
}
