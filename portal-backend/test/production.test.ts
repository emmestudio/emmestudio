import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyProduction,
  validateProduction,
  safeLink,
} from "../lib/production-data.ts";
import { validateQuote, quoteTotal, lineTotal } from "../lib/finance-data.ts";
import { validateCost, costSummary } from "../lib/cost-data.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("production restricts states, links, project and required recording/approval evidence", () => {
  const track = { ...emptyProduction("track", id), title: "Brano" };
  assert.equal(validateProduction(track).status, "Preproduzione");
  assert.throws(() =>
    validateProduction({ ...track, status: "Administrator" }),
  );
  assert.throws(() =>
    validateProduction({ ...track, details: { ...track.details, bpm: "401" } }),
  );
  assert.equal(safeLink("javascript:alert(1)"), false);
  assert.equal(safeLink("https://user:password@example.test"), false);
  assert.equal(safeLink("https://drive.google.com/file/example"), true);
  const r = {
    ...emptyProduction("revision", id),
    title: "Mix",
    status: "Approvata",
    details: {
      versionLabel: "v2",
      feedback: "Abbassa voce",
      resolution: "",
      url: "",
      approvalSource: "",
      approvalOn: "",
    },
  };
  assert.throws(() => validateProduction(r), /approvazione/);
  assert.throws(() => validateProduction({...r,details:{...r.details,approvalSource:"Email",approvalOn:"2099-01-01"}}), /ricevuta/);
  assert.throws(() =>
    validateProduction({ ...emptyProduction("recording", id), title: "Voce" }),
  );
});
test("quotes use fractional quantities in hundredths, integer cents and consistent totals", () => {
  const items = [
    { description: "Recording", quantity: 150, unitPrice: 3500 },
    { description: "Mix", quantity: 100, unitPrice: 15000 },
  ];
  assert.equal(lineTotal(items[0]), 5250);
  assert.equal(lineTotal({description:"Mezza unità",quantity:50,unitPrice:101}),51);
  assert.equal(quoteTotal(items), 20250);
  const q = { amount: 20250, status: "Inviato", notes: "", items };
  assert.equal(validateQuote(q).items?.length, 2);
  assert.throws(() => validateQuote({ ...q, amount: 20000 }));
  assert.throws(() =>
    validateQuote({ ...q, items: [{ ...items[0], quantity: 0 }] }),
  );
  assert.throws(() => validateQuote({ ...q, confirmedOn: "2026-02-30" }));
});
test("cost states determine planned spend, actual outflows and payables; cancellations are excluded", () => {
  const d = {
    projectId: id,
    description: "Service",
    supplier: "Fornitore",
    category: "Service",
    amount: 50000,
    status: "Da pagare",
    dueDate: "2026-10-01",
    paidDate: null,
    notes: "",
  };
  assert.equal(validateCost(d).amount, 50000);
  assert.throws(() => validateCost({ ...d, status: "Pagato" }));
  assert.throws(() =>
    validateCost({ ...d, status: "Pagato", paidDate: "2099-01-01" }),
  );
  const totals = costSummary([
    { ...d, id, version: 1 },
    { ...d, id: "b", version: 1, status: "Pagato", paidDate: "2026-01-01" },
    { ...d, id: "c", version: 1, status: "Annullato" },
  ]);
  assert.deepEqual(totals, { planned: 100000, paid: 50000, payable: 50000 });
});
