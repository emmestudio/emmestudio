import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function verifyOperations({ svc, db, artistId }) {
  const id = randomUUID();
  const draft = {
    title: "Progetto gestione e cestino",
    artist: "Artista di prova",
    artistId,
    service: "Produzione",
    kind: "Album",
    status: "In produzione",
    deadline: null,
    vision: "",
    notes: "",
    music: 0,
    live: 0,
    image: 0,
  };
  await svc.createProject("owner", id, draft, {
    quote: { amount: 150000, status: "Confermato", notes: "" },
    quoteVersion: 0,
  });
  const ops = {
    leadEmail: "owner@example.test",
    collaborators: [],
    phase: "Preproduzione",
    nextStep: "Organizzare batterie",
    waitingReason: "Disponibilità musicista",
    followUp: "2026-10-20",
  };
  await svc.saveOperations("owner", id, 1, ops, "owner@example.test");
  assert.equal(
    (await svc.listProjects("owner")).find((p) => p.id === id).operations
      .nextStep,
    ops.nextStep,
  );
  await assert.rejects(
    svc.saveOperations("owner", id, 1, ops, "owner@example.test"),
    /modificato/,
  );
  await assert.rejects(
    svc.saveOperations("foreign", id, 2, ops, "foreign@example.test"),
    /modificato/,
  );
  await assert.rejects(
    svc.saveOperations(
      "owner",
      id,
      2,
      { ...ops, leadEmail: "outsider@example.test" },
      "owner@example.test",
    ),
    /abilitate/,
  );
  const a = randomUUID(),
    b = randomUUID();
  const task = {
    projectId: id,
    title: "Editing",
    assignee: "",
    assigneeEmail: null,
    status: "Da fare",
    priority: "Normale",
    deadline: null,
    notes: "",
  };
  assert.equal((await svc.saveTask("owner", a, task)).status, 200);
  assert.equal(
    (await svc.saveTask("owner", b, { ...task, title: "Mix", blockedBy: [a] }))
      .status,
    200,
  );
  assert.equal(
    (
      await svc.saveTask(
        "owner",
        b,
        { ...task, title: "Mix", status: "In corso", blockedBy: [a] },
        1,
      )
    ).status,
    409,
  );
  assert.equal(
    (await svc.saveTask("owner", a, { ...task, blockedBy: [b] }, 1)).status,
    400,
  );
  assert.equal(
    (await svc.saveTask("owner", a, { ...task, status: "Completata" }, 1))
      .status,
    200,
  );
  assert.equal(
    (
      await svc.saveTask(
        "owner",
        b,
        { ...task, title: "Mix", status: "In corso", blockedBy: [a] },
        1,
      )
    ).status,
    200,
  );
  assert.equal((await svc.saveTask("owner", a, task, 2)).status, 409);
  await assert.rejects(
    svc.trashResource(
      "owner",
      "task",
      a,
      2,
      false,
      "Editing",
      "owner@example.test",
    ),
    /dipendenze/,
  );
  const track = randomUUID(),
    recording = randomUUID();
  await svc.saveProduction(
    "owner",
    track,
    undefined,
    { ...svc.emptyProduction("track", id), title: "Brano da eliminare" },
    "Owner",
  );
  await svc.saveProduction(
    "owner",
    recording,
    undefined,
    {
      ...svc.emptyProduction("recording", id),
      title: "Voce collegata",
      trackId: track,
    },
    "Owner",
  );
  await assert.rejects(
    svc.trashResource(
      "owner",
      "production",
      track,
      1,
      false,
      "Titolo errato",
      "owner@example.test",
    ),
    /titolo/,
  );
  await svc.trashResource(
    "owner",
    "production",
    track,
    1,
    false,
    "Brano da eliminare",
    "owner@example.test",
  );
  assert.ok(
    !(await svc.listProduction("owner")).some((p) =>
      [track, recording].includes(p.id),
    ),
  );
  await assert.rejects(
    svc.saveProduction(
      "owner",
      recording,
      1,
      {
        ...svc.emptyProduction("recording", id),
        title: "Voce collegata",
        trackId: track,
      },
      "Owner",
    ),
    /brano/,
  );
  await assert.rejects(
    svc.saveProduction(
      "owner",
      track,
      2,
      { ...svc.emptyProduction("track", id), title: "Brano da eliminare" },
      "Owner",
    ),
    /Ripristina/,
  );
  await svc.trashResource(
    "owner",
    "production",
    track,
    2,
    true,
    "",
    "owner@example.test",
  );
  assert.ok(
    (await svc.listProduction("owner")).some((p) => p.id === recording),
  );
  await svc.trashResource(
    "owner",
    "project",
    id,
    2,
    false,
    draft.title,
    "owner@example.test",
  );
  assert.ok(!(await svc.listProjects("owner")).some((p) => p.id === id));
  assert.ok(
    !(await svc.listProduction("owner")).some((p) => p.projectId === id),
  );
  assert.ok(!(await svc.listTasks("owner")).some((p) => p.projectId === id));
  assert.ok(
    !(await svc.listLedger("owner")).quotes.some((q) => q.projectId === id),
  );
  assert.ok(
    (await svc.listProjects("owner", true)).some(
      (p) => p.id === id && p.deletedAt,
    ),
  );
  await assert.rejects(
    svc.saveOperations("owner", id, 3, ops, "owner@example.test"),
    /modificato/,
  );
  await assert.rejects(
    svc.trashResource(
      "owner",
      "production",
      track,
      3,
      false,
      "Brano da eliminare",
      "owner@example.test",
    ),
    /progetto/,
  );
  await svc.trashResource(
    "owner",
    "project",
    id,
    3,
    true,
    "",
    "owner@example.test",
  );
  assert.ok((await svc.listTasks("owner")).some((p) => p.id === a));
  assert.ok((await svc.listLedger("owner")).quotes.some(q=>q.projectId===id),"Restore reinstates preserved quote");
  await assert.rejects(
    svc.trashResource(
      "owner",
      "artist",
      artistId,
      (await svc.listArtists("owner")).find((a) => a.id === artistId).version,
      false,
      (await svc.listArtists("owner")).find((a) => a.id === artistId).name,
      "owner@example.test",
    ),
    /progetti/,
  );
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  const post = (body, origin = "http://localhost:3000") =>
    new Request("http://localhost:3000/api/operations", {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const old = globalThis.emmeTestSession;
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "editor",
    user: { email: "editor@example.test" },
  };
  assert.equal(
    (
      await svc.operationsApi.POST(
        post({
          action: "delete",
          kind: "project",
          id,
          version: 4,
          confirmation: draft.title,
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await svc.operationsApi.GET(
        new Request("http://localhost:3000/api/operations"),
      )
    ).status,
    403,
  );
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "viewer",
    user: { email: "viewer@example.test" },
  };
  assert.equal(
    (
      await svc.operationsApi.POST(
        post({ action: "operations", id, version: 4, draft: ops }),
      )
    ).status,
    403,
  );
  globalThis.emmeTestSession = old;
  assert.equal(
    (
      await svc.operationsApi.POST(
        post(
          {
            action: "delete",
            kind: "project",
            id,
            version: 4,
            confirmation: draft.title,
          },
          "https://foreign.test",
        ),
      )
    ).status,
    403,
  );
  const exportData = await svc.exportApi.GET(
    new Request("http://localhost:3000/api/export"),
  );
  assert.equal(exportData.status, 200);
  globalThis.emmeTestSession = {
    workspaceOwnerId: "owner",
    role: "admin",
    user: { email: "owner@example.test" },
  };
  let calendarWrites = 0;
  globalThis.emmeTestCalendar = {
    create: async (eventId, d) => {
      calendarWrites++;
      return {
        id: eventId,
        etag: "test-etag",
        summary: d.title,
        start: { dateTime: d.start },
        end: { dateTime: d.end },
        extendedProperties: {
          private: {
            emmeProjectId: d.projectId,
            emmeParticipants: d.participants,
          },
        },
      };
    },
  };
  const eventDraft = {
    title: "Sessione del progetto",
    description: "",
    location: "Emme Studio",
    category: "Registrazione",
    allDay: false,
    start: "2026-10-20T08:00:00Z",
    end: "2026-10-20T09:00:00Z",
    projectId: id,
    participants: "Marcello e artista",
  };
  const calendarRequest = (d) =>
    new Request("http://localhost:3000/api/calendar/events", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "e" + "a".repeat(32), draft: d }),
    });
  const event = await svc.calendarApi.POST(calendarRequest(eventDraft));
  assert.equal(event.status, 200);
  assert.equal((await event.json()).event.projectId, id);
  assert.equal(
    (
      await svc.calendarApi.POST(
        calendarRequest({ ...eventDraft, projectId: randomUUID() }),
      )
    ).status,
    400,
  );
  assert.equal(calendarWrites, 1);
  globalThis.emmeTestSession = old;
  delete globalThis.emmeTestCalendar;
  const retryId = randomUUID();
  const retryDraft = { ...task, title: "Retry dipendenze", blockedBy: [a] };
  await svc.saveTask("owner", retryId, retryDraft);
  await svc.saveTask("owner", retryId, { ...retryDraft, blockedBy: [] }, 1);
  await svc.saveTask("owner", retryId, retryDraft);
  assert.deepEqual(
    (await svc.listTasks("owner")).find((t) => t.id === retryId).blockedBy,
    [],
  );
  const independentArtist = randomUUID();
  await svc.saveArtist("owner", independentArtist, undefined, {
    name: "Artista temporaneo",
    email: "",
    phone: "",
    genre: "",
    links: "",
    notes: "",
    direction: false,
    director: "",
    objectives: "",
  });
  await svc.trashResource(
    "owner",
    "artist",
    independentArtist,
    1,
    false,
    "Artista temporaneo",
    "owner@example.test",
  );
  assert.ok(
    !(await svc.listArtists("owner")).some((a) => a.id === independentArtist),
  );
  await svc.trashResource(
    "owner",
    "artist",
    independentArtist,
    2,
    true,
    "",
    "owner@example.test",
  );
  assert.ok(
    (await svc.listArtists("owner")).some((a) => a.id === independentArtist),
  );
  const temporary = randomUUID();
  await svc.saveTask("owner", temporary, {
    ...task,
    title: "Attività temporanea",
  });
  await svc.trashResource(
    "owner",
    "task",
    temporary,
    1,
    false,
    "Attività temporanea",
    "owner@example.test",
  );
  assert.ok(!(await svc.listTasks("owner")).some((t) => t.id === temporary));
  assert.equal(
    (
      await svc.saveTask(
        "owner",
        temporary,
        { ...task, title: "Attività temporanea" },
        2,
      )
    ).status,
    409,
  );
  await svc.trashResource(
    "owner",
    "task",
    temporary,
    2,
    true,
    "",
    "owner@example.test",
  );
  assert.ok((await svc.listTasks("owner")).some((t) => t.id === temporary));
  await db.exec(
    await (
      await import("node:fs/promises")
    ).readFile(
      new URL("../db/008-operations-trash.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(
    (await svc.listProjects("owner")).find((p) => p.id === id).operations
      .nextStep,
  );
  console.log(
    "PASS operations assignment/version/workspace isolation, dependency blocking/cycle/reopening checks, typed deletion, dependent hiding/restoring, preserved finances, editor/viewer and origin denial",
  );
}
