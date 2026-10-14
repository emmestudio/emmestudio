import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
export async function verifyWorkflow({ svc, db, projectId, artistId }) {
  const actor = "owner@example.test";
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "admin",
    user: { email: actor, name: "Studio Owner" },
  };
  const pid = randomUUID(),
    draft = {
      title: "Progetto modello",
      artist: "Artista",
      artistId,
      service: "Album",
      kind: "Album",
      status: "Pianificazione",
      deadline: null,
      vision: "",
      notes: "",
      music: 0,
      live: 0,
      image: 0,
    };
  await svc.createProject("owner", pid, draft);
  const template = {
    action: "template",
    projectId: pid,
    version: 0,
    template: "Album",
    trackCount: 2,
    plannedMinutes: 1200,
    assigneeEmail: actor,
  };
  await svc.saveWorkflow("owner", actor, "admin", template);
  const count = (await svc.listTasks("owner")).filter(
    (t) => t.projectId === pid,
  ).length;
  await assert.rejects(
    svc.saveWorkflow("owner", actor, "admin", { ...template, version: 1 }),
    /applicabile/,
  );
  assert.equal(
    (await svc.listTasks("owner")).filter((t) => t.projectId === pid).length,
    count,
  );
  assert.equal(
    (await svc.listProduction("owner")).filter(
      (i) => i.projectId === pid && i.kind === "track",
    ).length,
    2,
  );
  assert.equal(
    (await svc.listTasks("owner")).find((t) => t.projectId === pid)
      .assigneeEmail,
    actor,
  );
  const bad = {
    projectId: pid,
    title: "Foreign assignment",
    assignee: "Foreign",
    assigneeEmail: "foreign@example.test",
    status: "Da fare",
    priority: "Normale",
    deadline: null,
    notes: "",
  };
  assert.equal((await svc.saveTask("owner", randomUUID(), bad)).status, 400);
  const hourId = randomUUID(),
    h = {
      projectId: pid,
      productionId: null,
      workedOn: "2026-01-02",
      minutes: 90,
      category: "Mix",
      description: "Mix registrato",
    };
  await svc.saveWorkflow("owner", actor, "admin", {
    action: "hours",
    id: hourId,
    projectId: pid,
    draft: h,
  });
  await svc.saveWorkflow("owner", actor, "admin", {
    action: "hours",
    id: hourId,
    projectId: pid,
    draft: h,
  });
  assert.equal(
    (await svc.listWorkflow("owner")).hours.filter((x) => x.id === hourId)
      .length,
    1,
  );
  await assert.rejects(
    svc.saveWorkflow("owner", "team@example.test", "editor", {
      action: "hours",
      id: hourId,
      projectId: pid,
      version: 1,
      draft: h,
    }),
    /soltanto/,
  );
  await assert.rejects(
    svc.saveWorkflow("owner", actor, "admin", {
      action: "hours",
      id: randomUUID(),
      projectId: pid,
      draft: { ...h, minutes: 1400 },
    }),
    /24 ore/,
  );
  await svc.saveWorkflow("owner", actor, "admin", {
    action: "voidHours",
    id: hourId,
    projectId: pid,
    version: 1,
    reason: "Registrazione duplicata",
  });
  assert.equal(
    (await svc.listWorkflow("owner")).hours.find((x) => x.id === hourId)
      .voidReason,
    "Registrazione duplicata",
  );
  assert.equal((await svc.workHistory("owner", hourId)).length, 2);
  let p = (await svc.listProjects("owner")).find((x) => x.id === pid);
  await assert.rejects(
    svc.updateProject("owner", pid, p.version, { ...p, status: "Completato" }),
    /verifiche/,
  );
  const checklist = (await svc.listWorkflow("owner")).delivery.filter(
    (c) => c.projectId === pid,
  );
  for (const c of checklist)
    await svc.saveWorkflow("owner", actor, "admin", {
      action: "delivery",
      id: c.id,
      projectId: pid,
      version: c.version,
      draft: { ...c, done: true },
    });
  p = (await svc.listProjects("owner")).find((x) => x.id === pid);
  await svc.updateProject("owner", pid, p.version, {
    ...p,
    status: "Completato",
  });
  const c = checklist[0];
  await assert.rejects(
    svc.saveWorkflow("owner", actor, "admin", {
      action: "delivery",
      id: c.id,
      projectId: pid,
      version: c.version + 1,
      draft: { ...c, done: false },
    }),
    /Riattiva/,
  );
  const req = (method, body) =>
    new Request("https://portal.example.test/api/workflow", {
      method,
      headers: {
        Origin: "https://portal.example.test",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "viewer",
    user: { email: "team@example.test", name: "Team" },
  };
  assert.equal((await svc.workflowApi.POST(req("POST", template))).status, 403);
  const data = await (await svc.workflowApi.GET(req("GET"))).json();
  assert.equal(data.admin, false);
  assert.equal("ledger" in data, false);
  assert.equal(data.selfEmail, "team@example.test");
  globalThis.emmeTestSession = {
    workspaceOwnerId: "foreign",
    role: "admin",
    user: { email: "foreign@example.test", name: "Foreign" },
  };
  assert.equal(
    (await (await svc.workflowApi.GET(req("GET"))).json()).hours.length,
    0,
  );
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "admin",
    user: { email: actor, name: "Studio Owner" },
  };
  const stored = new Map();
  let corrupt = false;
  globalThis.emmeTestBlob = {
    put: async (path, body, options) => {
      assert.equal(options.access, "private");
      stored.set(path, body);
      return { pathname: path };
    },
    get: async (path) =>
      stored.has(path)
        ? {
            statusCode: 200,
            stream: new Response(corrupt ? "corrupted" : stored.get(path)).body,
          }
        : null,
    list: async (options) => ({
      hasMore: false,
      blobs: [...stored]
        .filter(([path]) => path.startsWith(options.prefix))
        .map(([pathname, body]) => ({
          pathname,
          size: Buffer.byteLength(body),
          uploadedAt: new Date(),
        })),
    }),
    del: async (path) => {
      stored.delete(path);
    },
  };
  const backup = await svc.createBackup("owner");
  assert.equal(backup.verified, true);
  assert.equal((await svc.listBackups("foreign")).files.length, 0);
  assert.equal(await svc.downloadBackup("foreign", backup.pathname), null);
  corrupt = true;
  await assert.rejects(svc.createBackup("owner"), /CHECKSUM/);
  assert.equal(stored.size, 1);
  corrupt = false;
  assert.equal(
    svc.cronAuthorized("Bearer " + "a".repeat(64), "a".repeat(64)),
    true,
  );
  assert.equal(svc.cronAuthorized("Bearer wrong", "a".repeat(64)), false);
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "editor",
    user: { email: "team@example.test", name: "Team" },
  };
  assert.equal((await svc.backupApi.GET(req("GET"))).status, 403);
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "admin",
    user: { email: actor, name: "Studio Owner" },
  };
  console.log(
    "PASS private backup upload/readback/checksum, failed-copy cleanup, workspace download isolation and non-admin denial",
  );
  console.log(
    "PASS project template transaction, duplicate prevention, real account assignment, foreign assignee rejection, hours ownership/retry/daily limit/reversal, checklist closure guard, reactivation guard and workflow role isolation",
  );
}
