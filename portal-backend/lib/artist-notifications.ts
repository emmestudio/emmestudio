import "server-only";
import {getDb} from "./db";
import {sendArtistGmail} from "./artist-gmail";
type EventType="message"|"preview"|"approval"|"revision"|"delivery";
export async function deliverArtistEmail(owner:string,id:string){
 if(process.env.MAIL_SEND_ENABLED!=="true")return;
 const claimed=await getDb().query("UPDATE studio_artist_email_outbox SET state='sending',attempts=attempts+1,error='',updated_at=now() WHERE owner_id=$1 AND id=$2 AND state IN ('queued','failed') RETURNING recipient_email,notification_id",[owner,id]);
 const job=claimed.rows[0];if(!job)return;
 try{
  const n=await getDb().query("SELECT body,recipient FROM studio_artist_notifications WHERE owner_id=$1 AND id=$2",[owner,job.notification_id]);
  if(!n.rows[0])throw Error('Notifica non disponibile');
  const path=n.rows[0].recipient==='artist'?'/area-artista':'/messaggi-artisti';
  const base=process.env.BETTER_AUTH_URL!;
  const result=await sendArtistGmail(owner,job.recipient_email,"Emme Studio — Nuova comunicazione",n.rows[0].body+"\n\nApri il portale: "+new URL(path,base).href);
  await getDb().query("UPDATE studio_artist_email_outbox SET state=$3,error=$4,updated_at=now() WHERE owner_id=$1 AND id=$2",[owner,id,result.sent?'sent':'failed',result.sent?'':result.reason]);
 }catch(e){
  const definitive=e instanceof Error && /^Gmail API 4\d\d$/.test(e.message);
  await getDb().query("UPDATE studio_artist_email_outbox SET state=$3,error=$4,updated_at=now() WHERE owner_id=$1 AND id=$2",[owner,id,definitive?'failed':'uncertain',definitive?'Google ha rifiutato l’invio.':'Esito non confermato: verifica Gmail prima di ripetere.']);
 }
}
export async function notifyArtistEvent(owner:string,artistId:string,trackId:string,recipient:"studio"|"artist",eventType:EventType,body:string){
 try{
  const result=await getDb().query("INSERT INTO studio_artist_notifications(owner_id,artist_id,track_id,recipient,event_type,body) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",[owner,artistId,trackId,recipient,eventType,body.slice(0,300)]);
  const id=result.rows[0].id;
  const people=recipient==='artist'
   ?await getDb().query("SELECT COALESCE(x.email,NULLIF(a.email,'')) AS email FROM studio_artists a LEFT JOIN studio_artist_access x ON x.owner_id=a.owner_id AND x.artist_id=a.id AND x.enabled WHERE a.owner_id=$1 AND a.id=$2 AND a.deleted_at IS NULL",[owner,artistId])
   :await getDb().query('SELECT email FROM "user" WHERE id=$1 UNION SELECT email FROM portal_members WHERE owner_id=$1 AND active=true',[owner]);
  for(const email of new Set(people.rows.map(r=>String(r.email??'').trim().toLowerCase()).filter(e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))))await getDb().query("INSERT INTO studio_artist_email_outbox(owner_id,notification_id,recipient_email) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[owner,id,email]);
  const jobs=await getDb().query("SELECT id FROM studio_artist_email_outbox WHERE owner_id=$1 AND notification_id=$2 AND state='queued'",[owner,id]);
  for(let i=0;i<jobs.rows.length;i+=3)await Promise.all(jobs.rows.slice(i,i+3).map(j=>deliverArtistEmail(owner,j.id)));
 }catch{console.warn('[artist-notifications] Event delivery requires attention in notification register.');}
}
