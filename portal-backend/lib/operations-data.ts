import { validDate } from "./event-data.ts";
import { validId, type StudioTask } from "./task-data.ts";
import type { StudioProject } from "./project-data.ts";
export const boardColumns = [
  "Da pianificare",
  "In lavorazione",
  "In attesa",
  "Da consegnare",
  "Completati",
] as const;
export const projectPhases: Record<string, string[]> = {
  Singolo: [
    "Brief e reference",
    "Preproduzione",
    "Registrazioni",
    "Editing",
    "Mix e approvazione",
    "Mastering",
    "Consegna",
  ],
  Album: [
    "Direzione e tracklist",
    "Preproduzione",
    "Registrazioni",
    "Editing",
    "Mix e approvazioni",
    "Mastering album",
    "Consegna",
  ],
  Live: [
    "Brief e scaletta",
    "Organico e service",
    "Sequenze e regia",
    "Prove",
    "Generale e verifiche",
    "Show",
    "Chiusura",
  ],
  "Percorso artistico": [
    "Obiettivi e identità",
    "Piano musicale",
    "Produzione",
    "Immagine e comunicazione",
    "Live e release",
    "Verifica risultati",
  ],
};
export type Operations = {
  leadEmail: string | null;
  collaborators: string[];
  phase: string;
  nextStep: string;
  waitingReason: string;
  followUp: string | null;
};
export const emptyOperations = (): Operations => ({
  leadEmail: null,
  collaborators: [],
  phase: "",
  nextStep: "",
  waitingReason: "",
  followUp: null,
});
export function validateOperations(input: unknown, kind: string): Operations {
  const d = input as Operations;
  if (
    !d ||
    typeof d !== "object" ||
    !Array.isArray(d.collaborators) ||
    d.collaborators.length > 30 ||
    d.collaborators.some((e) => typeof e !== "string" || e.length > 254) ||
    (d.leadEmail !== null &&
      (typeof d.leadEmail !== "string" || d.leadEmail.length > 254)) ||
    typeof d.phase !== "string" ||
    (d.phase !== "" && !projectPhases[kind]?.includes(d.phase)) ||
    typeof d.nextStep !== "string" ||
    d.nextStep.length > 1000 ||
    typeof d.waitingReason !== "string" ||
    d.waitingReason.length > 2000 ||
    (d.followUp !== null &&
      (typeof d.followUp !== "string" || !validDate(d.followUp)))
  )
    throw new Error("OPERATION_INPUT");
  if (d.followUp && !d.waitingReason.trim()) throw new Error("OPERATION_INPUT");
  return {
    ...d,
    leadEmail: d.leadEmail?.trim().toLowerCase() ?? null,
    collaborators: [
      ...new Set(d.collaborators.map((e) => e.trim().toLowerCase())),
    ],
    nextStep: d.nextStep.trim(),
    waitingReason: d.waitingReason.trim(),
  };
}
export function boardColumn(p: StudioProject) {
  if (["Completato", "Archiviato"].includes(p.status)) return "Completati";
  if (p.operations?.waitingReason) return "In attesa";
  if (p.status === "In uscita") return "Da consegnare";
  return p.status === "Pianificazione" ? "Da pianificare" : "In lavorazione";
}
export function blockedTask(
  t: Pick<StudioTask, "blockedBy">,
  tasks: StudioTask[],
) {
  return (t.blockedBy ?? []).some((id) => {
    const p = tasks.find((x) => x.id === id);
    return !p || p.status !== "Completata";
  });
}
export function validateDependencies(d: unknown): string[] {
  if (d === undefined) return [];
  if (!Array.isArray(d) || d.length > 50 || d.some((id) => !validId(id)))
    throw new Error("DEPENDENCY_INPUT");
  return [...new Set(d)];
}
