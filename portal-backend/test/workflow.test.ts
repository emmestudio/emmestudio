import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateHours,
  validateDelivery,
  dueGroup,
  templates,
} from "../lib/work-data.ts";
const id = "11111111-1111-4111-8111-111111111111";
test("hours reject future dates, zero duration, excess hours and unrelated identifiers", () => {
  const d = {
    projectId: id,
    productionId: null,
    workedOn: "2026-01-01",
    minutes: 90,
    category: "Mix",
    description: "Mix voce",
  };
  assert.equal(validateHours(d).minutes, 90);
  for (const patch of [
    { minutes: 0 },
    { minutes: 1441 },
    { workedOn: "2099-01-01" },
    { productionId: "bad" },
    { category: "Admin" },
    { description: "" },
  ])
    assert.throws(() => validateHours({ ...d, ...patch }));
});
test("urgencies are Rome date based, include today and seven days, and isolate undated work", () => {
  assert.equal(dueGroup("2026-10-13", "2026-10-14"), "In ritardo");
  assert.equal(dueGroup("2026-10-14", "2026-10-14"), "Entro 7 giorni");
  assert.equal(dueGroup("2026-10-21", "2026-10-14"), "Entro 7 giorni");
  assert.equal(dueGroup("2026-10-22", "2026-10-14"), "Successive");
  assert.equal(dueGroup(null, "2026-10-14"), "Da pianificare");
});
test("all project templates contain tasks and delivery checks; check completion is strictly boolean", () => {
  for (const s of Object.values(templates)) {
    assert.ok(s.tasks.length > 0);
    assert.ok(s.checks.length > 0);
  }
  const d = {
    projectId: id,
    trackId: null,
    label: "Master verificato",
    done: false,
    required: true,
    assigneeEmail: null,
    dueDate: null,
    notes: "",
  };
  assert.equal(validateDelivery(d).required, true);
  assert.throws(() => validateDelivery({ ...d, done: "yes" }));
});
