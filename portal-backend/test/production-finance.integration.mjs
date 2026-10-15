import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const db=new PGlite(),scratch=await mkdtemp(join(tmpdir(),'emme-direct-'));
globalThis.directDb={connect:async()=>({query:(q,v)=>db.query(q,v),release(){}}),query:(q,v)=>db.query(q,v)};
try {
await build({stdin:{contents:`export * from '${resolve('lib/production.ts')}';export * from '${resolve('lib/production-data.ts')}';export * from '${resolve('lib/operations.ts')}';export * from '${resolve('lib/finance.ts')}';export * from '${resolve('lib/finance-data.ts')}';export * from '${resolve('lib/finance-targets.ts')}';export * from '${resolve('lib/workspace-export.ts')}';export * from '${resolve('lib/backup-data.ts')}';export {default as quotePage} from '${resolve('app/preventivi/[id]/page.tsx')}';export * as productionApi from '${resolve('app/api/production/route.ts')}';`,resolveDir:resolve('.')},outfile:join(scratch,'svc.mjs'),bundle:true,platform:'node',format:'esm',jsx:'automatic',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/^(server-only|\.\/db|\.\/team|@\/lib\/workspace-session|next\/(?:headers|navigation|link))$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='@/lib/workspace-session'?'export const workspaceSession=async()=>globalThis.financeSession':a.path==='next/headers'?'export const headers=async()=>new Headers()':a.path==='next/navigation'?'export const redirect=(p)=>{throw Error(p)};export const notFound=()=>{throw Error("NOT_FOUND")}':a.path==='next/link'?'export default function Link(){return null}':a.path==='./db'?'export const getDb=()=>globalThis.directDb':a.path==='./team'?'export const resolveAssignee=async()=>null':'',loader:'js'}));}}]});
const svc=await import(join(scratch,'svc.mjs'));
await db.exec('CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES(\'owner\'),(\'other\');');
for(const f of ['002-projects.sql','003-tasks.sql','004-members.sql','005-artists-finance.sql','006-production-finance.sql','007-workflow.sql','008-operations-trash.sql'])await db.exec(await readFile('db/'+f,'utf8'));
const artist=randomUUID(),otherArtist=randomUUID(),foreignArtist=randomUUID(),project=randomUUID(),legacy=randomUUID();
for(const [id,owner]of [[artist,'owner'],[otherArtist,'owner'],[foreignArtist,'other']])await db.query("INSERT INTO studio_artists(id,owner_id,name) VALUES($1,$2,'Artista')",[id,owner]);
await db.query("INSERT INTO studio_projects(id,owner_id,title,artist,artist_id,kind,status,request_digest) VALUES($1,'owner','Album','Artista',$2,'Album','In produzione','x')",[project,artist]);
const legacyDraft={...svc.emptyProduction('track',project),title:'Esistente'};
await db.query("INSERT INTO studio_production(id,owner_id,project_id,kind,data,request_digest) VALUES($1,'owner',$2,'track',$3,'x')",[legacy,project,JSON.stringify(legacyDraft)]);
await db.exec(await readFile('db/009-direct-artist-production.sql','utf8'));
await db.exec(await readFile('db/010-production-finance.sql','utf8'));
await db.exec(await readFile('db/011-artist-personal-names.sql','utf8'));
await db.exec(await readFile('db/009-direct-artist-production.sql','utf8'));
await db.exec(await readFile('db/010-production-finance.sql','utf8'));
await db.exec(await readFile('db/011-artist-personal-names.sql','utf8'));
assert.equal((await svc.listProduction('owner')).find(i=>i.id===legacy).artistId,artist);

const quote={amount:40000,status:'Confermato',notes:'Condizioni demo',items:[{description:'Lavoro',quantity:100,unitPrice:40000}]};
const make=(kind,title,details={})=>svc.validateProduction({...svc.emptyProduction(kind),artistId:artist,title,details});
const ids={track:randomUUID(),recording:randomUUID(),live:randomUUID(),service:randomUUID()};
for(const kind of Object.keys(ids)){
 const d=make(kind,kind,kind==='recording'?{phase:'Mix'}:kind==='service'?{service:'Altro',serviceOther:'Consulenza suono'}:{});
 await svc.saveProduction('owner',ids[kind],undefined,d,'test',{quote,quoteVersion:0});
}
globalThis.financeSession={workspaceOwnerId:'owner',role:'admin',user:{name:'Test'}};
const paper=JSON.stringify(await svc.quotePage({params:Promise.resolve({id:ids.service})}));
assert.ok(paper.includes('Consulenza suono'));assert.ok(paper.includes('400,00'));
process.env.BETTER_AUTH_URL='https://studio.example.test';
for(const role of ['viewer','editor']){
 globalThis.financeSession.role=role;
 const response=await svc.productionApi.POST(new Request('https://studio.example.test/api/production',{method:'POST',headers:{origin:'https://studio.example.test','Content-Type':'application/json'},body:JSON.stringify({id:randomUUID(),draft:make('track','Non autorizzato'),quote,quoteVersion:0})}));
 assert.equal(response.status,403,role+' must not write prices');
}
globalThis.financeSession.role='admin';
let ledger=await svc.listLedger('owner');assert.equal(ledger.quotes.length,4);assert.equal(ledger.quotes.reduce((s,q)=>s+q.amount,0),160000);
const t=ids.track;
await svc.saveMovement('owner',{id:randomUUID(),projectId:t,quoteVersion:1,action:'payment',amount:10000,date:'2026-10-14',label:'Acconto',method:'Bonifico',notes:''});
await svc.saveMovement('owner',{id:randomUUID(),projectId:t,quoteVersion:2,action:'due',amount:20000,date:'2026-10-14',label:'Rata',notes:''});
ledger=await svc.listLedger('owner');
let balance=svc.projectBalance(t,ledger,'2026-10-16');assert.equal(balance.received,10000);assert.equal(balance.outstanding,30000);assert.equal(balance.overdue,10000);
const original=make('track','track');
await assert.rejects(svc.saveProduction('owner',t,1,{...original,title:'Non deve salvarsi'},'test',{quote:{amount:5000,status:'Confermato',notes:'',items:[]},quoteVersion:3}),/inferiore/);
assert.equal((await svc.listProduction('owner')).find(i=>i.id===t).title,'track');
await assert.rejects(svc.saveProduction('owner',t,1,original,'test',{quote,quoteVersion:1}),/cambiato/);
await assert.rejects(svc.saveMovement('other',{id:randomUUID(),projectId:t,quoteVersion:3,action:'payment'}),/disponibile/);
const targets=await svc.listFinanceTargets('owner');assert.equal(targets.find(i=>i.id===ids.service).service,'Consulenza suono');assert.equal(targets.find(i=>i.id===ids.recording).subjectKind,'production');
assert.throws(()=>make('service','Vuoto',{service:'Altro',serviceOther:''}),/Specifica/);
assert.throws(()=>make('service','Non valido',{service:'Sconosciuto'}),/tipo/);
assert.equal(make('service','Reamp',{service:'Reamp',serviceOther:'ignored'}).details.serviceOther,'');
// Existing project quoting still works, with unchanged schema fields and history.
const c=await globalThis.directDb.connect();await c.query('BEGIN');await svc.writeQuote(c,'owner',project,{amount:9000,status:'Bozza',notes:'Esistente'},0);await c.query('COMMIT');
assert.equal((await svc.listLedger('owner')).quotes.find(q=>q.projectId===project).amount,9000);
// Verify the new finance references survive export and isolated local restoration.
const exported=await svc.exportWorkspace('owner');assert.equal(exported.version,3);
const restored=new PGlite();try{
 await restored.exec('CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES(\'restored-owner\');');
 for(const f of ['002-projects.sql','003-tasks.sql','004-members.sql','005-artists-finance.sql','006-production-finance.sql','007-workflow.sql','008-operations-trash.sql','009-direct-artist-production.sql','010-production-finance.sql','011-artist-personal-names.sql'])await restored.exec(await readFile('db/'+f,'utf8'));
 await svc.restoreBusinessExport({query:(q,v)=>restored.query(q,v)},'restored-owner',exported);
 assert.equal((await restored.query('SELECT count(*) AS n FROM studio_quotes')).rows[0].n,5);
 assert.equal((await restored.query('SELECT sum(amount) AS n FROM studio_payments')).rows[0].n,10000);
}finally{await restored.close();}
// Parent project purge removes child finance, while standalone subjects survive.
await svc.saveProduction('owner',ids.service,1,{...make('service','service',{service:'Altro',serviceOther:'Consulenza suono'}),projectId:project},'test');
await svc.trashResource('owner','project',project,1,false,'Album','test');await svc.purgeProject('owner',project,2,'Album');
ledger=await svc.listLedger('owner');assert.ok(!ledger.quotes.some(q=>[project,ids.service].includes(q.projectId)));assert.ok(ledger.quotes.some(q=>q.projectId===t));
assert.equal((await db.query('SELECT count(*) AS n FROM studio_projects')).rows[0].n,0);
console.log('PASS: all four production quotes, ledger totals, payments/dues, atomic rollback, stale quotes, isolation, service enum/Other, project compatibility and purge.');
}finally{await db.close();await rm(scratch,{recursive:true,force:true});}
