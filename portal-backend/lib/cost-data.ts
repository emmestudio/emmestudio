import { validDate } from "./event-data.ts";
import { validId } from "./task-data.ts";
export const costStates = ["Previsto", "Da pagare", "Pagato", "Annullato"];
export const costCategories = [
  "Musicisti",
  "Collaboratori",
  "Service",
  "Studio esterno",
  "Foto e video",
  "Promozione",
  "Attrezzatura",
  "Altro",
];
export type CostDraft = {
  projectId: string;
  description: string;
  supplier: string;
  category: string;
  amount: number;
  status: string;
  dueDate: string | null;
  paidDate: string | null;
  notes: string;
};
export type StudioCost = CostDraft & { id: string; version: number };
export class CostInputError extends Error {}
export function validateCost(input: unknown): CostDraft {
  const d = input as Record<string, unknown> | null;
  if (
    !d ||
    !validId(d.projectId) ||
    !Number.isSafeInteger(d.amount) ||
    Number(d.amount) <= 0 ||
    Number(d.amount) > 999999999 ||
    typeof d.status !== "string" ||
    !costStates.includes(d.status) ||
    typeof d.category !== "string" ||
    !costCategories.includes(d.category)
  )
    throw new CostInputError("Costo non valido.");
  const text = (k: string, max: number, required = false) => {
    if (
      typeof d[k] !== "string" ||
      (d[k] as string).length > max ||
      (required && !(d[k] as string).trim())
    )
      throw new CostInputError("Controlla descrizione, fornitore e note.");
    return (d[k] as string).trim();
  };
  for (const k of ["dueDate", "paidDate"])
    if (
      d[k] !== null &&
      (typeof d[k] !== "string" || !validDate(d[k] as string))
    )
      throw new CostInputError("Data non valida.");
  if (d.status === "Pagato" && !d.paidDate)
    throw new CostInputError("Inserisci la data del pagamento effettuato.");
  if (d.status !== "Pagato" && d.paidDate !== null)
    throw new CostInputError(
      "La data pagamento è prevista solo per costi pagati.",
    );
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (typeof d.paidDate === "string" && d.paidDate > today)
    throw new CostInputError("Il pagamento non può essere futuro.");
  return {
    projectId: d.projectId,
    description: text("description", 300, true),
    supplier: text("supplier", 200),
    category: d.category,
    amount: Number(d.amount),
    status: d.status,
    dueDate: d.dueDate as string | null,
    paidDate: d.paidDate as string | null,
    notes: text("notes", 5000),
  };
}
export function costSummary(costs: StudioCost[]) {
  const active = costs.filter((c) => c.status !== "Annullato");
  return {
    planned: active.reduce((s, c) => s + c.amount, 0),
    paid: active
      .filter((c) => c.status === "Pagato")
      .reduce((s, c) => s + c.amount, 0),
    payable: active
      .filter((c) => c.status === "Da pagare")
      .reduce((s, c) => s + c.amount, 0),
  };
}
