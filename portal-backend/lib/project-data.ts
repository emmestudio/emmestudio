import { validDate } from './event-data.ts';
export const projectKinds = ['Singolo', 'Album', 'Live', 'Percorso artistico'];
export const projectStates = ['Pianificazione', 'In produzione', 'In uscita', 'Attivo', 'Completato', 'Archiviato'];
export type ProjectDraft = { title: string; artist: string; kind: string; status: string; deadline: string | null; vision: string; notes: string; music: number; live: number; image: number };
export type StudioProject = ProjectDraft & { id: string; version: number; createdAt: string; updatedAt: string };
export class ProjectInputError extends Error {}
export function validateProject(input: unknown): ProjectDraft {
  if (!input || typeof input !== 'object') throw new ProjectInputError('Dati progetto non validi.');
  const data = input as Record<string, unknown>;
  const text = (key: string, max: number, required = false) => {
    if (typeof data[key] !== 'string' || data[key].length > max || (required && !data[key].trim())) throw new ProjectInputError(`Controlla il campo ${key === 'title' ? 'titolo' : key === 'artist' ? 'artista' : key === 'vision' ? 'obiettivo' : 'note'}.`);
    return data[key].trim();
  };
  if (typeof data.kind !== 'string' || !projectKinds.includes(data.kind) || typeof data.status !== 'string' || !projectStates.includes(data.status)) throw new ProjectInputError('Tipo o stato progetto non valido.');
  if (data.deadline !== null && (typeof data.deadline !== 'string' || !validDate(data.deadline))) throw new ProjectInputError('Scadenza non valida.');
  for (const key of ['music', 'live', 'image']) if (typeof data[key] !== 'number' || ![0, 50, 100].includes(data[key])) throw new ProjectInputError('Avanzamento area non valido.');
  return { title: text('title', 200, true), artist: text('artist', 200, true), kind: data.kind, status: data.status, deadline: data.deadline as string | null, vision: text('vision', 3000), notes: text('notes', 10000), music: data.music as number, live: data.live as number, image: data.image as number };
}
export function projectProgress(project: Pick<ProjectDraft, 'music' | 'live' | 'image'>) { return Math.round((project.music + project.live + project.image) / 3); }
