import {PGlite} from '@electric-sql/pglite';import {build} from 'esbuild';import {readFile,mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const db=new PGlite(),temp=await mkdtemp(join(tmpdir(),'emme-forms-'));
globalThis.formsDb={query:(q,v)=>db.query(q,v),connect:async()=>({query:(q,v)=>db.query(q,v),release(){}})};globalThis.formsSession={user:{id:'owner'}};
process.env.BETTER_AUTH_URL='https://portal.example.test';process.env.STUDIO_CONTRACT_PROVIDER=JSON.stringify({name:'Provider fixture',taxCode:'FIXTURE-CODE',address:'Private fixture address',email:'fixture@example.test'});
try{await db.exec(`CREATE TABLE "user"(id text PRIMARY KEY);INSERT INTO "user" VALUES('owner'),('other');CREATE TABLE studio_artists(id uuid PRIMARY KEY,owner_id text,name text,first_name text,last_name text,email text,phone text,deleted_at timestamptz);CREATE TABLE studio_quotes(project_id uuid PRIMARY KEY,owner_id text,version integer,status text DEFAULT 'Bozza',amount integer DEFAULT 0,notes text DEFAULT '',items jsonb DEFAULT '[]'::jsonb);`);await db.exec(await readFile('db/019-form-documents.sql','utf8'));await db.exec(await readFile('db/019-form-documents.sql','utf8'));await db.exec(await readFile('db/020-more-form-templates.sql','utf8'));await db.exec(await readFile('db/020-more-form-templates.sql','utf8'));await db.exec(await readFile('db/021-label-contract-forms.sql','utf8'));await db.exec(await readFile('db/021-label-contract-forms.sql','utf8'));
 await build({stdin:{contents:`export * as sharing from '${resolve('app/api/forms/share/route.ts')}';export * as uploadToken from '${resolve('app/api/artist-documents/[id]/upload/route.ts')}';export * as returned from '${resolve('app/api/artist-documents/[id]/route.ts')}';export * as tracker from '${resolve('app/api/forms/artist-tracker/route.ts')}';export * from '${resolve('lib/artist-document-rules.ts')}';export * as api from '${resolve('app/api/forms/route.ts')}';export * from '${resolve('lib/service-agreement-data.ts')}';export * from '${resolve('lib/form-templates.ts')}';export * from '${resolve('lib/form-plan.ts')}';export {default as Paper} from '${resolve('app/modulistica/general-paper.tsx')}';export {renderToStaticMarkup} from 'react-dom/server';`,resolveDir:resolve('.')},outfile:join(temp,'svc.mjs'),bundle:true,platform:'node',format:'esm',jsx:'automatic',banner:{js:"import {createRequire as createFormsRequire} from 'node:module';const require=createFormsRequire(import.meta.url);"},plugins:[{name:'isolate',setup(b){b.onResolve({filter:/^(server-only|@vercel\/blob(?:\/client)?|\.\/(db|artist-gmail)|@\/lib\/(artist-session|owner-session|db|finance-targets|finance))$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='server-only'?'':a.path==='@vercel/blob'?'export const get=(...args)=>globalThis.signedBlob.get(...args);export const del=(...args)=>globalThis.signedBlob.del(...args)':a.path==='@vercel/blob/client'?'export const handleUpload=opts=>opts.onBeforeGenerateToken(opts.body.pathname)':a.path==='./artist-gmail'?'export const sendArtistGmail=async (...args)=>{globalThis.formMail.push(args);return {sent:true}}':a.path.endsWith('/artist-session')?'export const artistSession=async()=>globalThis.artistFormsSession':a.path.endsWith('/owner-session')?'export const ownerSession=async()=>globalThis.formsSession':a.path.endsWith('/finance-targets')?'export const listFinanceTargets=async()=>globalThis.formTargets||[]':a.path.endsWith('/finance')?'export const listLedger=async()=>globalThis.formLedger||({quotes:[]})':'export const getDb=()=>globalThis.formsDb'}));}}]});
 await db.exec(await readFile('db/024-complete-form-catalog.sql','utf8'));
 await db.exec(await readFile('db/025-artist-document-tracker.sql','utf8'));
 await db.exec(await readFile('migrations/014-artist-access.sql','utf8'));
 await db.exec(await readFile('migrations/019-artist-notifications.sql','utf8'));
 const consolidated=await readFile('migrations/025-portal-consolidation.sql','utf8');
 await db.exec(consolidated.match(/CREATE TABLE IF NOT EXISTS studio_artist_email_outbox \([\s\S]*?\n\);/)[0]);
 for(let i=0;i<2;i++)await db.exec(await readFile('db/026-artist-form-sharing.sql','utf8'));
 for(let i=0;i<2;i++)await db.exec(await readFile('db/027-signed-document-blob.sql','utf8'));
 const svc=await import(join(temp,'svc.mjs'));const id=crypto.randomUUID();const request=(body,origin='https://portal.example.test')=>new Request('https://portal.example.test/api/forms',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id,version:0,state:'draft',draft:svc.emptyServiceAgreement(),...body})});
 globalThis.formsSession=null;assert.equal((await svc.api.GET(new Request('https://portal.example.test/api/forms'))).status,401);assert.equal((await svc.api.POST(request({}))).status,401);globalThis.formsSession={user:{id:'owner'}};
 assert.equal((await svc.api.POST(request({},'https://evil.example'))).status,403);assert.equal((await svc.api.POST(request({state:'ready'}))).status,400);
 assert.equal((await svc.api.POST(request({provider:{name:'Forged provider'}}))).status,200);let row=(await db.query('SELECT * FROM studio_form_documents WHERE id=$1',[id])).rows[0];assert.equal(row.payload.provider.name,'Provider fixture');assert.equal(row.version,1);assert.equal(row.payload.clauses.length,8);const original=JSON.stringify(row.payload);
 const ready={...svc.emptyServiceAgreement(),date:'2026-10-30',place:'Studio',clientName:'Client fixture',clientTaxCode:'CLIENT-FIXTURE',clientAddress:'Client address',clientEmail:'client@example.test',services:['Mix'],scope:'Mix of a song',wavFormat:'48 kHz / 24 bit',delivery:'Link concordato',amount:'200 EUR',deposit:'50 EUR alla firma',balance:'150 EUR prima della consegna',paymentMethod:'Bonifico',extraRevision:'Da preventivare',masterTerms:'Termini del master da accordo allegato'};
 const saved=await svc.api.POST(request({version:1,state:'ready',draft:ready}));assert.equal(saved.status,200,await saved.text());row=(await db.query('SELECT * FROM studio_form_documents WHERE id=$1',[id])).rows[0];assert.equal(row.state,'ready');assert.equal(row.version,2);assert.equal(JSON.stringify((await db.query('SELECT payload FROM studio_form_history WHERE document_id=$1 AND version=1',[id])).rows[0].payload),original,'Earlier snapshots never change');
 assert.equal((await svc.api.POST(request({version:1,draft:ready}))).status,409);assert.equal((await svc.api.POST(request({version:2,draft:{...ready,services:['Invalid']}}))).status,400);
 assert.equal((await svc.api.POST(request({version:2,state:'ready',draft:{...ready,clientType:'minor'}}))).status,400);assert.equal((await svc.api.POST(request({version:2,state:'ready',draft:{...ready,clientType:'minor',representative:'Guardian',representativeRole:'Genitore',representativeTaxCode:'GUARDIAN',guardianAuthority:'Responsabilità genitoriale e firme da verificare'}}))).status,200);
 const foreign=crypto.randomUUID();await db.query('INSERT INTO studio_quotes(project_id,owner_id,version) VALUES($1,$2,1)',[foreign,'other']);assert.equal((await svc.api.POST(request({version:3,draft:{...ready,quoteId:foreign,quoteVersion:1}}))).status,409);assert.equal((await db.query('SELECT version FROM studio_form_documents WHERE id=$1',[id])).rows[0].version,3);
 for(const template of svc.formTemplates){
  const draft=svc.emptyGeneralForm(template);const documentId=crypto.randomUUID();const post=(state,version=0,body=draft)=>svc.api.POST(request({id:documentId,template:template.id,version,state,draft:body}));
  assert.equal((await post('draft')).status,200,'Can save an incomplete '+template.id);assert.equal((await post('ready',1)).status,400,'Incomplete data cannot become ready');
  draft.date='2026-10-30';draft.place='Studio';for(const f of template.fields)draft.fields[f.key]=f.type==='select'?f.options[0]:f.type==='date'?'2026-11-20':f.type==='email'?'test@example.test':f.required?'Fixture '+f.key:'';
  draft.rows=Array.from({length:Math.max(1,template.minRows)},()=>Object.fromEntries(template.columns.map(f=>[f.key,f.type==='select'?f.options[0]:f.type==='date'?'2026-11-20':f.type==='email'?'test@example.test':f.required?'Fixture '+f.key:''])));
  if(['master-ownership-v1','coproduction-v1'].includes(template.id)){
   draft.rows[0].share='100';assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],share:'99'}]},true),/100%/);
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],share:'50'},{...draft.rows[0],share:'50'}]},true),/più volte/);
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],capacity:'Minorenne rappresentato',representative:''}]},true),/rappresentante/);
  }
  if(template.id==='work-suspension-v1'){
   Object.assign(draft.fields,{workDue:'100',approvedCosts:'20',paidAmount:'150',balanceDue:'0',refundDue:'30',restartTerms:'Restart after agreed materials, by defined date'});
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,refundDue:'29'}},true),/saldo/);
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,restartTerms:''}},true),/ripresa/);
  }
  if(['digital-distribution-v1','beat-license-v1','synchronisation-license-v1','live-recording-license-v1'].includes(template.id)){
   assert.throws(()=>svc.validateGeneralForm(template,draft,true),/diritti/);draft.fields.rightsCheck='Autorizzazioni verificate e documentate';
  }
  if(template.id==='release-approval-v1'){
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,outcome:'Approvata per i materiali e le condizioni indicati'}},true),/integrale/);
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,outcome:'Approvata con riserve',reservations:''}},true),/riserve/);
   assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,outcome:'Approvata per i materiali e le condizioni indicati',rightsCheck:'Autorizzazioni verificate e documentate'},rows:draft.rows.map(r=>({...r,decision:'Approvato'}))},true));
  }
  if(template.id==='artist-statement-v1'){
   Object.assign(draft.fields,{grossTotal:'100',deductionTotal:'10',netTotal:'90',recoveredCosts:'10',share:'50',openingBalance:'0',entitlement:'40',paidAmount:'10',closingBalance:'30',periodStart:'2026-01-01',periodEnd:'2026-03-31'});draft.rows=[{description:'Example income',gross:'100',deduction:'10',net:'90'}];
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],net:'91'}]},true),/netto/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,grossTotal:'101'}},true),/totali/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,entitlement:'39'}},true),/quota/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,closingBalance:'31'}},true),/saldo/);
  }
  if(template.id==='privacy-notice-v1'){
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,dataSource:'Dati raccolti anche da terzi',indirectSources:''}},true),/fonti/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,transfers:'Presenti e descritti con garanzie applicabili',transferSafeguards:''}},true),/trasferimenti/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,automation:'Presenti e descritte',automationDetails:''}},true),/decisioni/);
  }
  if(template.id==='minor-documentation-v1'){
   Object.assign(draft.fields,{birthDate:'2012-01-01',secondRepresentative:'Guardian two',secondRepresentativeTaxCode:'GUARDIAN2',authorisationReview:'Autorizzazioni ulteriori necessarie e acquisite'});
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,birthDate:'2000-01-01'}},true),/minorenne/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,secondRepresentative:''}},true),/entrambi/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,guardianMode:'Unico soggetto legittimato documentato',guardianEvidence:''}},true),/legittimazione/);
  }
  if(template.id==='live-collaborator-v1'){assert.throws(()=>svc.validateGeneralForm(template,draft,true),/adempimenti/);draft.fields.engagementCheck='Inquadramento e adempimenti individuati per la prestazione';}
  if(template.id==='show-technical-sheet-v1'){draft.rows[0].channel='1';assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[draft.rows[0],draft.rows[0]]},true),/duplicati/);}
  if(template.id==='artist-development-continuity-v1'){
   assert.equal(svc.emptyGeneralForm(template).fields.academyRepresentative,'Martina Giordano');assert.equal(svc.emptyGeneralForm(template).fields.academyEntity,'','Never assume the legal entity from a representative name');
   draft.rows=[];draft.fields.noticeDays='5';draft.fields.tailEnd='';draft.fields.guardianMode='';
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,academyEntity:''}},true),/gestore/);
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,noticeDays:'0'}},true),/termine/);
   const opportunity={title:'Example opportunity',kind:'Accordo discografico',date:'2026-10-20',reference:'Introduced contact fixture',contribution:'Introduction fixture',confirmation:'Written confirmation fixture'};
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[opportunity]},true),/registro/);
   const registered={...draft,rows:[opportunity],fields:{...draft.fields,opportunityRegister:'Opportunità già individuate nelle righe allegate'}};assert.doesNotThrow(()=>svc.validateGeneralForm(template,registered,true));
   assert.throws(()=>svc.validateGeneralForm(template,{...registered,rows:[]},true),/opportunità/);assert.throws(()=>svc.validateGeneralForm(template,{...registered,rows:[{...opportunity,date:'2026-12-01'}]},true),/data/);
   const tail={...draft,fields:{...draft.fields,tailMode:'Solo opportunità specificamente identificate prima della fine, entro il termine indicato'}};
   assert.throws(()=>svc.validateGeneralForm(template,tail,true),/termine/);tail.fields.tailEnd='2027-01-31';tail.fields.tailRules='Only registered opportunities';assert.doesNotThrow(()=>svc.validateGeneralForm(template,tail,true));
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,academyType:'Persona fisica che gestisce l’Accademia',academyTaxCode:'ONE',academyRepresentativeTaxCode:'TWO'}},true),/identificativi/);
   assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,academyType:'Persona fisica che gestisce l’Accademia',academyTaxCode:'SAME',academyRepresentativeTaxCode:'SAME'}},true));
   assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,capacity:'Minorenne rappresentato',representative:'Guardian',representativeTaxCode:'GUARDIAN',authority:'Documented',guardianMode:'Entrambi i genitori / esercenti',minorChecks:'References checked'}},true),/entrambi/);
   const minor={...draft,fields:{...draft.fields,capacity:'Minorenne rappresentato',representative:'Guardian',representativeTaxCode:'GUARDIAN',authority:'Documented',guardianMode:'Unico soggetto legittimato documentato',minorChecks:'References checked'}};
   assert.throws(()=>svc.validateGeneralForm(template,minor,true),/legittimazione/);minor.fields.guardianEvidence='Sole authority documentation';assert.doesNotThrow(()=>svc.validateGeneralForm(template,minor,true));
  }
  if(template.id==='quote-acceptance-v1'){
   draft.rows=[];assert.throws(()=>svc.validateGeneralForm(template,draft,true),/Importa/);
   const quoteId=crypto.randomUUID();globalThis.formTargets=[{id:quoteId,title:'Mix fixture',artist:'Artist fixture',service:'Mix',deletedAt:null}];
   await db.query('INSERT INTO studio_quotes(project_id,owner_id,version,amount,notes,items) VALUES($1,$2,1,20000,$3,$4::jsonb)',[quoteId,'owner','Original terms',JSON.stringify([{description:'Mix',quantity:100,unitPrice:20000}])]);
   globalThis.formLedger={quotes:[{projectId:quoteId,version:1,status:'Bozza',amount:20000,notes:'Original terms',items:[{description:'Mix',quantity:100,unitPrice:20000}]}]};const imported=await svc.api.GET(new Request('https://portal.example.test/api/forms?quote='+quoteId));assert.equal(imported.status,200);assert.equal((await imported.json()).quote.amount,20000);assert.equal((await svc.api.GET(new Request('https://portal.example.test/api/forms?quote='+foreign))).status,404);draft.quoteId=quoteId;draft.quoteVersion=1;draft.quoteSnapshot={amount:1,notes:'FORGED'};
  }
  if(template.authorization){assert.throws(()=>svc.validateGeneralForm(template,draft,true));draft.fields.privacyDelivery='Consegnata e identificata';}
  if(template.id==='portfolio-authorization-v1'){draft.fields.rightsCheck='Diritti e autorizzazioni verificati e documentati';}
  if(template.id==='session-musician-v1'){assert.throws(()=>svc.validateGeneralForm(template,draft,true),/adempimenti/);draft.fields.engagementCheck='Inquadramento e adempimenti individuati per la prestazione';}
  if(template.id==='featuring-agreement-v1'){draft.fields.fee='150 EUR';draft.fields.otherAgreements='Nessun vincolo impeditivo dichiarato';assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,paymentMode:'Partecipazione ai ricavi',revenueReference:''}},true),/ricavi/);}
  if(template.id==='marketing-consent-v1'){assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,rows:draft.rows.map(r=>({...r,channel:'WhatsApp',decision:'Non acconsento alla finalità e al canale indicati'})),fields:{...draft.fields,privacyDelivery:'Consegnata e identificata',phone:''}},true),'Refusing phone marketing never requires collecting a number');assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,rows:draft.rows.map(r=>({...r,decision:'Non acconsento alla finalità e al canale indicati'})),fields:{...draft.fields,privacyDelivery:'Consegnata e identificata'}},true));assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:draft.rows.map(r=>({...r,channel:'WhatsApp'})),fields:{...draft.fields,privacyDelivery:'Consegnata e identificata',phone:''}},true),/recapito/);}
  if(['session-musician-v1','featuring-agreement-v1'].includes(template.id))assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,authorContribution:template.fields.find(f=>f.key==='authorContribution').options[1],authorReference:''}},true),/autoriali/);
  if(template.authorization&&template.fields.find(f=>f.key==='capacity')?.options?.includes('Minorenne rappresentato')){
   const minor={...draft,fields:{...draft.fields,capacity:'Minorenne rappresentato',representative:'Guardian fixture',representativeTaxCode:'GUARDIAN',authority:'Documented authority',guardianMode:'Entrambi i genitori / esercenti'}};
   assert.throws(()=>svc.validateGeneralForm(template,minor,true),/entrambi/);minor.fields.secondRepresentative='Second guardian';if(template.contract)minor.fields.secondRepresentativeTaxCode='SECOND-GUARDIAN';assert.doesNotThrow(()=>svc.validateGeneralForm(template,minor,true));
   minor.fields.guardianMode='Unico soggetto legittimato documentato';assert.throws(()=>svc.validateGeneralForm(template,minor,true),/legittimazione/);minor.fields.guardianEvidence='Supporting document reference';assert.doesNotThrow(()=>svc.validateGeneralForm(template,minor,true));
   assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,rows:draft.rows.map(r=>({...r,decision:'Non autorizzo l’utilizzo indicato'}))},true));
  }
  if(template.id==='author-split-v1'){draft.rows[0].role='Autore del testo e compositore';draft.rows[0].dem='100';draft.rows[0].drm='100';draft.fields.workType='Musica e testo';assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],drm:'99,99'}]},true),/100%/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],dem:'-1'}]},true));assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],dem:'50',drm:'50'},{...draft.rows[0],dem:'50',drm:'50'}]},true),/più volte/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,nature:template.fields.find(f=>f.key==='nature').options[1]}},true),/opere preesistenti/);}
  if(template.id==='release-sheet-v1'){assert.throws(()=>svc.validateGeneralForm(template,draft,true),/diritti/);draft.fields.rightsCheck='Verificata con riferimenti agli accordi';}
  if(template.id==='delivery-approval-v1')assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,outcome:'Approvato con riserve',reservations:''}},true),/riserve/);
  if(template.id==='master-license-v1'){assert.throws(()=>svc.validateGeneralForm(template,draft,true),/autorizzazioni/);draft.fields.rightsCheck='Autorizzazioni verificate e documentate';assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,ownership:'Comproprietario del master',coownerConsents:'Consensi scritti allegati',sublicensing:'Limitate ai distributori e alle piattaforme indicati',sublicenseTerms:'Solo distributore indicato'}},true));assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,sublicensing:'Limitate ai distributori e alle piattaforme indicati',sublicenseTerms:''}},true),/sublicenze/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,ownership:'Comproprietario del master',coownerConsents:''}},true),/consensi/);}
  if(template.id==='revenue-recoupment-v1'){draft.rows[0].share='100';assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,recovery:'Prima del riparto',eligibleCosts:'Spese documentate',costCeiling:'200 EUR',costApproval:'Approvazione scritta',recoveryRules:'Ordine concordato'}},true));assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],share:'99'}]},true),/100%/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,calculationBase:'Incassi al netto delle sole deduzioni indicate',deductions:''}},true),/deduzioni/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,recovery:'Prima del riparto',eligibleCosts:'',costCeiling:'',costApproval:'',recoveryRules:''}},true),/recupero/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],capacity:'Minorenne rappresentato',representative:''}]},true),/rappresentante/);}
  if(template.id==='work-change-v1'){draft.fields.previousAmount='100,00';draft.fields.deltaAmount='20';draft.fields.newAmount='120';draft.rows[0].amount='20,00';assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,newAmount:'119'}},true),/totale/);assert.throws(()=>svc.validateGeneralForm(template,{...draft,rows:[{...draft.rows[0],amount:'19'}]},true),/somma/);assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,deltaAmount:'-20',newAmount:'80'},rows:[{...draft.rows[0],amount:'-20'}]},true));}
  if(template.contract){assert.doesNotThrow(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,capacity:'Minorenne rappresentato',representative:'Rappresentante fixture',representativeTaxCode:'CF fixture',authority:'Titolo alla sottoscrizione documentato',guardianMode:'Unico soggetto legittimato documentato',guardianEvidence:'Proof fixture',minorCompliance:'Authorisations verified fixture',minorChecks:'Representation and required authorisations verified fixture'}},true));assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,capacity:'Minorenne rappresentato',representative:'',representativeTaxCode:'',authority:''}},true),/rappresentante/);if(draft.fields.termStart)assert.throws(()=>svc.validateGeneralForm(template,{...draft,fields:{...draft.fields,termEnd:'2020-01-01'}},true),/scadenza/);}
  const response=await post('ready',1);assert.equal(response.status,200,await response.text());const row=(await db.query('SELECT * FROM studio_form_documents WHERE id=$1',[documentId])).rows[0];assert.equal(row.payload.definition.id,template.id);assert.equal(row.payload.provider.taxCode,template.contract?'FIXTURE-CODE':undefined,'Only contracts include full provider identity');
  if(template.id==='artist-development-continuity-v1'){const html=svc.renderToStaticMarkup(svc.Paper({doc:row,logo:'data:image/png;base64,AA=='}));assert.ok(html.includes('Fixture academyEntity'));assert.ok(html.includes('Fixture academyRepresentative'));assert.ok(html.includes('Fixture academyActivities'),'Academy commitments must appear in the agreement, separately from its identity');assert.ok(html.includes('Fixture studioActivities'));assert.ok(html.includes('Fixture clientName'));assert.equal((html.match(/Firma __________________________/g)||[]).length,3,'Three separate signature lines');assert.ok(html.includes('Nessuna opportunità già individuata'));}
  if(template.id==='quote-acceptance-v1'){
   assert.equal(row.payload.draft.quoteSnapshot.amount,20000);assert.equal(row.payload.draft.quoteSnapshot.notes,'Original terms');assert.equal((await db.query('SELECT status FROM studio_quotes WHERE project_id=$1',[draft.quoteId])).rows[0].status,'Bozza','Preparing form never accepts quote or records payment');
   await db.query('UPDATE studio_quotes SET version=2,amount=30000 WHERE project_id=$1',[draft.quoteId]);assert.equal((await post('ready',2)).status,409,'Stale quote requires reimport');
   assert.equal((await db.query('SELECT payload FROM studio_form_documents WHERE id=$1',[documentId])).rows[0].payload.draft.quoteSnapshot.amount,20000,'Stored copy remains frozen');
   draft.quoteVersion=2;await db.query("UPDATE studio_quotes SET status='Rifiutato' WHERE project_id=$1",[draft.quoteId]);assert.equal((await post('ready',2)).status,409,'Refused quotes cannot be prepared for acceptance');
  }
  if(template.id==='privacy-notice-v1'||template.id==='show-technical-sheet-v1'){const html=svc.renderToStaticMarkup(svc.Paper({doc:row,logo:'data:image/png;base64,AA=='}));assert.ok(!html.includes('Firma __________________________'),'Information-only documents do not demand signatures');assert.ok(!html.includes('FIXTURE-CODE'));if(template.notice){assert.ok(html.includes('Private fixture address'));assert.equal(row.payload.provider.address,'Private fixture address');}}
  if(template.id==='minor-documentation-v1'){const html=svc.renderToStaticMarkup(svc.Paper({doc:row,logo:'data:image/png;base64,AA=='}));assert.equal((html.match(/Firma __________________________/g)||[]).length,2);assert.ok(html.includes('Guardian two'));}
  if(process.env.FORMS_QA_DIR){await mkdir(process.env.FORMS_QA_DIR,{recursive:true});await writeFile(join(process.env.FORMS_QA_DIR,template.slug+'.json'),JSON.stringify(row));}
  const changedTemplate=svc.formTemplates.find(t=>t.id!==template.id);assert.equal((await svc.api.POST(request({id:documentId,template:changedTemplate.id,version:2,state:'draft',draft:svc.emptyGeneralForm(changedTemplate)}))).status,409,'Cannot change the template of an existing document');
 }
 await db.exec(await readFile('db/024-complete-form-catalog.sql','utf8'));assert.equal((await db.query('SELECT count(*)::int AS count FROM studio_form_documents')).rows[0].count,svc.formTemplates.length+1,'Latest catalog migration preserves all saved template types');
 assert.equal(svc.formTemplates.length+1,38);assert.equal(svc.originalFormPlan.length,38);for(const [number,title,template] of svc.originalFormPlan)assert.ok(template==='studio-services-v1'||svc.findFormTemplate(template),'Missing planned form '+number+' '+title);assert.equal(new Set(svc.formTemplates.map(t=>t.id)).size,svc.formTemplates.length);assert.equal(new Set(svc.formTemplates.map(t=>t.slug)).size,svc.formTemplates.length);
 const artistId=crypto.randomUUID(), workId=crypto.randomUUID(), trackedId=crypto.randomUUID();
 await db.query('INSERT INTO studio_artists(id,owner_id,name) VALUES($1,$2,$3)',[artistId,'owner','Fixture artist']);
 globalThis.formTargets=[{id:workId,artistId,title:'Fixture session'}];
 const trackedDraft={...ready,artistId};
 assert.equal((await svc.api.POST(request({id:trackedId,state:'ready',draft:trackedDraft,workId}))).status,200);
 const trackerUrl='https://portal.example.test/api/forms/artist-tracker';
 const sign=(version,extra={})=>svc.tracker.PATCH(new Request(trackerUrl,{method:'PATCH',headers:{origin:'https://portal.example.test','Content-Type':'application/json'},body:JSON.stringify({id:trackedId,artistId,version,action:'sign',signedOn:'2026-01-01',...extra})}));
 const readTracker=()=>svc.tracker.GET(new Request(trackerUrl+'?artist='+artistId));
 assert.equal((await sign(1,{evidenceUrl:'javascript:alert(1)'})).status,400);
 assert.equal((await sign(1,{action:'link',workId:crypto.randomUUID()})).status,400);
 assert.equal((await sign(1,{evidenceUrl:'https://example.test/signed'})).status,200);
 const read=await readTracker();assert.equal(read.status,200,await read.clone().text());
 let tracking=(await read.json()).documents.find(d=>d.id===trackedId);
 assert.equal(tracking.signedVersion,1);assert.equal(tracking.workId,workId);
 assert.equal((await svc.api.POST(request({id:trackedId,version:1,state:'ready',draft:trackedDraft}))).status,200);
 tracking=(await (await readTracker()).json()).documents.find(d=>d.id===trackedId);
 assert.equal(tracking.version,2);assert.equal(tracking.signedVersion,1);assert.equal(tracking.workId,workId);
 assert.equal((await sign(1)).status,409);
 globalThis.formsSession={user:{id:'other'}};
 assert.equal((await sign(2)).status,409);assert.deepEqual((await (await readTracker()).json()).documents,[]);
 globalThis.formsSession={user:{id:'owner'}};
 assert.equal((await sign(2)).status,200);assert.equal((await sign(2,{action:'clear'})).status,200);
 tracking=(await (await readTracker()).json()).documents.find(d=>d.id===trackedId);assert.equal(tracking.signedVersion,1);
 const origin='https://portal.example.test';
 const publish=(version,artist=artistId)=>svc.sharing.POST(new Request(origin+'/api/forms/share',{method:'POST',
  headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id:trackedId,version,artistId:artist})}));
 assert.equal((await publish(2)).status,409,'Artist needs active access');
 await db.query("INSERT INTO studio_artist_access(owner_id,artist_id,email,enabled) VALUES('owner',$1,'artist@example.test',true)",[artistId]);
 assert.equal((await publish(1)).status,409,'Owner cannot send a stale version');
 assert.equal((await publish(2,crypto.randomUUID())).status,409,'Owner cannot send to another artist');
 process.env.MAIL_SEND_ENABLED='true';globalThis.formMail=[];
 assert.equal((await (await publish(2)).json()).emailState,'sent');
 assert.equal((await (await publish(2)).json()).emailState,'sent');
 assert.equal(globalThis.formMail.length,1,'Retry cannot duplicate a sent email');
 assert.equal(globalThis.formMail[0][1],'artist@example.test');
 assert.ok(globalThis.formMail[0][3].includes('/area-artista#modulistica'));
 const share=(await db.query('SELECT * FROM studio_artist_form_shares WHERE document_id=$1',[trackedId])).rows[0];
 assert.equal(share.version,2);
 assert.equal((await svc.api.POST(request({id:trackedId,version:2,state:'draft',draft:{...trackedDraft,title:'Revised draft'}}))).status,200);
 assert.equal((await publish(3)).status,409,'A saved draft cannot be sent');
 const context={params:Promise.resolve({id:share.id})};
 const pdf='%PDF-1.7\nfixture\n%%EOF';
 const upload=(body=pdf)=>svc.returned.POST(new Request(origin+'/api/artist-documents/'+share.id,{method:'POST',
  headers:{origin,'Content-Type':'application/pdf'},body}),context);
 const download=()=>svc.returned.GET(new Request(origin+'/api/artist-documents/'+share.id),context);
 globalThis.formsSession=null;
 globalThis.artistFormsSession={ownerId:'owner',artistId:crypto.randomUUID()};
 assert.equal((await upload()).status,409,'Another artist cannot return the document');
 assert.equal((await download()).status,404);
 globalThis.artistFormsSession={ownerId:'owner',artistId};
 assert.equal((await upload('not a PDF')).status,415);
 assert.equal((await upload()).status,200);
 assert.equal((await upload()).status,409,'The submitted copy remains intact on retry');
 assert.equal(await (await download()).text(),pdf);
 globalThis.artistFormsSession={ownerId:'owner',artistId:crypto.randomUUID()};
 assert.equal((await download()).status,404,'Another artist cannot download the signed copy');
 globalThis.formsSession={user:{id:'owner'}};
 assert.equal(await (await download()).text(),pdf);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM studio_form_signatures WHERE document_id=$1 AND version=2',[trackedId])).rows[0].n,0);
 assert.equal((await svc.api.POST(request({id:trackedId,version:3,state:'ready',draft:trackedDraft}))).status,200);
 assert.equal((await publish(4)).status,200);
 const largeShare=(await db.query('SELECT id FROM studio_artist_form_shares WHERE document_id=$1 AND version=4',[trackedId])).rows[0];
 const largeContext={params:Promise.resolve({id:largeShare.id})};
 const pathname='artist-signed-forms/'+largeShare.id+'/'+crypto.randomUUID();
 const largeUrl=origin+'/api/artist-documents/'+largeShare.id;
 const jsonPost=(url,path)=>new Request(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({pathname:path})});
 const token=()=>svc.uploadToken.POST(jsonPost(largeUrl+'/upload',pathname),largeContext);
 const finish=(path=pathname)=>svc.returned.POST(jsonPost(largeUrl,path),largeContext);
 const largePdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(12*1024*1024),Buffer.from('%%EOF')]);
 let blobBytes=Buffer.from('%PDF-1.7 invalid');
 let reportedSize;
 const deletions=[];
 globalThis.signedBlob={
  get:async(path,opts)=>{
   assert.equal(path,pathname);assert.equal(opts.access,'private');
   return {stream:new Response(blobBytes).body,blob:{size:reportedSize??blobBytes.length,contentType:'application/pdf'}};
  },
  del:async path=>deletions.push(path),
 };
 globalThis.artistFormsSession={ownerId:'owner',artistId:crypto.randomUUID()};
 assert.equal((await token()).status,400);
 assert.equal((await finish()).status,404);
 globalThis.artistFormsSession={ownerId:'owner',artistId};
 const tokenReply=await (await token()).json();
 assert.equal(tokenReply.maximumSizeInBytes,20*1024*1024);
 assert.equal(tokenReply.allowOverwrite,false);
 assert.equal((await finish('https://example.test/file')).status,400);
 assert.equal((await finish()).status,415);
 reportedSize=21*1024*1024;
 assert.equal((await finish()).status,415);
 assert.equal(deletions.length,2);
 reportedSize=undefined;
 blobBytes=largePdf;
 assert.equal((await finish()).status,200);
 assert.equal((await finish()).status,200,'A retry preserves the already returned file');
 assert.equal((await token()).status,400);
 const largeDownload=()=>svc.returned.GET(new Request(largeUrl),largeContext);
 assert.deepEqual(Buffer.from(await (await largeDownload()).arrayBuffer()),largePdf);
 globalThis.formsSession=null;
 globalThis.artistFormsSession={ownerId:'owner',artistId:crypto.randomUUID()};
 assert.equal((await largeDownload()).status,404);
 globalThis.artistFormsSession={ownerId:'owner',artistId};
 assert.deepEqual(Buffer.from(await (await largeDownload()).arrayBuffer()),largePdf);
 globalThis.formsSession={user:{id:'owner'}};
 process.env.MAIL_SEND_ENABLED='false';
 const sessionWork={id:workId,artistId,kind:'recording',title:'Sessione',status:'Registrata'};
 const songWork={id:crypto.randomUUID(),artistId,kind:'track',title:'Inedito',status:'Mix'};
 assert.deepEqual(svc.suggestArtistDocuments(artistId,false,[],[sessionWork]).map(s=>s.template),['studio-services-v1']);
 assert.ok(svc.suggestArtistDocuments(artistId,false,[],[songWork]).some(s=>s.template==='digital-distribution-v1'&&s.workId===songWork.id));
 assert.ok(!svc.suggestArtistDocuments(artistId,false,[],[songWork]).some(s=>s.template.startsWith('label-')));
 assert.ok(svc.suggestArtistDocuments(artistId,true,[],[songWork]).some(s=>s.template==='label-collaboration-v1'&&!s.workId));
 assert.ok(svc.suggestArtistDocuments(artistId,true,[],[songWork]).some(s=>s.template==='label-release-agreement-v1'));
 assert.deepEqual(svc.suggestArtistDocuments(artistId,true,[],[]).map(s=>s.template),['artist-profile-v1','label-collaboration-v1']);
 for(const template of ['author-split-v1','coproduction-v1','performer-credits-v1','third-party-materials-v1','release-approval-v1']){
  assert.ok(svc.suggestArtistDocuments(artistId,true,[],[songWork]).some(s=>s.template===template&&s.workId===songWork.id));
 }
 const album={id:crypto.randomUUID(),artistId,kind:'Album',title:'Album',status:'In produzione'};
 const albumSuggestions=svc.suggestArtistDocuments(artistId,true,[album],[{...songWork,projectId:album.id}]);
 assert.deepEqual(albumSuggestions.filter(s=>s.template==='digital-distribution-v1').map(s=>s.workId),[album.id]);
 assert.deepEqual(albumSuggestions.filter(s=>s.template==='author-split-v1').map(s=>s.workId),[songWork.id]);
 assert.deepEqual(svc.splitTotals([{dem:'33,33',drm:'33.33'},{dem:'33.33',drm:'33.33'},{dem:'33,34',drm:'33.34'}]),{dem:10000,drm:10000});
 globalThis.formsSession={user:{id:'other'}};assert.equal((await svc.api.GET(new Request('https://portal.example.test/api/forms?id='+id))).status,404);const otherList=await(await svc.api.GET(new Request('https://portal.example.test/api/forms'))).json();assert.equal(otherList.documents.length,0);
 console.log('PASS forms: artist-scoped publication, email deduplication, signed PDF return, owner-only editing, origin checks, incomplete drafts, required signature fields, guardian data, immutable history, stale versions, linked quote isolation and server-only provider identity.');
}finally{await db.close();await rm(temp,{recursive:true,force:true});}
