import "server-only";
import type { PoolClient } from "pg";
import { getDb } from "./db";
import {
  checkQuoteChange,
  FinanceInputError,
  type Ledger,
  type QuoteDraft,
  validateMovement,
} from "./finance-data";
export async function listLedger(owner: string): Promise<Ledger> {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const q = await c.query(
      'SELECT project_id AS "projectId",amount,status,notes,version FROM studio_quotes WHERE owner_id=$1',
      [owner],
    );
    const i = await c.query(
      'SELECT id,project_id AS "projectId",amount,due_date AS "dueDate",label FROM studio_installments WHERE owner_id=$1 ORDER BY due_date,id',
      [owner],
    );
    const p = await c.query(
      'SELECT id,project_id AS "projectId",amount,paid_date AS "paidDate",method,notes,void_reason AS "voidReason" FROM studio_payments WHERE owner_id=$1 ORDER BY paid_date DESC,created_at DESC',
      [owner],
    );
    await c.query("COMMIT");
    return { quotes: q.rows, installments: i.rows, payments: p.rows };
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

export async function writeQuote(
  c: PoolClient,
  owner: string,
  project: string,
  d: QuoteDraft,
  expected: number,
) {
  const existing = await c.query(
    "SELECT version FROM studio_quotes WHERE owner_id=$1 AND project_id=$2 FOR UPDATE",
    [owner, project],
  );
  if ((existing.rows[0]?.version ?? 0) !== expected)
    throw new FinanceInputError(
      "Il preventivo è cambiato. Aggiorna e riapri il progetto.",
    );
  const totals = await c.query(
    `SELECT (SELECT COALESCE(sum(amount),0) FROM studio_payments WHERE owner_id=$1 AND project_id=$2 AND void_reason IS NULL) AS received,(SELECT COALESCE(sum(amount),0) FROM studio_installments WHERE owner_id=$1 AND project_id=$2) AS scheduled`,
    [owner, project],
  );
  checkQuoteChange(
    d,
    Number(totals.rows[0].received),
    Number(totals.rows[0].scheduled),
  );
  await c.query(
    `INSERT INTO studio_quotes(project_id,owner_id,amount,status,notes) VALUES($1,$2,$3,$4,$5) ON CONFLICT(project_id) DO UPDATE SET amount=$3,status=$4,notes=$5,version=studio_quotes.version+1,updated_at=now()`,
    [project, owner, d.amount, d.status, d.notes],
  );
}
export async function saveMovement(owner: string, b: Record<string, unknown>) {
  const c = await getDb().connect();
  try {
    await c.query("BEGIN");
    // Project lock serializes quote changes, receipt registrations, reversals and schedule edits.
    const project = await c.query(
      "SELECT id FROM studio_projects WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, b.projectId],
    );
    if (!project.rows[0])
      throw new FinanceInputError("Progetto non disponibile.");
    const q = await c.query(
      "SELECT amount,status,version FROM studio_quotes WHERE owner_id=$1 AND project_id=$2",
      [owner, b.projectId],
    );
    if (!q.rows[0] || q.rows[0].version !== b.quoteVersion)
      throw new FinanceInputError(
        "Situazione economica cambiata. Aggiorna prima di riprovare.",
      );
    if (b.action === "void") {
      if (
        typeof b.reason !== "string" ||
        b.reason.trim().length < 3 ||
        b.reason.length > 1000
      )
        throw new FinanceInputError("Indica il motivo dello storno.");
      const r = await c.query(
        "UPDATE studio_payments SET void_reason=$4,voided_at=now() WHERE owner_id=$1 AND project_id=$2 AND id=$3 AND void_reason IS NULL RETURNING id",
        [owner, b.projectId, b.id, b.reason.trim()],
      );
      if (!r.rows[0])
        throw new FinanceInputError("Incasso già stornato o non disponibile.");
    } else if (b.action === "removeDue") {
      const r = await c.query(
        "DELETE FROM studio_installments WHERE owner_id=$1 AND project_id=$2 AND id=$3 RETURNING id",
        [owner, b.projectId, b.id],
      );
      if (!r.rows[0]) throw new FinanceInputError("Scadenza già rimossa.");
    } else if (b.action === "payment" || b.action === "due") {
      if (q.rows[0].status !== "Confermato")
        throw new FinanceInputError(
          "Conferma prima il preventivo del progetto.",
        );
      const d = validateMovement(b, b.action === "payment");
      const table =
        b.action === "payment" ? "studio_payments" : "studio_installments";
      const existing = await c.query(
        `SELECT * FROM ${table} WHERE id=$1 AND owner_id=$2 AND project_id=$3`,
        [b.id, owner, b.projectId],
      );
      if (existing.rows[0]) {
        const e = existing.rows[0];
        const matches =
          e.amount === d.amount &&
          (e.paid_date ?? e.due_date) === d.date &&
          (b.action === "payment"
            ? e.method === d.method && e.notes === d.notes
            : e.label === d.label);
        if (!matches)
          throw new FinanceInputError(
            "Identificativo già usato per una registrazione diversa.",
          );
        await c.query("COMMIT");
        return;
      }
      const totals = await c.query(
        `SELECT COALESCE(sum(amount),0) AS total FROM ${table} WHERE owner_id=$1 AND project_id=$2 ${b.action === "payment" ? "AND void_reason IS NULL" : ""}`,
        [owner, b.projectId],
      );
      if (Number(totals.rows[0].total) + d.amount > q.rows[0].amount)
        throw new FinanceInputError(
          b.action === "payment"
            ? "L’incasso supera il residuo del preventivo."
            : "Le rate superano il totale del preventivo.",
        );
      if (b.action === "payment") {
        const today = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Rome",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        if (d.date > today)
          throw new FinanceInputError(
            "Un incasso deve essere già ricevuto. Usa una scadenza per i pagamenti futuri.",
          );
        await c.query(
          "INSERT INTO studio_payments(id,owner_id,project_id,amount,paid_date,method,notes) VALUES($1,$2,$3,$4,$5,$6,$7)",
          [b.id, owner, b.projectId, d.amount, d.date, d.method, d.notes],
        );
      } else
        await c.query(
          "INSERT INTO studio_installments(id,owner_id,project_id,amount,due_date,label) VALUES($1,$2,$3,$4,$5,$6)",
          [b.id, owner, b.projectId, d.amount, d.date, d.label],
        );
    } else throw new FinanceInputError("Operazione non valida.");
    await c.query(
      "UPDATE studio_quotes SET version=version+1,updated_at=now() WHERE owner_id=$1 AND project_id=$2",
      [owner, b.projectId],
    );
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
