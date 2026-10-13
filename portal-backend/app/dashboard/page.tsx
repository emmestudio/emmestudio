import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ownerSession } from '@/lib/owner-session';
import { listProjects } from '@/lib/projects';
import { calendarContext } from '@/lib/calendar-context';
import { projectProgress } from '@/lib/project-data';
import { listTasks } from '@/lib/tasks';
import { overdueTask } from '@/lib/task-data';
import { localDisplay } from '@/lib/event-data';
export const dynamic = 'force-dynamic';
const date = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export default async function Page() {
  const requestHeaders = await headers(); const session = await ownerSession(requestHeaders);
  if (!session) redirect('/accesso');
  const now = new Date(); const end = new Date(now.getTime() + 30 * 86400000);
  const [projectResult, calendarResult, taskResult] = await Promise.allSettled([
    listProjects(session.user.id),
    calendarContext(new Request(process.env.BETTER_AUTH_URL! + '/dashboard', { headers: requestHeaders })).then(({ events }) => events.list(now.toISOString(), end.toISOString())),
    listTasks(session.user.id)
  ]);
  const projects = projectResult.status === 'fulfilled' ? projectResult.value : [];
  const active = projects.filter(project => !['Completato', 'Archiviato'].includes(project.status));
  const upcoming = calendarResult.status === 'fulfilled' ? calendarResult.value : [];
  const deadlines = active.filter(project => project.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 5);
  const pending = taskResult.status === 'fulfilled' ? taskResult.value.filter(task => task.status !== 'Completata' && task.projectStatus !== 'Archiviato') : [];
  const today = localDisplay(now.toISOString()).slice(0, 10);
  return <main className="shell dashboard"><span className="eyebrow">EMME STUDIO · PANORAMICA</span><h1>Il lavoro di oggi.<br /><em>La visione di domani.</em></h1><p>Progetti, obiettivi e prossimi appuntamenti dello studio.</p>
    <div className="dashboard-stats"><div><span>Progetti attivi</span><strong>{projectResult.status === 'fulfilled' ? active.length : '—'}</strong></div><div><span>Appuntamenti · prossimi 30 giorni</span><strong>{calendarResult.status === 'fulfilled' ? upcoming.length : '—'}</strong></div><div><span>Progetti completati</span><strong>{projectResult.status === 'fulfilled' ? projects.filter(project => project.status === 'Completato').length : '—'}</strong></div></div>
    <div className="dashboard-columns"><section className="card"><div className="list-heading"><h2>Progetti in primo piano</h2><Link href="/progetti" className="text-button">Archivio ↗</Link></div>{projectResult.status === 'rejected' ? <p>Archivio progetti temporaneamente non disponibile.</p> : !active.length ? <p>Nessun progetto attivo. Crea la prima scheda per organizzare produzione, live e immagine.</p> : active.slice(0, 4).map(project => <Link href={'/progetti?project=' + project.id} className="dashboard-project" key={project.id}><div><span className="badge">{project.kind} · {project.status}</span><h3>{project.title}</h3><p>{project.artist}</p></div><span className="project-percent">{projectProgress(project)}%</span></Link>)}<Link href="/progetti" className="button">Gestisci progetti ↗</Link></section>
    <section className="card"><div className="list-heading"><h2>Prossimi appuntamenti</h2><Link href="/calendario" className="text-button">Calendario ↗</Link></div>{calendarResult.status === 'rejected' ? <p>Calendar non è disponibile. Apri il calendario per verificare o rinnovare il collegamento.</p> : !upcoming.length ? <p>Nessun appuntamento nei prossimi 30 giorni.</p> : upcoming.slice(0, 5).map(event => <div className="dashboard-event" key={event.id}><span>{event.start.date ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'Europe/Rome' }).format(new Date(event.start.date + 'T12:00:00Z')) + ' · Tutto il giorno' : date.format(new Date(event.start.dateTime!))}</span><h3>{event.summary ?? '(Senza titolo)'}</h3>{event.location ? <p>{event.location}</p> : null}</div>)}<Link href="/calendario" className="button">Apri calendario ↗</Link></section></div>
    <section className="card"><div className="list-heading"><h2>Prossime attività {taskResult.status === 'fulfilled' ? <span className="status-pill">{pending.length} aperte</span> : null}</h2><Link href="/attivita" className="text-button">Bacheca ↗</Link></div>{taskResult.status === 'rejected' ? <p>Bacheca temporaneamente non disponibile.</p> : pending.length ? pending.slice(0, 5).map(task => <div className="dashboard-task" key={task.id}><div><span className="badge">{task.projectTitle} · {task.priority}</span><h3><Link href={'/attivita?project=' + task.projectId}>{task.title}</Link></h3><p>{task.assignee || 'Responsabile da assegnare'} · {task.status}</p></div><span className={overdueTask(task, today) ? 'danger small' : 'small'}>{task.deadline ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'Europe/Rome' }).format(new Date(task.deadline + 'T12:00:00Z')) : 'Scadenza da definire'}{overdueTask(task, today) ? ' · Scaduta' : ''}</span></div>) : <p>Nessuna attività aperta. Aggiungi il prossimo passo di un progetto nella bacheca.</p>}</section>
    <section className="card"><h2>Scadenze dei progetti</h2>{deadlines.length ? deadlines.map(project => <div className="deadline-row" key={project.id}><Link href={'/progetti?project=' + project.id}>{project.title}</Link><span>{new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeZone: 'Europe/Rome' }).format(new Date(project.deadline! + 'T12:00:00Z'))}</span></div>) : <p>Le scadenze appariranno qui quando le inserisci nelle schede progetto.</p>}<p className="small">Le scadenze dei progetti sono promemoria interni. Gli appuntamenti si gestiscono nel calendario collegato.</p></section>
  </main>;
}
