import "server-only";
import {getDb} from "./db";
import {sendArtistGmail} from "./artist-gmail";
type EventType="message"|"preview"|"approval"|"revision"|"delivery";
export async function notifyArtistEvent(owner:string,artistId:string,trackId:string,recipient:"studio"|"artist",eventType:EventType,body:string){
 try{
  await getDb().query("INSERT INTO studio_artist_notifications(owner_id,artist_id,track_id,recipient,event_type,body) VALUES($1,$2,$3,$4,$5,$6)",[owner,artistId,trackId,recipient,eventType,body.slice(0,300)]);
 }catch(e){
  console.warn("[artist-notifications] failed to record notification",e instanceof Error?e.message:"unknown");
 }
 if(process.env.MAIL_SEND_ENABLED!=="true")return;
 try{
  const r=recipient==="artist"?await getDb().query("SELECT email FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL",[owner,artistId]):await getDb().query('SELECT email FROM "user" WHERE id=$1',[owner]);
  const email=r.rows[0]?.email;
  if(typeof email!=="string"||!email.trim())return;
  await sendArtistGmail(owner,email,"Emme Studio — Nuova comunicazione",body+"\\n\\nAccedi al portale Emme Studio per leggere e rispondere.");
 }catch(e){console.warn("[artist-notifications] Gmail delivery failed",e instanceof Error?e.message:"unknown");}
}
