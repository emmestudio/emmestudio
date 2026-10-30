import 'server-only';
import {randomUUID,createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {emptyProduction,standaloneServices} from './production-data';
import {writeQuote} from './finance';
import {sessionQuoteTotal,validateSessionQuote,type SessionQuote} from './session-quote-data';
import {renderQuotePdf} from './mail-quote-pdf';

type BookingWork={id:string;owner_id:string;name:string;email:string;phone:string;project:string;service:string;description:string;links:string;start_at:string;end_at:string;artist_id:string;project_id:string;production_id?:string|null;session_quote:SessionQuote|null};
export async function ensureBookingWork(c:PoolClient,b:BookingWork){
 if(b.production_id){
  const r=await c.query('SELECT id FROM studio_production WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL',[b.production_id,b.owner_id]);
  if(!r.rows[0])throw Error('Ripristina prima l’attività collegata dal cestino.');
  return b.production_id;
 }
 let artist=b.artist_id||null,project=b.project_id||null;
 if(project){const p=(await c.query('SELECT artist_id FROM studio_projects WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL AND status<>\'Archiviato\' FOR UPDATE',[project,b.owner_id])).rows[0];if(!p)throw Error('Progetto collegato non disponibile.');if(artist&&artist!==p.artist_id)throw Error('Artista e progetto non corrispondono.');artist=p.artist_id;}
 if(!artist){const matches=(await c.query('SELECT id FROM studio_artists WHERE owner_id=$1 AND lower(trim(email))=$2 AND deleted_at IS NULL ORDER BY id',[b.owner_id,b.email.toLowerCase().trim()])).rows;if(matches.length>1)throw Error('Più artisti hanno questa email: scegli il profilo nelle note interne e salva prima di confermare.');artist=matches[0]?.id||null;}
 if(artist){if(!(await c.query('SELECT id FROM studio_artists WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL FOR UPDATE',[artist,b.owner_id])).rows[0])throw Error('Artista collegato non disponibile.');}
 else{artist=randomUUID();await c.query('INSERT INTO studio_artists(id,owner_id,name,email,phone,notes) VALUES($1,$2,$3,$4,$5,$6)',[artist,b.owner_id,(b.project||b.name).slice(0,200),b.email,b.phone,'Profilo creato dalla prenotazione '+b.id+' — referente: '+b.name]);}
 const service=b.service==='Mix'?'Servizio Mix':b.service==='Mastering'?'Servizio Master':b.service;
 const data={...emptyProduction('service',project||''),artistId:artist,title:(b.session_quote?.title||b.service+' — '+(b.project||b.name)).slice(0,200),notes:['Prenotazione '+b.id,'Referente: '+b.name,'Appuntamento: '+new Date(b.start_at).toLocaleString('it-IT',{timeZone:'Europe/Rome'}),b.description,b.links].filter(Boolean).join('\n\n'),details:{service:standaloneServices.includes(service as typeof standaloneServices[number])?service:'Altro',serviceOther:standaloneServices.includes(service as typeof standaloneServices[number])?'':service,scope:b.description,url:''}};
 const id=randomUUID();await c.query('INSERT INTO studio_production(id,owner_id,project_id,artist_id,kind,data,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,b.owner_id,project,artist,'service',JSON.stringify(data),createHash('sha256').update(b.id).digest('hex')]);
 await c.query('INSERT INTO studio_production_history(item_id,owner_id,version,data,actor) VALUES($1,$2,1,$3,$4)',[id,b.owner_id,JSON.stringify(data),'Prenotazione confermata']);
 await c.query('UPDATE studio_bookings SET production_id=$2,artist_id=$3,project_id=$4 WHERE id=$1',[b.id,id,artist,project||'']);
 b.production_id=id;b.artist_id=artist;b.project_id=project||'';
 return id;
}
export async function syncBookingWorkQuote(c:PoolClient,b:BookingWork,input:unknown,expected?:number){
 const draft=validateSessionQuote(input);
 if(!b.production_id)return;
 const q=(await c.query('SELECT * FROM studio_quotes WHERE project_id=$1 AND owner_id=$2 FOR UPDATE',[b.production_id,b.owner_id])).rows[0];
 if(q&&expected!==undefined&&q.version!==expected)throw Error('Il preventivo è cambiato nel progetto o nei guadagni. Ricarica la prenotazione.');
 if(!draft){if(q)throw Error('Il preventivo è già collegato alla contabilità. Gestiscilo dall’attività; non può essere rimosso dalla prenotazione.');return;}
 const notes=draft.notes;
 if(q&&q.amount===sessionQuoteTotal(draft)&&q.notes===notes&&q.items.length===draft.items.length&&q.items.every((line:{description:string;quantity:number;unitPrice:number},i:number)=>line.description===draft.items[i].description&&line.quantity===draft.items[i].quantity&&line.unitPrice===draft.items[i].unitPrice))return;
 if(q&&expected===undefined)throw Error('Ricarica la prenotazione prima di modificare il preventivo collegato.');
 await writeQuote(c,b.owner_id,b.production_id,{amount:sessionQuoteTotal(draft),status:q?.status||'Confermato',items:draft.items,notes,confirmationNote:q?.confirmation_note||'Lavoro associato alla conferma della prenotazione '+b.id},q?.version||0,'production');
}
export async function linkedBookingQuote(c:{query:Function},b:BookingWork){
 if(!b.production_id)return null;
 const r=(await c.query(`SELECT r.data,a.name AS artist,p.artist AS project_artist,q.* FROM studio_production r LEFT JOIN studio_projects p ON p.id=r.project_id AND p.owner_id=r.owner_id LEFT JOIN studio_artists a ON a.id=COALESCE(p.artist_id,r.artist_id) AND a.owner_id=r.owner_id JOIN studio_quotes q ON q.project_id=r.id AND q.owner_id=r.owner_id WHERE r.id=$1 AND r.owner_id=$2 AND r.deleted_at IS NULL`,[b.production_id,b.owner_id])).rows[0];
 if(!r)return null;
 const service=r.data.details?.service==='Altro'?r.data.details.serviceOther:r.data.details?.service;
 const title=r.data.title;
 const pdf=renderQuotePdf({id:b.production_id,title,artist:r.artist||r.project_artist||'Artista',service:service||'Servizio',version:r.version,status:r.status,amount:r.amount,notes:r.notes,items:r.items});
 return {draft:{title,notes:r.notes,items:r.items.length?r.items:[{description:service||'Servizio',quantity:100,unitPrice:r.amount}]} as SessionQuote,version:r.version,refs:[{id:b.production_id,version:r.version,title}],files:[{id:b.production_id,version:r.version,name:'Preventivo-EmmeStudio-'+b.production_id.slice(0,8)+'-v'+r.version+'.pdf',pdf}]};
}
