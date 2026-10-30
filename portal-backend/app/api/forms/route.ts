import {ownerSession} from '@/lib/owner-session';
import {getDb} from '@/lib/db';
import {sameOrigin} from '@/lib/calendar-policy';
import {validId} from '@/lib/task-data';
import {validateServiceAgreement,agreementClauses} from '@/lib/service-agreement-data';
import {agreementProvider} from '@/lib/agreement-provider';
import {listFinanceTargets} from '@/lib/finance-targets';
import {listLedger} from '@/lib/finance';
import {euro} from '@/lib/finance-data';
export const dynamic='force-dynamic';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private,no-store','Referrer-Policy':'no-referrer'}});
export async function GET(request:Request){
 const s=await ownerSession(request.headers);if(!s)return reply({error:'Accesso riservato al titolare.'},401);
 try{const url=new URL(request.url),id=url.searchParams.get('id'),quote=url.searchParams.get('quote');
 if(id){if(!validId(id))return reply({error:'Riferimento non valido.'},400);const doc=(await getDb().query('SELECT * FROM studio_form_documents WHERE id=$1 AND owner_id=$2',[id,s.user.id])).rows[0];if(!doc)return reply({error:'Documento non disponibile.'},404);return reply({document:doc});}
 if(quote){if(!validId(quote))return reply({error:'Preventivo non valido.'},400);const [targets,ledger]=await Promise.all([listFinanceTargets(s.user.id),listLedger(s.user.id)]);const target=targets.find(t=>t.id===quote),q=ledger.quotes.find(q=>q.projectId===quote);if(!target||!q)return reply({error:'Preventivo non disponibile.'},404);return reply({target,quote:q,summary:[target.title,'Versione '+q.version+' · '+q.status,...(q.items?.length?q.items.map(l=>l.description+' — '+l.quantity/100+' × '+euro(l.unitPrice)):['Totale: '+euro(q.amount)]),q.notes].filter(Boolean).join('\n'),amount:euro(q.amount)});}
 const [docs,artists]=await Promise.all([getDb().query('SELECT id,title,state,version,updated_at FROM studio_form_documents WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 300',[s.user.id]),getDb().query('SELECT id,name,first_name,last_name,email,phone FROM studio_artists WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY name',[s.user.id])]);return reply({documents:docs.rows,artists:artists.rows,provider:agreementProvider()});
 }catch{return reply({error:'Modulistica non disponibile.'},503);}
}
export async function POST(request:Request){
 const s=await ownerSession(request.headers);if(!s)return reply({error:'Accesso riservato al titolare.'},401);if(!sameOrigin(request.headers.get('origin'),process.env.BETTER_AUTH_URL))return reply({error:'Origine non consentita.'},403);
 let v,d;try{const raw=await request.text();if(raw.length>150000)throw Error('Documento troppo lungo.');v=JSON.parse(raw);if(!validId(v.id)||!Number.isInteger(v.version)||v.version<0||!['draft','ready'].includes(v.state))throw Error('Dati non validi.');d=validateServiceAgreement(v.draft,v.state==='ready');}catch(e){return reply({error:e instanceof Error?e.message:'Modulo non valido.'},400);}
 const c=await getDb().connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',[s.user.id+'-forms']);const old=(await c.query('SELECT * FROM studio_form_documents WHERE id=$1 AND owner_id=$2 FOR UPDATE',[v.id,s.user.id])).rows[0];if((old?.version||0)!==v.version)throw Error('Documento aggiornato in un’altra finestra. Riaprilo prima di salvare.');
 if(d.artistId&&!(await c.query('SELECT id FROM studio_artists WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL',[d.artistId,s.user.id])).rows[0])throw Error('Artista non disponibile.');
 if(d.quoteId){const q=(await c.query('SELECT version FROM studio_quotes WHERE project_id=$1 AND owner_id=$2 FOR SHARE',[d.quoteId,s.user.id])).rows[0];if(!q||q.version!==d.quoteVersion)throw Error('Il preventivo collegato è cambiato. Importa nuovamente la versione aggiornata.');}
 const provider=agreementProvider();if(v.state==='ready'&&(!provider.taxCode||!provider.address||!provider.email))throw Error('Completa l’anagrafica riservata del contraente.');
 const payload={draft:d,provider,clauses:agreementClauses(d),templateVersion:1};let next=v.version+1;
 if(old)await c.query('UPDATE studio_form_documents SET title=$3,state=$4,payload=$5::jsonb,version=$6,updated_at=now() WHERE id=$1 AND owner_id=$2',[v.id,s.user.id,d.title,v.state,JSON.stringify(payload),next]);else await c.query('INSERT INTO studio_form_documents(id,owner_id,template,title,state,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[v.id,s.user.id,'studio-services-v1',d.title,v.state,JSON.stringify(payload)]);
 await c.query('INSERT INTO studio_form_history(document_id,version,payload,state) VALUES($1,$2,$3::jsonb,$4)',[v.id,next,JSON.stringify(payload),v.state]);await c.query('COMMIT');return reply({saved:true,id:v.id,version:next,state:v.state});
 }catch(e){await c.query('ROLLBACK');return reply({error:e instanceof Error?e.message:'Salvataggio non riuscito.'},409);}finally{c.release();}
}
