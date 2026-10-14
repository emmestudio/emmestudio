// Runs actual repository services and API handlers against isolated PostgreSQL WASM.
// No network, OAuth credentials, production database, or external calendar access.
import { PGlite } from "@electric-sql/pglite";
import { build } from "esbuild";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const scratch = await mkdtemp(join(tmpdir(), "emme-management-"));
const db = new PGlite();
let queue = Promise.resolve();
async function connect() {
  let unlock;
  const previous = queue;
  queue = new Promise((r) => {
    unlock = r;
  });
  await previous;
  return { query: (q, v) => db.query(q, v), release: () => unlock() };
}
globalThis.emmeTestDb = {
  connect,
  query: async (q, v) => {
    const c = await connect();
    try {
      return await c.query(q, v);
    } finally {
      c.release();
    }
  },
};
globalThis.emmeTestSession = { workspaceOwnerId: "owner", role: "admin" };
const root = resolve(".");
await writeFile(
  join(scratch, "entry.ts"),
  `export * from '${root}/lib/projects.ts'; export * from '${root}/lib/finance.ts'; export * from '${root}/lib/artists.ts'; export * as projectApi from '${root}/app/api/projects/route.ts'; export * as artistApi from '${root}/app/api/artists/route.ts'; export * as financeApi from '${root}/app/api/finance/route.ts'; export * from '${root}/lib/production.ts'; export * from '${root}/lib/production-data.ts'; export * from '${root}/lib/costs.ts'; export * from '${root}/lib/cost-data.ts'; export * from '${root}/lib/backup-data.ts'; export * as productionApi from '${root}/app/api/production/route.ts'; export * as costApi from '${root}/app/api/costs/route.ts'; export * as exportApi from '${root}/app/api/export/route.ts'; export {default as quotePage} from '${root}/app/preventivi/[id]/page.tsx';`,
);
try {
  await build({
    entryPoints: [join(scratch, "entry.ts")],
    outfile: join(scratch, "services.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    nodePaths: [
      join(root, "node_modules"),
      process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    ].filter(Boolean),
    tsconfig: join(root, "tsconfig.json"),
    plugins: [
      {
        name: "isolated-db",
        setup(b) {
          b.onResolve({ filter: /^next\/(link|headers|navigation)$/ }, (a) => ({
            path: a.path,
            namespace: "test",
          }));
          b.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "test",
          }));
          b.onResolve({ filter: /workspace-session$/ }, () => ({
            path: "workspace-session",
            namespace: "test",
          }));
          b.onResolve({ filter: /^(\.\/db|@\/lib\/db)$/ }, () => ({
            path: "db",
            namespace: "test",
          }));
          b.onLoad({ filter: /.*/, namespace: "test" }, (a) => ({
            resolveDir: root,
            contents:
              a.path === "next/link"
                ? "import React from 'react';export default function Link(props){return React.createElement('a',props,props.children);}"
                : a.path === "next/headers"
                  ? "export const headers=async()=>new Headers();"
                  : a.path === "next/navigation"
                    ? 'export const redirect=(p)=>{throw new Error("REDIRECT "+p)};export const notFound=()=>{throw new Error("NOT_FOUND")};'
                    : a.path === "db"
                      ? "export const getDb=()=>globalThis.emmeTestDb;"
                      : a.path === "workspace-session"
                        ? "export const workspaceSession=async()=>globalThis.emmeTestSession;"
                        : "",
            loader: "js",
          }));
        },
      },
    ],
  });
  const svc = await import(join(scratch, "services.mjs"));
  await db.exec(
    "CREATE TABLE \"user\"(id TEXT PRIMARY KEY); INSERT INTO \"user\" VALUES('owner'),('foreign');",
  );
  for (const file of [
    "002-projects.sql",
    "003-tasks.sql",
    "004-members.sql",
    "005-artists-finance.sql",
    "006-production-finance.sql",
  ])
    await db.exec(await readFile(join(root, "db", file), "utf8"));
  const artistId = randomUUID(),
    projectId = randomUUID();
  const artist = {
    name: "Artista di prova",
    email: "artista@example.test",
    phone: "",
    genre: "Pop",
    links: "",
    notes: "",
    direction: true,
    director: "Team Emme Studio",
    objectives: "Nuovo album",
  };
  const draft = {
    title: "Singolo di prova",
    artist: artist.name,
    artistId: null,
    service: "Produzione musicale",
    kind: "Singolo",
    status: "Pianificazione",
    deadline: null,
    vision: "",
    notes: "",
    music: 0,
    live: 0,
    image: 0,
  };
  const extras = {
    newArtist: { id: artistId, draft: artist },
    quote: { amount: 100000, status: "Confermato", notes: "" },
    quoteVersion: 0,
  };
  const project = await svc.createProject("owner", projectId, draft, extras);
  assert.equal(project.artistId, artistId);
  assert.equal((await svc.listArtists("owner")).length, 1);
  assert.equal(
    (await svc.createProject("owner", projectId, draft, extras)).id,
    projectId,
  ); // retry does not duplicate artist
  assert.equal((await svc.listArtists("owner")).length, 1);
  const linked = { ...draft, artistId };
  assert.equal(await svc.updateProject("owner", projectId, 99, linked), null);
  await assert.rejects(
    svc.createProject("foreign", randomUUID(), linked),
    /Artista/,
  );
  const rollbackArtist = randomUUID();
  await assert.rejects(
    svc.createProject("owner", randomUUID(), draft, {
      newArtist: { id: rollbackArtist, draft: artist },
      quote: extras.quote,
      quoteVersion: 99,
    }),
  );
  assert.equal(
    (await svc.listArtists("owner")).some((a) => a.id === rollbackArtist),
    false,
  );
  console.log(
    "PASS project + inline artist + quote atomic commit, retry, stale version, workspace isolation, rollback",
  );
  let quote = (await svc.listLedger("owner")).quotes[0];
  const movement = (action, amount, id = randomUUID()) => ({
    action,
    amount,
    id,
    projectId,
    quoteVersion: quote.version,
    date: "2026-01-01",
    label: "Acconto",
    method: "Bonifico",
    notes: "",
  });
  await svc.saveMovement("owner", movement("due", 40000));
  quote = (await svc.listLedger("owner")).quotes[0];
  await svc.saveMovement("owner", movement("due", 60000));
  quote = (await svc.listLedger("owner")).quotes[0];
  await assert.rejects(
    svc.saveMovement("owner", movement("due", 1)),
    /superano/,
  );
  const receiptId = randomUUID();
  await svc.saveMovement("owner", movement("payment", 25000, receiptId));
  quote = (await svc.listLedger("owner")).quotes[0];
  await svc.saveMovement("owner", movement("payment", 25000, receiptId)); // fresh retry still cannot duplicate
  assert.equal((await svc.listLedger("owner")).payments.length, 1);
  await assert.rejects(
    svc.saveMovement("owner", movement("payment", 75001)),
    /supera/,
  );
  await assert.rejects(
    svc.saveMovement("owner", {
      ...movement("payment", 100),
      date: "2099-01-01",
    }),
    /futuri/,
  );
  await assert.rejects(
    svc.updateProject("owner", projectId, project.version, linked, {
      quote: { amount: 20000, status: "Confermato", notes: "" },
      quoteVersion: quote.version,
    }),
    /inferiore/,
  );
  assert.equal((await svc.listProjects("owner"))[0].version, project.version); // failed quote change rolls project update back
  const concurrency = await Promise.allSettled([
    svc.saveMovement("owner", movement("payment", 40000)),
    svc.saveMovement("owner", movement("payment", 40000)),
  ]);
  assert.equal(concurrency.filter((x) => x.status === "fulfilled").length, 1);
  quote = (await svc.listLedger("owner")).quotes[0];
  await svc.saveMovement("owner", {
    action: "void",
    id: receiptId,
    projectId,
    quoteVersion: quote.version,
    reason: "Duplicato verificato",
  });
  const ledger = await svc.listLedger("owner");
  assert.equal(
    ledger.payments.find((p) => p.id === receiptId).voidReason,
    "Duplicato verificato",
  );
  assert.equal(
    ledger.payments
      .filter((p) => !p.voidReason)
      .reduce((s, p) => s + p.amount, 0),
    40000,
  );
  console.log(
    "PASS installment ceilings, partial payment, duplicate retry, overpayment, future payment, quote rollback, concurrent writes, reversal history",
  );
  process.env.BETTER_AUTH_URL = "https://portal.example.test";
  const request = (method, body) =>
    new Request("https://portal.example.test/api/test", {
      method,
      headers: {
        origin: "https://portal.example.test",
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  for (const role of ["viewer", "editor"]) {
    globalThis.emmeTestSession = { workspaceOwnerId: "owner", role };
    assert.equal((await svc.financeApi.GET(request("GET"))).status, 403);
    assert.equal(
      (await svc.financeApi.POST(request("POST", movement("payment", 1))))
        .status,
      403,
    );
    const response = await svc.projectApi.GET(request("GET"));
    const data = await response.json();
    assert.equal("ledger" in data, false);
    assert.equal(data.canManageFinance, false);
    const write = await svc.projectApi.PATCH(
      request("PATCH", {
        id: projectId,
        version: project.version,
        draft: linked,
        quote: extras.quote,
        quoteVersion: ledger.quotes[0].version,
      }),
    );
    assert.equal(write.status, 403);
  }
  globalThis.emmeTestSession = { workspaceOwnerId: "foreign", role: "admin" };
  assert.deepEqual(await (await svc.financeApi.GET(request("GET"))).json(), {
    quotes: [],
    installments: [],
    payments: [],
  });
  globalThis.emmeTestSession = null;
  for (const api of [svc.projectApi, svc.artistApi, svc.financeApi])
    assert.equal((await api.GET(request("GET"))).status, 401);
  console.log(
    "PASS API financial permissions, operational response redaction, workspace isolation, anonymous access",
  );
  // Legacy migration: exact names preserved, duplicates link only within their owner.
  const legacy = randomUUID();
  await db.query(
    `INSERT INTO studio_projects(id,owner_id,title,artist,kind,status,request_digest) VALUES($1,'foreign','Legacy','Nome precedente','Album','Attivo','legacy')`,
    [legacy],
  );
  const migration = await readFile(
    join(root, "db/005-artists-finance.sql"),
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  const legacyProject = (await svc.listProjects("foreign"))[0];
  assert.ok(legacyProject.artistId);
  assert.equal(legacyProject.artist, "Nome precedente");
  assert.equal((await svc.listArtists("foreign")).length, 1);
  assert.equal((await svc.listLedger("owner")).payments.length, 2);
  console.log(
    "PASS additive legacy migration reruns without duplicating profiles or changing receipts",
  );
  const { verifyProduction } = await import("./production.integration.mjs");
  await verifyProduction({ svc, db, root, projectId });
  if (process.argv.includes("--visual")) {
    const { verifyVisual } = await import("./management.visual.mjs");
    await verifyVisual({ root, scratch, svc, projectId, artistId });
  }
} finally {
  await db.close();
  await rm(scratch, { recursive: true, force: true });
  delete globalThis.emmeTestDb;
  delete globalThis.emmeTestSession;
}
