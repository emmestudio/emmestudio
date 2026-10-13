export type EventDraft = { title: string; description: string; location: string; category: string; allDay: boolean; start: string; end: string };
export const categories = ['Registrazione', 'Riunione', 'Prova', 'Live', 'Altro'];
const formatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function plusDay(value: string) {
  if (!validDate(value)) throw new Error('Data non valida.');
  return new Date(Date.parse(value) + 86400000).toISOString().slice(0, 10);
}
export function romeLocal(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validDate(value.slice(0, 10))) throw new Error('Data o orario non valido.');
  const nominal = Date.parse(value + ':00Z');
  const matches = [60, 120].map(offset => new Date(nominal - offset * 60000)).filter(date => formatter.format(date).replace(' ', 'T') === value);
  if (matches.length === 0) throw new Error('Questo orario non esiste nel fuso Europe/Rome. Scegli un altro orario.');
  if (matches.length > 1) throw new Error('Questo orario si ripete al cambio dell’ora. Gestisci questo appuntamento direttamente in Google Calendar.');
  return matches[0].toISOString();
}
export function localDisplay(iso: string) { return formatter.format(new Date(iso)).replace(' ', 'T'); }
export function validateDraft(input: unknown): EventDraft {
  if (!input || typeof input !== 'object') throw new Error('Appuntamento non valido.');
  const data = input as Record<string, unknown>;
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 200) throw new Error('Inserisci un titolo entro 200 caratteri.');
  if (typeof data.description !== 'string' || data.description.length > 5000 || typeof data.location !== 'string' || data.location.length > 500) throw new Error('Descrizione o luogo non valido.');
  if (typeof data.category !== 'string' || !categories.includes(data.category) || typeof data.allDay !== 'boolean' || typeof data.start !== 'string' || typeof data.end !== 'string') throw new Error('Dati appuntamento non validi.');
  if (data.allDay) {
    if (!validDate(data.start) || !validDate(data.end) || data.end <= data.start) throw new Error('Controlla le date di inizio e fine.');
  } else {
    const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/;
    if (!pattern.test(data.start) || !pattern.test(data.end) || !validDate(data.start.slice(0, 10)) || !validDate(data.end.slice(0, 10)) || !Number.isFinite(Date.parse(data.start)) || !Number.isFinite(Date.parse(data.end)) || Date.parse(data.end) <= Date.parse(data.start)) throw new Error('Controlla gli orari: la fine deve essere successiva all’inizio.');
  }
  return { title: data.title.trim(), description: data.description, location: data.location, category: data.category, allDay: data.allDay, start: data.start, end: data.end };
}
