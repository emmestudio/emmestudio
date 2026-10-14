import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moneyInput,
  validateQuote,
  validateMovement,
  projectBalance,
  checkQuoteChange,
  type Ledger,
} from "../lib/finance-data.ts";
import { validateArtist, emptyArtist, workGroup } from "../lib/artist-data.ts";
test("money uses integer cents and rejects precision, negative values and thousands ambiguity", () => {
  assert.equal(moneyInput("1500,99"), 150099);
  assert.equal(moneyInput("0.10"), 10);
  assert.equal(moneyInput("20"), 2000);
  for (const value of ["1.234", "1,000.00", "-5", "1e3", "NaN", "10000000"])
    assert.throws(() => moneyInput(value));
  assert.throws(() =>
    validateQuote({ amount: 1.1, status: "Confermato", notes: "" }),
  );
  assert.throws(() =>
    validateQuote({ amount: 0, status: "Confermato", notes: "" }),
  );
});
const ledger: Ledger = {
  quotes: [
    {
      projectId: "p",
      amount: 100000,
      status: "Confermato",
      notes: "",
      version: 1,
    },
  ],
  installments: [
    {
      id: "b",
      projectId: "p",
      amount: 60000,
      dueDate: "2026-11-01",
      label: "Saldo",
    },
    {
      id: "a",
      projectId: "p",
      amount: 40000,
      dueDate: "2026-10-01",
      label: "Acconto",
    },
  ],
  payments: [
    {
      id: "x",
      projectId: "p",
      amount: 25000,
      paidDate: "2026-10-01",
      method: "Bonifico",
      notes: "",
      voidReason: null,
    },
  ],
};
test("partial receipts cover earliest installments and overdue is only their remaining amount", () => {
  const b = projectBalance("p", ledger, "2026-10-14");
  assert.equal(b.received, 25000);
  assert.equal(b.outstanding, 75000);
  assert.equal(b.overdue, 15000);
  assert.equal(b.dues[0].id, "a");
  assert.equal(b.dues[0].remaining, 15000);
  assert.equal(b.unscheduled, 0);
  assert.equal(projectBalance("p", ledger, "2026-10-01").overdue, 0);
});
test("voided payments reopen receivables without disappearing from history", () => {
  const reversed = {
    ...ledger,
    payments: ledger.payments.map((p) => ({
      ...p,
      voidReason: "Registrazione errata",
    })),
  };
  const b = projectBalance("p", reversed, "2026-10-14");
  assert.equal(b.received, 0);
  assert.equal(b.outstanding, 100000);
  assert.equal(b.overdue, 40000);
});
test("unconfirmed quotes never count as receivables and unscheduled residual is explicit", () => {
  assert.equal(
    projectBalance(
      "p",
      {
        ...ledger,
        quotes: ledger.quotes.map((q) => ({ ...q, status: "Inviato" })),
      },
      "2026-10-14",
    ).outstanding,
    0,
  );
  assert.equal(
    projectBalance(
      "p",
      { ...ledger, installments: ledger.installments.slice(1) },
      "2026-10-14",
    ).unscheduled,
    60000,
  );
  const fullyPaid = {
    ...ledger,
    payments: [{ ...ledger.payments[0], amount: 100000 }],
  };
  assert.equal(projectBalance("p", fullyPaid, "2026-10-14").outstanding, 0);
  assert.equal(projectBalance("p", fullyPaid, "2026-10-14").overdue, 0);
});
test("quote amendments cannot undercut registered receipts or planned installments", () => {
  const quote = { amount: 10000, status: "Confermato", notes: "" };
  assert.throws(() => checkQuoteChange(quote, 15000, 0));
  assert.throws(() => checkQuoteChange(quote, 0, 15000));
  assert.throws(() => checkQuoteChange({ ...quote, status: "Bozza" }, 1, 0));
  assert.doesNotThrow(() => checkQuoteChange(quote, 5000, 10000));
  assert.throws(() =>
    validateMovement(
      {
        amount: 100,
        date: "2026-02-30",
        label: "Saldo",
        method: "Bonifico",
        notes: "",
      },
      true,
    ),
  );
});
test("artist direction and work groupings are controlled and do not accept owner fields", () => {
  const a = validateArtist({
    ...emptyArtist(),
    name: "Artista",
    direction: true,
    owner_id: "other",
  });
  assert.equal(a.direction, true);
  assert.equal("owner_id" in a, false);
  assert.throws(() =>
    validateArtist({ ...emptyArtist(), name: "Artista", email: "bad" }),
  );
  assert.equal(workGroup("Pianificazione"), "Da realizzare");
  assert.equal(workGroup("In uscita"), "In realizzazione");
  assert.equal(workGroup("Completato"), "Realizzati");
  assert.equal(workGroup("Archiviato"), "Archivio");
});
