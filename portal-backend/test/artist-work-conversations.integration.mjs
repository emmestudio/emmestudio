import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID as uuid} from 'node:crypto';
import assert from 'node:assert/strict';
const db=new PGlite(),tmp=await mkdtemp('/tmp/emme-work-chat-');
globalThis.chatDb={query:async(...args)=>{const q=await db.query(...args);return {...q,rowCount:q.rows.length}}};
globalThis.chatTeam={workspaceOwnerId:'studio',role:'editor'};
globalThis.chatArtist=null;
try{
 await build({stdin:{contents:`export * as team from '${resolve('app/api/artist-conversations/route.ts')}';export * as artist from '${resolve('app/api/artist-track-messages/route.ts')}';`,resolveDir:resolve('.')},outfile:join(tmp,'routes.mjs'),bundle:true,format:'esm',platform:'node',plugins:[{name:'mock',setup(b){
 b.onResolve({filter:/^@\/lib\/(db|workspace-session|artist-session|artist-notifications)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:({'db':'export const getDb=()=>globalThis.chatDb','workspace-session':'export const workspaceSession=async()=>globalThis.chatTeam','artist-session':'export const artistSession=async()=>globalThis.chatArtist','artist-notifications':'export const notifyArtistEvent=async()=>{}'})[a.path.split('/').at(-1)]}));
 }}]});
 const {team,artist}=await import(join(tmp,'routes.mjs'));
 await db.exec(`CREATE TABLE studio_artists(id uuid,owner_id text,name text,deleted_at timestamptz);
 CREATE TABLE studio_projects(id uuid,owner_id text,artist_id uuid,title text,deleted_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE studio_production(id uuid,owner_id text,artist_id uuid,project_id uuid,kind text,data jsonb,deleted_at timestamptz,created_at timestamptz DEFAULT now());
 CREATE TABLE studio_artist_previews(id uuid,owner_id text,artist_id uuid,track_id uuid,title text,version_label text,status text,updated_at timestamptz);`);
 for(const file of ['018-artist-track-messages.sql','019-artist-notifications.sql','020_artist_message_attachments.sql'])await db.exec(await readFile('migrations/'+file,'utf8'));
 const a=uuid(),b=uuid(),project=uuid();
 await db.query("INSERT INTO studio_artists VALUES($1,'studio','A',NULL),($2,'studio','B',NULL)",[a,b]);
 await db.query("INSERT INTO studio_projects(id,owner_id,artist_id,title) VALUES($1,'studio',$2,'Album')",[project,a]);
 const works=[project];
 for(const kind of ['recording','live','service','track']){
  const id=uuid();works.push(id);
  await db.query("INSERT INTO studio_production(id,owner_id,artist_id,project_id,kind,data) VALUES($1,'studio',NULL,$2,$3,$4)",[id,project,kind,{title:kind}]);
 }
 process.env.BETTER_AUTH_URL='https://portal.example';
 const req=(artistId,trackId)=>new Request('https://portal.example',{method:'POST',headers:{origin:'https://portal.example','content-type':'application/json'},body:JSON.stringify({artistId,trackId,body:'Messaggio'})});
 const list=await (await team.GET(new Request('https://portal.example?artistId='+a))).json();
 assert.equal(list.tracks.length,5);
 assert.equal((await team.POST(req(b,project))).status,403);
 for(const id of works)assert.equal((await team.POST(req(a,id))).status,201);
 globalThis.chatTeam=null;globalThis.chatArtist={ownerId:'studio',artistId:a};
 for(const id of works.slice(0,4))assert.equal((await artist.POST(req(b,id))).status,201);
 assert.equal((await artist.POST(req(a,works.at(-1)))).status,403,'Track still requires a published preview');
 globalThis.chatArtist.artistId=b;
 assert.equal((await artist.POST(req(a,project))).status,403);
 globalThis.chatArtist.artistId=a;
 await db.query('UPDATE studio_projects SET deleted_at=now() WHERE id=$1',[project]);
 assert.equal((await artist.POST(req(a,works[1]))).status,403);
 console.log('PASS artist work conversations: projects, recordings, live, services, track rules, artist isolation and trash.');
}finally{await db.close();await rm(tmp,{recursive:true,force:true});}
