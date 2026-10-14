import { validDate } from "./event-data.ts";
export const taskStates = ["Da fare", "In corso", "Completata"];
export const taskPriorities = ["Alta", "Normale", "Bassa"];
export type TaskDraft = {
  projectId: string;
  title: string;
  assignee: string;
  blockedBy?: string[];
  assigneeEmail?: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  notes: string;
};
export type StudioTask = TaskDraft & {
  id: string;
  version: number;
  projectTitle: string;
  projectStatus: string;
  updatedAt: string;
};
export class TaskInputError extends Error {}
export function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
  );
}
export function validateTask(input: unknown): TaskDraft {
  if (!input || typeof input !== "object")
    throw new TaskInputError("Dati attività non validi.");
  const data = input as Record<string, unknown>;
  if (!validId(data.projectId))
    throw new TaskInputError("Seleziona un progetto.");
  if (
    typeof data.title !== "string" ||
    !data.title.trim() ||
    data.title.length > 300
  )
    throw new TaskInputError("Inserisci un titolo entro 300 caratteri.");
  if (
    typeof data.assignee !== "string" ||
    data.assignee.length > 200 ||
    typeof data.notes !== "string" ||
    data.notes.length > 10000
  )
    throw new TaskInputError("Controlla responsabile e note.");
  if (
    typeof data.status !== "string" ||
    !taskStates.includes(data.status) ||
    typeof data.priority !== "string" ||
    !taskPriorities.includes(data.priority)
  )
    throw new TaskInputError("Stato o priorità non valida.");
  if (
    data.deadline !== null &&
    (typeof data.deadline !== "string" || !validDate(data.deadline))
  )
    throw new TaskInputError("Scadenza non valida.");
  if (
    data.assigneeEmail !== undefined &&
    data.assigneeEmail !== null &&
    (typeof data.assigneeEmail !== "string" || data.assigneeEmail.length > 254)
  )
    throw new TaskInputError("Responsabile non valido.");
  if (
    data.blockedBy !== undefined &&
    (!Array.isArray(data.blockedBy) ||
      data.blockedBy.length > 50 ||
      data.blockedBy.some((id) => !validId(id)))
  )
    throw new TaskInputError("Dipendenze non valide.");
  return {
    blockedBy: Array.isArray(data.blockedBy)
      ? (data.blockedBy as string[])
      : undefined,
    assigneeEmail: data.assigneeEmail as string | null | undefined,
    projectId: data.projectId,
    title: data.title.trim(),
    assignee: data.assignee.trim(),
    status: data.status,
    priority: data.priority,
    deadline: data.deadline as string | null,
    notes: data.notes.trim(),
  };
}
export function overdueTask(
  task: Pick<TaskDraft, "status" | "deadline">,
  today: string,
) {
  return (
    task.status !== "Completata" &&
    Boolean(task.deadline && task.deadline < today)
  );
}
