'use client';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { calendarScope } from '@/lib/calendar-policy';
import Appointments from './appointments';
type Status = { permission: boolean; connected: boolean; state: string; calendarName: string | null };
export default function Connection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/calendar/connection', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setStatus(data); setMessage('');
    }).catch(error => { if (error.name !== 'AbortError') setMessage('Non riusciamo a verificare il collegamento. Riprova.'); });
    return () => controller.abort();
  }, [retry]);
  async function authorize() {
    setBusy(true); setMessage('');
    try {
      const result = await authClient.linkSocial({ provider: 'google', scopes: [calendarScope], callbackURL: '/calendario' });
      if (result.error) throw new Error('AUTH_FAILED');
    } catch { setMessage('Autorizzazione non completata. Riprova scegliendo l’account dello studio.'); setBusy(false); }
  }
  async function createCalendar() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/calendar/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setRetry(value => value + 1);
      setMessage('Calendario creato e collegato.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Creazione non completata.'); setRetry(value => value + 1); }
    finally { setBusy(false); }
  }
  if (status?.connected && status.permission) return <><Appointments /><details className="connection-details"><summary>Impostazioni del collegamento Google</summary><p>Calendario dedicato collegato. L’autorizzazione può essere rinnovata se Google richiede un nuovo consenso.</p><button className="secondary" disabled={busy} onClick={authorize}>Rinnova autorizzazione</button><p role="status">{message}</p></details></>;
  return <div className="card"><span className="badge">GOOGLE CALENDAR</span><h2>{status?.connected ? 'Il calendario dello studio è collegato.' : 'Un calendario per il nostro lavoro.'}</h2>
    <p>Autorizza il portale a creare e gestire un calendario dedicato agli appuntamenti Emme Studio. Il collegamento riguarda i calendari creati da questa applicazione.</p>
    {!status ? <><p>Verifica del collegamento…</p><button className="button" onClick={() => setRetry(value => value + 1)}>Riprova</button></> : !status.permission ? <button className="button" disabled={busy} onClick={authorize}>{busy ? 'Apertura Google…' : 'Collega Google Calendar'}</button> : status.connected ? <><p><strong>{status.calendarName}</strong> · Europe/Rome</p><p>Collegamento pronto. La gestione e sincronizzazione degli appuntamenti sarà attivata nella prossima fase.</p><button className="button" disabled={busy} onClick={authorize}>Rinnova autorizzazione</button></> : status.state === 'idle' ? <><p>Autorizzazione ricevuta. Ora puoi creare il calendario “Emme Studio — Appuntamenti”.</p><button className="button" disabled={busy} onClick={createCalendar}>{busy ? 'Creazione…' : 'Crea calendario dello studio'}</button></> : <p>La precedente richiesta di creazione deve essere verificata dal team prima di proseguire.</p>}
    <p role="status" aria-live="polite">{message}</p></div>;
}
