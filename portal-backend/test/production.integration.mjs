import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
export async function verifyProduction({ svc, db, root, projectId }) {
  globalThis.emmeTestSession = { workspaceOwnerId: "owner", role: "admin" };
  const trackId = randomUUID();
  const track = {
    ...svc.emptyProduction("track", projectId),
    title: "Brano completo",
    assignee: "Team studio",
  };
  await svc.saveProduction(
    "owner",
    trackId,
    undefined,
    svc.validateProduction(track),
    "Team studio",
  );
  await svc.saveProduction(
    "owner",
    trackId,
    1,
    { ...track, status: "Registrazione" },
    "Tecnico",
  );
  await assert.rejects(
    svc.saveProduction("owner", trackId, 1, track, "Tecnico"),
    /modificata/,
  );
  const history = await svc.productionHistory("owner", trackId);
  assert.equal(history.length, 2);
  assert.equal(history[0].actor, "Tecnico");
  assert.equal(history[1].data.status, "Preproduzione");
  assert.equal((await svc.productionHistory("foreign", trackId)).length, 0);
  const recording = {
    ...svc.emptyProduction("recording", projectId),
    title: "Chitarre",
    trackId,
    details: {
      instrument: "Chitarra",
      musician: "Musicista",
      engineer: "Team studio",
      recordedOn: "2026-01-01",
      sessionLink: "https://drive.google.com/folder/example",
    },
  };
  await svc.saveProduction(
    "owner",
    randomUUID(),
    undefined,
    svc.validateProduction(recording),
    "Tecnico",
  );
  await assert.rejects(
    svc.saveProduction(
      "owner",
      randomUUID(),
      undefined,
      { ...recording, trackId: randomUUID() },
      "Tecnico",
    ),
    /brano/,
  );
  const standaloneId = randomUUID();
  const autonomous = {
    ...svc.emptyProduction("recording", projectId),
    title: "Mix indipendente",
    details: {
      ...svc.emptyProduction("recording", projectId).details,
      phase: "Mix",
      engineer: "Team studio",
    },
  };
  await svc.saveProduction(
    "owner",
    standaloneId,
    undefined,
    svc.validateProduction(autonomous),
    "Tecnico",
  );
  assert.equal(
    (await svc.listProduction("owner")).find((i) => i.id === standaloneId)
      ?.trackId,
    null,
  );
  const materialId = randomUUID();
  const material = {
    ...svc.emptyProduction("material", projectId),
    title: "Mix v02",
    trackId,
    details: {
      category: "Mix",
      versionLabel: "v02",
      url: "https://drive.google.com/example",
    },
  };
  await svc.saveProduction(
    "owner",
    materialId,
    undefined,
    svc.validateProduction(material),
    "Tecnico",
  );
  assert.equal(
    (await svc.listProduction("owner")).find((i) => i.id === materialId)
      ?.trackId,
    trackId,
  );
  const q = (await svc.listLedger("owner")).quotes[0];
  const p = (await svc.listProjects("owner")).find((p) => p.id === projectId);
  const items = [
    { description: "Produzione", quantity: 200, unitPrice: 50000 },
  ];
  await svc.updateProject("owner", projectId, p.version, p, {
    quote: {
      amount: 100000,
      status: "Confermato",
      notes: "Condizioni",
      items,
      confirmationNote: "Conferma del team",
    },
    quoteVersion: q.version,
  });
  assert.equal((await svc.listLedger("owner")).quotes[0].items.length, 1);
  assert.ok((await svc.quoteHistory("owner", projectId)).length >= 2);
  const costId = randomUUID(),
    cost = {
      projectId,
      description: "Registrazioni esterne",
      supplier: "Studio",
      category: "Studio esterno",
      amount: 25000,
      status: "Da pagare",
      dueDate: "2026-01-01",
      paidDate: null,
      notes: "",
    };
  await svc.saveCost("owner", costId, undefined, svc.validateCost(cost));
  await svc.saveCost("owner", costId, undefined, cost);
  assert.equal((await svc.listCosts("owner")).length, 1);
  await svc.saveCost("owner", costId, 1, {
    ...cost,
    status: "Pagato",
    paidDate: "2026-01-01",
  });
  await assert.rejects(svc.saveCost("owner", costId, 1, cost), /modificato/);
  assert.equal((await svc.costHistory("owner", costId)).length, 2);
  assert.equal((await svc.listCosts("foreign")).length, 0);
  const request = (method, body) =>
    new Request("https://portal.example.test/api/test", {
      method,
      headers: {
        Origin: "https://portal.example.test",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  for (const role of ["editor", "viewer"]) {
    globalThis.emmeTestSession = { workspaceOwnerId: "owner", role };
    assert.equal((await svc.costApi.GET(request("GET"))).status, 403);
    assert.equal((await svc.exportApi.GET(request("GET"))).status, 403);
    const data = await (await svc.productionApi.GET(request("GET"))).json();
    assert.equal(data.canEdit, role === "editor");
    assert.equal(
      (
        await svc.productionApi.POST(
          request("POST", {
            id: randomUUID(),
            draft: { ...track, title: "Nuovo dal team" },
          }),
        )
      ).status,
      role === "editor" ? 200 : 403,
    );
  }
  globalThis.emmeTestSession = { workspaceOwnerId: "owner", role: "admin" };
  await db.query(
    "INSERT INTO portal_members(email,owner_id,name,role,active) VALUES('team@example.test','owner','Team di prova','viewer',true)",
  );
  const response = await svc.exportApi.GET(request("GET"));
  assert.equal(response.status, 200);
  const backup = await response.json();
  assert.equal(backup.format, "emme-studio-workspace");
  assert.equal("account" in backup.data, false);
  assert.equal("owner_id" in backup.data.studio_projects[0], false);
  assert.equal("request_digest" in backup.data.studio_projects[0], false);
  const restored = new PGlite();
  try {
    await restored.exec(
      'CREATE TABLE "user"(id TEXT PRIMARY KEY);INSERT INTO "user" VALUES(\'restored-owner\');',
    );
    for (const f of [
      "002-projects.sql",
      "003-tasks.sql",
      "004-members.sql",
      "005-artists-finance.sql",
      "006-production-finance.sql",
      "007-workflow.sql",
      "008-operations-trash.sql",
      "009-direct-artist-production.sql",
      "010-production-finance.sql",
      "011-artist-personal-names.sql",
      "012-drive-archive.sql",
    ])
      await restored.exec(await readFile(join(root, "db", f), "utf8"));
    const client = { query: (q, v) => restored.query(q, v) };
    await svc.restoreBusinessExport(client, "restored-owner", backup);
    assert.equal(
      (await restored.query("SELECT count(*) AS count FROM studio_production"))
        .rows[0].count,
      backup.data.studio_production.length,
    );
    assert.equal(
      (await restored.query("SELECT owner_id FROM studio_projects LIMIT 1"))
        .rows[0].owner_id,
      "restored-owner",
    );
    assert.equal(
      (await restored.query("SELECT active FROM portal_members")).rows[0]
        .active,
      false,
    );
    await assert.rejects(
      svc.restoreBusinessExport(client, "restored-owner", backup),
      /NOT_EMPTY/,
    );
    await assert.rejects(
      svc.restoreBusinessExport(client, "restored-owner", {
        ...backup,
        data: { ...backup.data, account: [] },
      }),
      /FORMAT/,
    );
  } finally {
    await restored.close();
  }
  console.log(
    "PASS production history, linked recordings, detailed quote history, costs, role permissions, credential-free export, complete local restore and non-empty target refusal",
  );
}
