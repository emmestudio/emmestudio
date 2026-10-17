import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {decryptMailSecret} from "@/lib/mail-crypto";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=25;
const response=(error:string,status:number)=>Response.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
 const owner=await ownerMailboxSession(req.headers);if(!owner)return response("Non autorizzato",403);
 const q=new URL(req.url).searchParams,id=q.get("accountId"),mid=q.get("messageId"),idx=Number(q.get("index"));
 if(!validId(id)||!mid||!/^[a-zA-Z0-9_-]{5,100}$/.test(mid)||!Number.isInteger(idx)||idx<0||idx>19)return response("Allegato non valido",400);
 try{
 const r=await getDb().query(`SELECT c.encrypted_refresh_token FROM studio_mail_accounts a JOIN studio_mail_google_credentials c ON c.account_id=a.id AND a.owner_id=c.owner_id WHERE a.id=$1 AND a.owner_id=$2 AND a.provider='gmail' AND a.status='connected'`,[id,owner.workspaceOwnerId]);
 if(!r.rowCount)return response("Casella non autorizzata",403);
 const t=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,refresh_token:decryptMailSecret(r.rows[0].encrypted_refresh_token),grant_type:"refresh_token"}),cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!t.ok)return response("Gmail non disponibile",503);
 const token=(await t.json() as {access_token?:string}).access_token;if(!token)return response("Token mancante",503);
 const headers={Authorization:"Bearer "+token};
 const m=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(mid)+"?format=full",{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});if(!m.ok)return response("Messaggio non disponibile",502);
 type Part={filename?:string;mimeType?:string;body?:{data?:string;attachmentId?:string;size?:number};parts?:Part[]};
 const body=await m.json() as {payload?:Part};const parts:Part[]=[];
 function visit(p:Part,depth:number){if(depth>8||parts.length>80)return;parts.push(p);for(const sub of p.parts??[])visit(sub,depth+1);}
 if(body.payload)visit(body.payload);
 const files=parts.filter(p=>p.filename&&(p.body?.attachmentId||p.body?.data)).slice(0,20);
 const file=files[idx];if(!file)return response("Allegato non trovato",404);
 if((file.body?.size??0)>8*1024*1024)return response("Allegato superiore a 8 MB",413);
 let data=file.body?.data;
 if(file.body?.attachmentId){
  const u="https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(mid)+"/attachments/"+encodeURIComponent(file.body.attachmentId);
  const a=await fetch(u,{headers,signal:AbortSignal.timeout(12000),cache:"no-store"});if(!a.ok)return response("Allegato non disponibile",502);
  data=(await a.json() as {data?:string}).data;
 }
 if(!data)return response("Allegato vuoto",404);
 const bytes=Buffer.from(data,"base64url");if(bytes.length>8*1024*1024)return response("Allegato superiore a 8 MB",413);
 const safe=(file.filename??"allegato").replace(/[\r\n"\\/]/g,"_").slice(0,120);
 return new Response(new Uint8Array(bytes),{status:200,headers:{"Content-Type":"application/octet-stream","Content-Disposition":'attachment; filename="'+safe+'"',"X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
 }catch{return response("Download non riuscito",503);}
}
