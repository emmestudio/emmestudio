import { validDate } from "./event-data.ts";
import { validId } from "./task-data.ts";
export const workCategories = [
  "Preproduzione",
  "Registrazione",
  "Editing",
  "Mix",
  "Mastering",
  "Live",
  "Immagine",
  "Gestione",
];
export const templates = {
  Singolo: {
    tasks: [
      "Definire reference e arrangiamento",
      "Pianificare registrazioni",
      "Editing e produzione",
      "Mix e revisioni",
      "Mastering e consegna",
    ],
    checks: [
      "Versione definitiva approvata",
      "WAV master e mix verificati",
      "Crediti verificati",
      "Materiali di consegna organizzati",
      "Copia di sicurezza verificata",
    ],
    tracks: true,
    live: false,
  },
  Album: {
    tasks: [
      "Definire tracklist e direzione musicale",
      "Pianificare sessioni e musicisti",
      "Registrazioni ed editing",
      "Mix e revisioni dei brani",
      "Mastering e sequenza album",
      "Consegna album",
    ],
    checks: [
      "Tutti i brani approvati",
      "Sequenza e titoli definitivi",
      "Master e formati verificati",
      "Crediti completi",
      "Cartella di consegna completa",
      "Copia di sicurezza verificata",
    ],
    tracks: true,
    live: false,
  },
  Live: {
    tasks: [
      "Definire organico e scaletta",
      "Confermare service e rider",
      "Preparare sequenze e sincronizzazioni",
      "Pianificare prove",
      "Verifica tecnica e generale",
    ],
    checks: [
      "Scaletta e organico confermati",
      "Rider e stage plot condivisi",
      "Sequenze e cue verificati",
      "LTC / MIDI e regia verificati",
      "Piano backup collaudato",
    ],
    tracks: false,
    live: true,
  },
  "Percorso artistico": {
    tasks: [
      "Definire obiettivi e identità",
      "Pianificare produzione musicale",
      "Organizzare immagine e comunicazione",
      "Preparare percorso live",
      "Verificare avanzamento del percorso",
    ],
    checks: [
      "Obiettivi e prossimi passi aggiornati",
      "Materiali musicali e immagine verificati",
      "Piano release e live aggiornato",
    ],
    tracks: true,
    live: true,
  },
};
export type HourDraft = {
  projectId: string;
  productionId: string | null;
  workedOn: string;
  minutes: number;
  category: string;
  description: string;
};
export type Hour = HourDraft & {
  id: string;
  version: number;
  personEmail: string;
  voidReason: string | null;
};
export type Delivery = {
  id: string;
  projectId: string;
  trackId: string | null;
  label: string;
  done: boolean;
  required: boolean;
  assigneeEmail: string | null;
  dueDate: string | null;
  notes: string;
  version: number;
};
export class WorkInputError extends Error {}
export const todayRome = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function validateHours(input: unknown): HourDraft {
  const d = input as Record<string, unknown> | null;
  if (
    !d ||
    !validId(d.projectId) ||
    (d.productionId !== null && !validId(d.productionId)) ||
    typeof d.workedOn !== "string" ||
    !validDate(d.workedOn) ||
    d.workedOn > todayRome() ||
    !Number.isSafeInteger(d.minutes) ||
    Number(d.minutes) < 1 ||
    Number(d.minutes) > 1440 ||
    typeof d.category !== "string" ||
    !workCategories.includes(d.category) ||
    typeof d.description !== "string" ||
    !d.description.trim() ||
    d.description.length > 3000
  )
    throw new WorkInputError(
      "Inserisci progetto, data effettiva, durata e descrizione validi.",
    );
  return {
    projectId: d.projectId,
    productionId: d.productionId as string | null,
    workedOn: d.workedOn,
    minutes: Number(d.minutes),
    category: d.category,
    description: d.description.trim(),
  };
}
export function validateDelivery(d: Record<string, unknown>) {
  if (
    !validId(d.projectId) ||
    (d.trackId !== null && !validId(d.trackId)) ||
    typeof d.label !== "string" ||
    !d.label.trim() ||
    d.label.length > 300 ||
    typeof d.done !== "boolean" ||
    typeof d.required !== "boolean" ||
    (d.dueDate !== null &&
      (typeof d.dueDate !== "string" || !validDate(d.dueDate))) ||
    typeof d.notes !== "string" ||
    d.notes.length > 5000
  )
    throw new WorkInputError("Voce di consegna non valida.");
  return {
    projectId: d.projectId,
    trackId: d.trackId as string | null,
    label: d.label.trim(),
    done: d.done,
    required: d.required,
    assigneeEmail: d.assigneeEmail ?? null,
    dueDate: d.dueDate as string | null,
    notes: d.notes.trim(),
  };
}
export function dueGroup(date: string | null, today: string) {
  if (!date) return "Da pianificare";
  if (date < today) return "In ritardo";
  const end = new Date(today + "T12:00:00Z");
  end.setUTCDate(end.getUTCDate() + 7);
  return date <= end.toISOString().slice(0, 10)
    ? "Entro 7 giorni"
    : "Successive";
}
export const duration = (minutes: number) =>
  (minutes / 60).toLocaleString("it-IT", { maximumFractionDigits: 2 }) + " h";
