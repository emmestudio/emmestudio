import "server-only";
import {getDb} from "./db";
import nodemailer from "nodemailer";
type EventType="message"|"preview"|"approval"|"revision"|"delivery";
const safe=(s:string)=>s.replace(/[\r\n]/g," ").slice(0,180);
export async function notifyArtistEvent(owner:string,artistId:string,trackId:string,recipient:"studio"|"artist",eventType:EventType,body:string){
 try{
  await getDb().query("INSERT INTO studio_artist_notifications(owner_id,artist_id,track_id,recipient,event_type,body) VALUES($1,$2,$3,$4,$5,$6)",[owner,artistId,trackId,recipient,eventType,body.slice(0,300)]);
 }catch(e){
  console.warn("[artist-notifications] failed to record notification",e instanceof Error?e.message:"unknown");
 }
 if(process.env.MAIL_SEND_ENABLED!=="true")return;
 const username=process.env.ARUBA_MAIL_USERNAME,password=process.env.ARUBA_MAIL_PASSWORD;
 if(!username||!password)return;
 try{
  const artist=await getDb().query("SELECT name,email FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL",[owner,artistId]);
  if(!artist.rowCount)return;
  const recipients=recipient==="artist"?[artist.rows[0].email]:(
   await getDb().query("SELECT email FROM portal_members WHERE owner_id=$1 AND active=true UNION SELECT email FROM \"user\" WHERE id=$1",[owner])
  ).rows.map((x:{email:string})=>x.email);
  const valid=Array.from(new Set(recipients.filter((x:unknown):x is string=>typeof x==="string"&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))));
  if(!valid.length)return;
  const transport=nodemailer.createTransport({host:process.env.ARUBA_SMTP_HOST||"smtps.aruba.it",port:465,secure:true,auth:{user:username,pass:password}});
  const link="https://portal.emmestudioproduction.it/"+(recipient==="studio"?"messaggi-artisti":"area-artista");
  await transport.sendMail({from:username,to:valid.join(","),subject:safe("Emme Studio — "+(recipient==="artist"?"Nuovo messaggio":"Nuova comunicazione artista")),text:safe(body)+"\n\nAccedi al portale per i dettagli: "+link});
 }catch(e){console.warn("[artist-notifications] email failed",e instanceof Error?e.message:"unknown")}
}
