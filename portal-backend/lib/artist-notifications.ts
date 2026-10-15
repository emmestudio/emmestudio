import "server-only";
import {getDb} from "./db";
type EventType="message"|"preview"|"approval"|"revision"|"delivery";
export async function notifyArtistEvent(owner:string,artistId:string,trackId:string,recipient:"studio"|"artist",eventType:EventType,body:string){
 try{
  await getDb().query("INSERT INTO studio_artist_notifications(owner_id,artist_id,track_id,recipient,event_type,body) VALUES($1,$2,$3,$4,$5,$6)",[owner,artistId,trackId,recipient,eventType,body.slice(0,300)]);
 }catch(e){
  // Notifications must never interrupt audio publication, approvals or messages.
  console.warn("[artist-notifications] failed to record notification",e instanceof Error?e.message:"unknown");
 }
}
