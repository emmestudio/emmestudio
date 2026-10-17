import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import{join,resolve}from'node:path';
import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
const db=new PGlite(),scratch=await mkdtemp(join(tmpdir(),'emme-drive-'));
let locked=false,lockAvailable=true,calls=0,sequence=0,failAfterCreate=false,denied=false;
const remote=new Map(),created=[];
const query=async(q,v)=>{
 if(q.includes('pg_try_advisory_lock')){if(!lockAvailable||locked)return{rows:[{acquired:false}]};locked=true;return{rows:[{acquired:true}]}}
 if(q.includes('pg_advisory_unlock')){locked=false;return{rows:[]}}
 return db.query(q,v);
};
globalThis.driveDb={query,connect:async()=>({query,release(){}})};
globalThis.driveSession={user:{id:'owner',name:'Team'},workspaceOwnerId:'owner',role:'admin'};
globalThis.driveAuth={api:{getAccessToken:async({body})=>{assert.equal(body.userId,'owner');assert.equal(body.accountId,'google-owner');return{accessToken:'isolated-token'}}}};
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,init={})=>{
 calls++;assert.equal(init.headers.Authorization,'Bearer isolated-token');assert.ok(url.startsWith('https://www.googleapis.com/drive/v3/'));
 if(denied)return new Response('{}',{status:403});
 const u=new URL(url),path=u.pathname.replace('/drive/v3/','');
 if(path==='files/generateIds')return Response.json({ids:[`folder_${++sequence}`]});
 if(path==='files'&&init.method==='POST'){
  const b=JSON.parse(init.body);assert.equal(b.mimeType,'application/vnd.google-apps.folder');assert.ok(!remote.has(b.id),'No duplicate Drive create');
  created.push(b.id);remote.set(b.id,{...b,parents:b.parents??[],ownedByMe:true});
  if(failAfterCreate){failAfterCreate=false;throw Error('Connection lost after Google created folder')}
  return Response.json({id:b.id});
 }
 const id=path.slice('files/'.length),file=remote.get(id);
 if(!file)return new Response('{}',{status:404});
 if(init.method==='PATCH'){
  const b=JSON.parse(init.body);file.name=b.name;
  if(u.searchParams.has('addParents'))file.parents=[u.searchParams.get('addParents')];
 }
 return Response.json(file);
};
try{
 await build({stdin:{contents:`export * from '${resolve('lib/drive-archive.ts')}';export * from '${resolve('lib/drive-data.ts')}';export * from '${resolve('lib/artists.ts')}';export * from '${resolve('lib/artist-data.ts')}';export * from '${resolve('lib/production.ts')}';export * from '${resolve('lib/production-data.ts')}';export * from '${resolve('lib/workspace-export.ts')}';export * from '${resolve('lib/backup-data.ts')}';export {GET,POST} from '${resolve('app/api/drive/route.ts')}';export * as artistsApi from '${resolve('app/api/artists/route.ts')}';export * as productionApi from '${resolve('app/api/production/route.ts')}';`,resolveDir:resolve('.')},outfile:join(scratch,'svc.mjs'),bundle:true,platform:'node',format:'esm',tsconfig:'tsconfig.json',plugins:[{name:'isolated',setup(b){
 b.onResolve({filter:/^(server-only|\.\/db|\.\/auth|\.\/team|@\/lib\/workspace-session)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='./db'?'export const getDb=()=>globalThis.driveDb':a.path==='./auth'?'export const getAuth=()=>globalThis.driveAuth':a.path==='./team'?'export const resolveAssignee=async()=>null':a.path==='@/lib/workspace-session'?'export const workspaceSession=async()=>globalThis.driveSession':''}));
 }}]});
 const svc=await import(join(scratch,'svc.mjs'));
 await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('other');CREATE TABLE account(id text,"userId" text,"providerId" text,scope text);INSERT INTO account VALUES('google-owner','owner','google','${svc.driveScope}');`);
 const schemaFiles=['002-projects.sql','003-tasks.sql','004-members.sql','005-artists-finance.sql','006-production-finance.sql','007-workflow.sql','008-operations-trash.sql','009-direct-artist-production.sql','010-production-finance.sql','011-artist-personal-names.sql','012-drive-archive.sql'];
 for(const file of schemaFiles)await db.exec(await readFile('db/'+file,'utf8'));
 await db.exec(await readFile('db/012-drive-archive.sql','utf8'));
 const artist=randomUUID(),artist2=randomUUID(),live=randomUUID(),other=randomUUID();
 for(const [id,owner,name]of[[artist,'owner','Artista demo'],[artist2,'owner','Altro artista'],[other,'other','Privato']])await svc.saveArtist(owner,id,undefined,{...svc.emptyArtist(),name});
 const pending=await svc.autoSyncDrive('owner','artist',artist);assert.equal(pending.ready,false);assert.equal(calls,0);assert.equal((await svc.listArtists('owner')).length,2);
 await svc.configureDrive('owner');assert.equal(remote.size,2);
 failAfterCreate=true;await assert.rejects(()=>svc.syncDriveSubject('owner','artist',artist));
 const stored=(await svc.listDriveFolders('owner',`artist/${artist}`))[0];assert.equal(stored.state,'planned');assert.ok(remote.has(stored.id));
 await svc.syncDriveSubject('owner','artist',artist);assert.equal(remote.size,8);assert.equal(created.filter(x=>x===stored.id).length,1,'Ambiguous create recovers same ID');
 await svc.syncDriveSubject('owner','artist',artist);assert.equal(remote.size,8,'Retry is idempotent');
 await svc.saveArtist('owner',artist,1,{...svc.emptyArtist(),name:'Nuovo nome'});await svc.syncDriveSubject('owner','artist',artist);assert.equal(remote.get(stored.id).name,'Nuovo nome');
 const draft={...svc.emptyProduction('live'),artistId:artist,title:'Show demo',details:{venue:'Teatro',showDate:'2027-06-25'}};
 await svc.saveProduction('owner',live,undefined,draft,'Team');await svc.syncDriveSubject('owner','live',live);
 const folders=await svc.listDriveFolders('owner',`live/${live}`);assert.equal(folders.length,9);assert.ok(folders.every(f=>f.state==='ready'));
 const folderId=folders.find(f=>f.key===`live/${live}`).id;
 const firstParent=remote.get(folderId).parents[0];assert.ok(remote.has(firstParent));
 await svc.saveProduction('owner',live,1,{...draft,title:'Show aggiornato',artistId:artist2},'Team');await svc.syncDriveSubject('owner','live',live);assert.equal(remote.get(folderId).name,'Show aggiornato');assert.notEqual(remote.get(folderId).parents[0],firstParent,'Live moves to correct artist');
 assert.equal((await svc.listDriveFolders('other')).length,0);await assert.rejects(()=>svc.syncDriveSubject('owner','artist',other));
 const count=created.length;remote.get(folderId).trashed=true;await assert.rejects(()=>svc.syncDriveSubject('owner','live',live));assert.equal(created.length,count);remote.get(folderId).trashed=false;await svc.syncDriveSubject('owner','live',live);
 const removed=remote.get(folderId);remote.delete(folderId);await assert.rejects(()=>svc.syncDriveSubject('owner','live',live));await assert.rejects(()=>svc.syncDriveSubject('owner','live',live));assert.equal(created.length,count,'Confirmed deleted folder is never recreated');remote.set(folderId,removed);await svc.syncDriveSubject('owner','live',live);
 lockAvailable=false;await assert.rejects(()=>svc.syncDriveSubject('owner','artist',artist));lockAvailable=true;
 denied=true;await assert.rejects(()=>svc.syncDriveSubject('owner','artist',artist));denied=false;
 await db.query('UPDATE account SET scope=\'openid email\'');assert.equal((await svc.autoSyncDrive('owner','artist',artist)).ready,false);await db.query('UPDATE account SET scope=$1',[svc.driveScope]);
 process.env.BETTER_AUTH_URL='https://portal.example';
 const request=(body,origin='https://portal.example')=>new Request('https://portal.example/api/drive',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await svc.POST(request({action:'sync',kind:'artist',id:artist},'https://evil.example'))).status,403);
 globalThis.driveSession=null;assert.equal((await svc.GET(new Request('https://portal.example/api/drive'))).status,401);
 globalThis.driveSession={user:{id:'viewer'},workspaceOwnerId:'owner',role:'viewer'};assert.equal((await svc.POST(request({action:'sync',kind:'artist',id:artist}))).status,403);assert.equal((await svc.GET(new Request(`https://portal.example/api/drive?kind=artist&id=${artist}`))).status,200);
 globalThis.driveSession={user:{id:'editor'},workspaceOwnerId:'owner',role:'editor'};assert.equal((await svc.POST(request({action:'configure'}))).status,403);assert.equal((await svc.GET(new Request('https://portal.example/api/drive'))).status,403);
 assert.equal((await svc.POST(request({action:'sync',kind:'artist',id:other}))).status,404);
 assert.equal((await svc.POST(request({action:'sync',kind:'artist',id:'invalid'}))).status,400);
 globalThis.driveSession={user:{id:'owner'},workspaceOwnerId:'owner',role:'admin'};
 const result=await svc.GET(new Request(`https://portal.example/api/drive?kind=live&id=${live}`));const data=await result.json();assert.equal(data.folders.length,9);assert.ok(!JSON.stringify(data).includes('isolated-token'));
 const routeArtist=randomUUID();
 const artistRequest=new Request('https://portal.example/api/artists',{method:'POST',headers:{Origin:'https://portal.example','Content-Type':'application/json'},body:JSON.stringify({id:routeArtist,draft:{...svc.emptyArtist(),name:'Artista dal portale'}})});
 assert.equal((await svc.artistsApi.POST(artistRequest)).status,200);assert.equal((await svc.listDriveFolders('owner',`artist/${routeArtist}`)).length,6,'Artist API automatically creates folders');
 const routeLive=randomUUID();
 denied=true;
 const liveRequest=new Request('https://portal.example/api/production',{method:'POST',headers:{Origin:'https://portal.example','Content-Type':'application/json'},body:JSON.stringify({id:routeLive,draft:{...svc.emptyProduction('live'),artistId:routeArtist,title:'Live con Drive momentaneamente non disponibile'}})});
 const saved=await svc.productionApi.POST(liveRequest);assert.equal(saved.status,200);assert.equal((await saved.json()).drive.ready,false);assert.ok((await svc.listProduction('owner')).some(p=>p.id===routeLive),'Google failure preserves saved live');denied=false;await svc.syncDriveSubject('owner','live',routeLive);
 const exported=await svc.exportWorkspace('owner');assert.equal(exported.version,5);assert.ok(exported.data.studio_drive_folders.length>0);
 const restored=new PGlite();try{
 await restored.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('restored');`);
 for(const file of schemaFiles)await restored.exec(await readFile('db/'+file,'utf8'));
 await svc.restoreBusinessExport({query:(q,v)=>restored.query(q,v)},'restored',exported);
 assert.equal((await restored.query("SELECT * FROM studio_drive_folders WHERE owner_id='restored'")).rows.length,exported.data.studio_drive_folders.length,'Restore preserves folder references');
 }finally{await restored.close()}
 await db.query('UPDATE studio_production SET deleted_at=now() WHERE id=$1',[live]);await assert.rejects(()=>svc.syncDriveSubject('owner','live',live));assert.ok(remote.has(folderId),'Portal trash preserves Drive files');
 console.log('PASS: artist/live folder trees, retry after ambiguous create, no duplicates, rename, artist reassignment, scope/role/origin/tenant guards, trash/deletion safety and Drive IDs included in export. No real Google calls.');
}finally{globalThis.fetch=originalFetch;await db.close();await rm(scratch,{recursive:true,force:true});}
