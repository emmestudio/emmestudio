import { validDate } from "./event-data.ts";
export const quoteStates = ["Bozza", "Inviato", "Confermato", "Rifiutato"];
export const paymentMethods = ["Bonifico", "Contanti", "Carta", "Altro"];
export type QuoteLine = {
  description: string;
  quantity: number;
  unitPrice: number;
};
export type QuoteDraft = {
  amount: number;
  status: string;
  notes: string;
  items?: QuoteLine[];
  confirmedOn?: string | null;
  confirmationNote?: string;
};
export const lineTotal = (line: QuoteLine) =>
  Math.round((line.quantity * line.unitPrice) / 100);
export const quoteTotal = (items: QuoteLine[]) =>
  items.reduce((sum, line) => sum + lineTotal(line), 0);
export type Quote = QuoteDraft & { projectId: string; version: number };
export type Installment = {
  id: string;
  projectId: string;
  amount: number;
  dueDate: string;
  label: string;
};
export type Payment = {
  id: string;
  projectId: string;
  amount: number;
  paidDate: string;
  method: string;
  notes: string;
  voidReason: string | null;
};
export type Ledger = {
  quotes: Quote[];
  installments: Installment[];
  payments: Payment[];
};
export class FinanceInputError extends Error {}
export function moneyInput(value: string): number {
  if (!/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim()))
    throw new FinanceInputError(
      "Inserisci un importo in euro con massimo due decimali, senza separatori delle migliaia.",
    );
  const [whole, dec = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(dec.padEnd(2, "0"));
  if (cents > 999999999) throw new FinanceInputError("Importo troppo elevato.");
  return cents;
}
export const euro = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
export function validateQuote(input: unknown): QuoteDraft {
  const d = input as Record<string, unknown> | null;
  if (
    !d ||
    !Number.isSafeInteger(d.amount) ||
    Number(d.amount) < 0 ||
    Number(d.amount) > 999999999 ||
    typeof d.status !== "string" ||
    !quoteStates.includes(d.status) ||
    typeof d.notes !== "string" ||
    d.notes.length > 5000
  )
    throw new FinanceInputError("Preventivo non valido.");
  if (d.status === "Confermato" && Number(d.amount) === 0)
    throw new FinanceInputError(
      "Un preventivo confermato deve avere un importo maggiore di zero.",
    );
  let items: QuoteLine[] | undefined;
  if (d.items !== undefined) {
    if (!Array.isArray(d.items) || d.items.length > 100)
      throw new FinanceInputError("Massimo 100 voci per preventivo.");
    items = d.items.map((raw: unknown) => {
      const l = raw as Record<string, unknown> | null;
      if (
        !l ||
        typeof l.description !== "string" ||
        !l.description.trim() ||
        l.description.length > 300 ||
        !Number.isSafeInteger(l.quantity) ||
        Number(l.quantity) < 1 ||
        Number(l.quantity) > 1000000 ||
        !Number.isSafeInteger(l.unitPrice) ||
        Number(l.unitPrice) < 0 ||
        Number(l.unitPrice) > 999999999
      )
        throw new FinanceInputError(
          "Controlla descrizione, quantità e tariffa delle voci.",
        );
      return {
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      };
    });
    if (
      items.length &&
      (quoteTotal(items) !== d.amount || quoteTotal(items) > 999999999)
    )
      throw new FinanceInputError(
        "Il totale deve corrispondere alle voci del preventivo.",
      );
  }
  if (
    d.confirmedOn !== undefined &&
    d.confirmedOn !== null &&
    (typeof d.confirmedOn !== "string" || !validDate(d.confirmedOn))
  )
    throw new FinanceInputError("Data conferma non valida.");
  if (
    d.confirmationNote !== undefined &&
    (typeof d.confirmationNote !== "string" || d.confirmationNote.length > 2000)
  )
    throw new FinanceInputError("Riferimento conferma non valido.");
  return {
    amount: Number(d.amount),
    status: d.status,
    notes: d.notes.trim(),
    ...(items !== undefined ? { items } : {}),
    ...(d.confirmedOn !== undefined
      ? { confirmedOn: d.confirmedOn as string | null }
      : {}),
    ...(d.confirmationNote !== undefined
      ? { confirmationNote: (d.confirmationNote as string).trim() }
      : {}),
  };
}
export function validateMovement(d: Record<string, unknown>, payment: boolean) {
  if (
    !Number.isSafeInteger(d.amount) ||
    Number(d.amount) <= 0 ||
    Number(d.amount) > 999999999 ||
    typeof d.date !== "string" ||
    !validDate(d.date) ||
    typeof d.label !== "string" ||
    !d.label.trim() ||
    d.label.length > 200
  )
    throw new FinanceInputError(
      "Inserisci importo, data e descrizione validi.",
    );
  if (
    payment &&
    (typeof d.method !== "string" || !paymentMethods.includes(d.method))
  )
    throw new FinanceInputError("Metodo di pagamento non valido.");
  if (typeof d.notes !== "string" || d.notes.length > 5000)
    throw new FinanceInputError("Note non valide.");
  return {
    amount: Number(d.amount),
    date: d.date,
    label: d.label.trim(),
    method: payment ? String(d.method) : "",
    notes: d.notes.trim(),
  };
}
export function projectBalance(
  projectId: string,
  ledger: Ledger,
  today: string,
) {
  const quote = ledger.quotes.find((q) => q.projectId === projectId);
  const received = ledger.payments
    .filter((p) => p.projectId === projectId && !p.voidReason)
    .reduce((s, p) => s + p.amount, 0);
  const installments = ledger.installments
    .filter((i) => i.projectId === projectId)
    .sort(
      (a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id),
    );
  let credit = received;
  const dues = installments.map((i) => {
    const paid = Math.min(credit, i.amount);
    credit -= paid;
    return { ...i, remaining: i.amount - paid };
  });
  const confirmed = quote?.status === "Confermato" ? quote.amount : 0;
  const outstanding = Math.max(0, confirmed - received);
  const overdue =
    quote?.status === "Confermato"
      ? dues
          .filter((i) => i.dueDate < today)
          .reduce((s, i) => s + i.remaining, 0)
      : 0;
  const unscheduled = Math.max(
    0,
    confirmed - installments.reduce((s, i) => s + i.amount, 0) - credit,
  );
  return {
    quote,
    received,
    confirmed,
    outstanding,
    overdue,
    dues,
    unscheduled,
  };
}
export function checkQuoteChange(
  d: QuoteDraft,
  received: number,
  scheduled: number,
) {
  if (received > 0 && d.status !== "Confermato")
    throw new FinanceInputError(
      "Il preventivo ha incassi registrati e deve restare confermato.",
    );
  if (d.amount < Math.max(received, scheduled))
    throw new FinanceInputError(
      "L’importo non può essere inferiore agli incassi o alle rate pianificate.",
    );
}
