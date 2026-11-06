import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

const tmp = await mkdtemp(join(tmpdir(), "emme-label-"));
const db = new PGlite();
globalThis.labelTestDb = {
  query: (sql, values) => db.query(sql, values),
  connect: async () => ({ query: (sql, values) => db.query(sql, values), release() {} }),
};
globalThis.labelTestOwner = { user: { id: "owner" } };
process.env.BETTER_AUTH_URL = "https://portal.example.test";
process.env.PORTAL_OWNER_EMAIL = "owner@example.test";
const origin = process.env.BETTER_AUTH_URL;

try {
  await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY,email text,"emailVerified" boolean);
    INSERT INTO "user" VALUES ('owner','owner@example.test',true),('other','other@example.test',true);`);
  for (const sql of ["014-news-hd-covers.sql", "028-label-catalog.sql", "029-label-catalog-order.sql", "029-label-catalog-order.sql", "030-site-partners.sql", "030-site-partners.sql"])
    await db.exec(await readFile("db/" + sql, "utf8"));
  await build({
    stdin: {
      contents: `export * as admin from '${resolve("app/api/label-catalog/route.ts")}';
        export * as feed from '${resolve("app/api/public/label/route.ts")}';
        export * as partners from '${resolve("app/api/public/partners/route.ts")}';
        export * as image from '${resolve("app/api/label-catalog/image/[id]/route.ts")}';`,
      resolveDir: resolve("."),
    },
    outfile: join(tmp, "routes.mjs"), bundle: true, platform: "node", format: "esm",
    plugins: [{ name: "isolate", setup(b) {
      b.onResolve({ filter: /^(server-only|sharp|\.\/db|@\/lib\/(db|owner-session))$/ }, args =>
        ({ path: args.path, namespace: "mock" }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, ({ path }) => ({ contents:
        path === "server-only" ? "" :
        path === "sharp" ? 'export default bytes=>({rotate(){return this},resize(){return this},webp(){return this},async toBuffer(){return bytes}})' :
        path.endsWith("/owner-session") ? "export const ownerSession=async()=>globalThis.labelTestOwner" :
        "export const getDb=()=>globalThis.labelTestDb",
      }));
    } }],
  });
  const { admin, feed, image, partners } = await import(join(tmp, "routes.mjs"));
  const post = (data, source = origin) => admin.POST(new Request(origin + "/api/label-catalog", {
    method: "POST", headers: { origin: source, "Content-Type": "application/json" }, body: JSON.stringify(data),
  }));
  const getFeed = () => feed.GET(new Request(origin + "/api/public/label", {
    headers: { origin: "https://emmestudioproduction.it" },
  }));
  const fixture = { kind: "artist", name: "Artista esempio", slug: "artista-esempio", tagline: "Voce",
    body: "Prima parte.\n\nSeconda parte.", links: { Instagram: "https://www.instagram.com/esempio/" }, published: false };
  const upload = crypto.randomUUID();
  await db.query(`INSERT INTO studio_news_cover_uploads(id,owner_id,total,received,mime_type,bytes)
    VALUES($1,'owner',3,3,'image/webp',$2)`, [upload, Buffer.from("img")]);
  globalThis.labelTestOwner = null;
  assert.equal((await post(fixture)).status, 401);
  globalThis.labelTestOwner = { user: { id: "owner" } };
  assert.equal((await post(fixture, "https://evil.example")).status, 403);
  assert.equal((await post({ ...fixture, published: true })).status, 400);
  assert.equal((await post({ ...fixture, links: { Instagram: "javascript:alert(1)" } })).status, 400);
  const saved = await post({ ...fixture, upload });
  assert.equal(saved.status, 200, await saved.clone().text());
  const draft = (await saved.json()).entry;
  assert.deepEqual((await (await getFeed()).json()).artists, []);
  const imageContext = { params: Promise.resolve({ id: draft.id }) };
  globalThis.labelTestOwner = null;
  assert.equal((await image.GET(new Request(origin + draft.photo), imageContext)).status, 404);
  globalThis.labelTestOwner = { user: { id: "owner" } };
  assert.equal((await image.GET(new Request(origin + draft.photo), imageContext)).status, 200);

  const release = { kind: "release", name: "Uscita esempio", slug: "uscita-esempio", body: "Il testo dell’uscita.",
    type: "Singolo", date: "2026-11-07", artistSlug: draft.slug,
    spotify: "https://open.spotify.com/intl-it/track/0123456789012345678901?si=abc", published: true };
  assert.equal((await post(release)).status, 400, "A draft artist cannot be linked to a published release");
  const result = await post({ ...draft, published: true });
  assert.equal(result.status, 200, await result.clone().text());
  const artist = (await result.json()).entry;
  assert.equal((await post({ ...draft, published: true })).status, 409);
  assert.equal((await post({ ...artist, slug: "nuovo-slug" })).status, 400);
  assert.equal((await post({ ...release, spotify: "https://open.spotify.com/artist/0123456789012345678901" })).status, 400);
  const released = await post(release);
  assert.equal(released.status, 200, await released.clone().text());
  const publicResponse = await getFeed();
  assert.equal(publicResponse.headers.get("Access-Control-Allow-Origin"), "https://emmestudioproduction.it");
  const catalog = await publicResponse.json();
  assert.deepEqual(catalog.artists[0].bio, ["Prima parte.", "Seconda parte."]);
  assert.equal(catalog.releases[0].artistName, fixture.name);
  assert.equal(catalog.releases[0].body, release.body);
  assert.equal(catalog.releases[0].spotify, "https://open.spotify.com/track/0123456789012345678901");
  assert.ok(!("id" in catalog.artists[0]));
  globalThis.labelTestOwner = null;
  assert.equal((await image.GET(new Request(origin + artist.photo), imageContext)).status, 200);
  globalThis.labelTestOwner = { user: { id: "owner" } };
  assert.equal((await post({ ...artist, published: false })).status, 200);
  assert.deepEqual((await (await getFeed()).json()).artists, []);
  assert.equal((await (await getFeed()).json()).releases[0].artistName, fixture.name);
  const second = (await (await post({ ...release, name: "Seconda uscita", slug: "seconda", artistSlug: "", artistName: fixture.name })).json()).entry;
  const first = (await released.json()).entry;
  const change = (method, data) => admin[method](new Request(origin + "/api/label-catalog", {
    method, headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(data),
  }));
  assert.equal((await change("PATCH", { id: second.id, neighbor: first.id, direction: -1 })).status, 200);
  assert.deepEqual((await (await getFeed()).json()).releases.map(item => item.slug), ["seconda", release.slug]);
  assert.equal((await change("PATCH", { id: second.id, neighbor: first.id, direction: -1 })).status, 409);
  assert.equal((await change("DELETE", { id: artist.id, version: artist.version, confirm: true })).status, 409);
  assert.equal((await change("DELETE", { id: artist.id, version: artist.version + 1, confirm: true })).status, 200);
  const remaining = (await (await getFeed()).json()).releases.find(item => item.slug === release.slug);
  assert.equal(remaining.artistSlug, "");
  assert.equal(remaining.artistName, fixture.name);
  assert.equal((await change("DELETE", { id: second.id, version: second.version, confirm: true })).status, 200);
  assert.deepEqual((await (await getFeed()).json()).releases.map(item => item.slug), [release.slug]);
  const migration = await readFile("scripts/migrate-news.mjs", "utf8");
  const seedSql = migration.match(/WITH first_setup AS \([\s\S]+?DO NOTHING(?=`)/)[0];
  const seedArgs = [process.env.PORTAL_OWNER_EMAIL, await readFile("db/label-moody-seed.json", "utf8")];
  await db.query(seedSql, seedArgs);
  const moody = (await db.query("SELECT id,version FROM studio_label_catalog WHERE slug='moody'")).rows[0];
  assert.equal((await change("DELETE", { ...moody, confirm: true })).status, 200);
  await db.query(seedSql, seedArgs);
  assert.deepEqual((await (await getFeed()).json()).artists, [], "A deleted seed artist cannot reappear");
  const partnerFeed = () => partners.GET(new Request(origin + "/api/public/partners"));
  const collaboration = { kind: "partner", slug: "partner-prova", name: "Partner prova", tagline: "Formazione",
    body: "Laboratori di produzione musicale.", links: { Sito: "https://example.test" }, published: false };
  assert.equal((await post({ ...collaboration, body: "", published: true })).status, 400);
  const partner = (await (await post(collaboration)).json()).entry;
  assert.deepEqual((await (await partnerFeed()).json()).partners, []);
  const publishedPartner = (await (await post({ ...partner, published: true })).json()).entry;
  const secondPartner = (await (await post({ ...collaboration, slug: "partner-due", published: true })).json()).entry;
  assert.equal((await change("PATCH", { id: secondPartner.id, neighbor: partner.id, direction: -1 })).status, 200);
  assert.deepEqual((await (await partnerFeed()).json()).partners.map(item => item.slug), ["partner-due", partner.slug]);
  assert.deepEqual((await (await getFeed()).json()).artists, []);
  assert.equal((await change("DELETE", { id: partner.id, version: publishedPartner.version, confirm: true })).status, 200);
  assert.deepEqual((await (await partnerFeed()).json()).partners.map(item => item.slug), ["partner-due"]);
  console.log("PASS Label roster, release publication, draft image privacy, Spotify URL, version protection and public feed.");
} finally {
  await db.close();
  await rm(tmp, { recursive: true, force: true });
}
