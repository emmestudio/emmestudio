import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";

const tmp = await mkdtemp(join(tmpdir(), "emme-preview-"));
const db = new PGlite();
globalThis.previewDb = { query: (sql, values) => db.query(sql, values) };
globalThis.previewStudio = { role: "admin", workspaceOwnerId: "owner" };
globalThis.previewArtist = null;
process.env.BETTER_AUTH_URL = "https://portal.example";
const id = crypto.randomUUID(), artist = crypto.randomUUID(), track = crypto.randomUUID();
const originalFetch = globalThis.fetch;
try {
  await db.exec(await readFile("migrations/013-artist-previews.sql", "utf8"));
  await db.exec(`ALTER TABLE studio_artist_previews ADD COLUMN purged_at timestamptz;
    CREATE TABLE studio_production(id uuid,owner_id text,artist_id uuid,project_id uuid,kind text,deleted_at timestamptz);
    CREATE TABLE studio_projects(id uuid,owner_id text,artist_id uuid,deleted_at timestamptz);
    CREATE TABLE studio_artists(id uuid,owner_id text,deleted_at timestamptz);`);
  await db.query("INSERT INTO studio_artists(id,owner_id) VALUES($1,'owner')", [artist]);
  await db.query("INSERT INTO studio_production(id,owner_id,artist_id,kind) VALUES($1,'owner',$2,'track')", [track,artist]);
  await db.query(`INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status)
    VALUES($1,'owner',$2,$3,'Vecchio nome','fixture-file','Mix v01','draft')`,[id,artist,track]);
  await build({
    stdin: { contents: `export * as audio from '${resolve("app/api/artist-audio/[id]/route.ts")}';
      export * as previews from '${resolve("app/api/artist-previews/route.ts")}';`, resolveDir: resolve(".") },
    outfile: join(tmp,"routes.mjs"), bundle: true, platform: "node", format: "esm",
    plugins: [{name:"mock",setup(b){
      b.onResolve({filter:/^@\/lib\/(workspace-session|artist-session|db|auth|drive-archive|artist-notifications)$/},a=>({path:a.path,namespace:"mock"}));
      b.onLoad({filter:/.*/,namespace:"mock"},({path})=>({contents:
        path.endsWith("/workspace-session")?"export const workspaceSession=async()=>globalThis.previewStudio":
        path.endsWith("/artist-session")?"export const artistSession=async()=>globalThis.previewArtist":
        path.endsWith("/db")?"export const getDb=()=>globalThis.previewDb":
        path.endsWith("/auth")?"export const getAuth=()=>({api:{getAccessToken:async()=>({accessToken:'fixture'})}})":
        path.endsWith("/drive-archive")?"export const drivePermission=async()=>({account:{id:'account'},granted:true})":
        "export const notifyArtistEvent=async()=>{throw Error('Rename must not notify')}"
      }));
    }}],
  });
  const {audio,previews}=await import(join(tmp,"routes.mjs"));
  let calls=0;
  globalThis.fetch=async url=>{
    calls++;
    return url.includes("alt=media")?new Response("audio",{status:206,headers:{"content-range":"bytes 0-4/5"}}):
      Response.json({mimeType:"audio/mpeg",size:"5"});
  };
  const play=()=>audio.GET(new Request("https://portal.example/api/artist-audio/"+id),{params:Promise.resolve({id})});
  const rename=(title,previousTitle="Vecchio nome",origin="https://portal.example")=>previews.PATCH(
    new Request("https://portal.example/api/artist-previews",{method:"PATCH",headers:{origin,"Content-Type":"application/json"},
      body:JSON.stringify({id,action:"rename",title,previousTitle})}));
  assert.equal((await play()).status,206,"Admin can listen to draft");
  assert.equal((await rename("Nuovo nome")).status,200);
  let row=(await db.query("SELECT * FROM studio_artist_previews WHERE id=$1",[id])).rows[0];
  assert.equal(row.title,"Nuovo nome");assert.equal(row.status,"draft");assert.equal(row.version_label,"Mix v01");
  assert.equal(row.drive_file_id,"fixture-file");
  assert.equal((await rename("Stale name")).status,409);
  assert.equal((await rename("","Nuovo nome")).status,400);
  assert.equal((await rename("Invalid origin","Nuovo nome","https://evil.example")).status,403);
  globalThis.previewStudio={role:"viewer",workspaceOwnerId:"owner"};
  assert.equal((await play()).status,403);assert.equal((await rename("Denied")).status,403);
  globalThis.previewStudio={role:"admin",workspaceOwnerId:"foreign"};
  assert.equal((await play()).status,404);assert.equal((await rename("Denied")).status,409);
  globalThis.previewStudio=null;globalThis.previewArtist={ownerId:"owner",artistId:artist};
  assert.equal((await play()).status,404,"Artist cannot hear a draft");
  await db.query("UPDATE studio_artist_previews SET status='ready' WHERE id=$1",[id]);
  assert.equal((await play()).status,206);
  globalThis.previewArtist={ownerId:"owner",artistId:crypto.randomUUID()};
  assert.equal((await play()).status,404,"Artist isolation");
  globalThis.previewArtist=null;assert.equal((await play()).status,401);
  globalThis.previewStudio={role:"admin",workspaceOwnerId:"owner"};
  await db.query("UPDATE studio_artist_previews SET purged_at=now() WHERE id=$1",[id]);
  const before=calls;
  assert.equal((await play()).status,404);
  assert.equal(calls,before,"Purged material never reaches Drive");
  assert.equal((await rename("Denied","Nuovo nome")).status,409);
  console.log("PASS admin MP3 playback, artist visibility, isolation, rename conflict and immutable file/version.");
} finally {
  globalThis.fetch=originalFetch;
  await db.close();await rm(tmp,{recursive:true,force:true});
}
