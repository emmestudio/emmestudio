import "server-only";
import {getDb} from "./db";
import {decryptMailSecret} from "./mail-crypto";
export async function readGmailMessage(ownerId:string,accountId:string,messageId:string){
 const r=await getDb().query(`SELECT c.encrypted_refresh_token FROM studio_mail_accounts a JOIN studio_mail_google_credentials c ON c.account_id=a.id AND c.owner_id=a.owner_id WHERE a.id=$1 AND a.owner_id=$2 AND a.provider='gmail' AND a.status='connected'`,[accountId,ownerId]);
 if(!r.rowCount)throw Error("Account Gmail non disponibile");
 const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,refresh_token:decryptMailSecret(r.rows[0].encrypted_refresh_token),grant_type:"refresh_token"}),signal:AbortSignal.timeout(12000),cache:"no-store"});
 if(!token.ok)throw Error("Autorizzazione Gmail non disponibile");
 const access=(await token.json() as {access_token?:string}).access_token;
 if(!access)throw Error("Token Gmail non disponibile");
 const msg=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(messageId)+"?format=full",{headers:{Authorization:"Bearer "+access},cache:"no-store",signal:AbortSignal.timeout(12000)});
 if(!msg.ok)throw Error(msg.status===404?"Messaggio non trovato":"Lettura messaggio Gmail non disponibile");
 type Part={mimeType?:string;filename?:string;body?:{data?:string;attachmentId?:string;size?:number};parts?:Part[]};
 const m=await msg.json() as {id:string;threadId?:string;payload?:Part&{headers?:{name:string;value:string}[]}};
 const field=(name:string)=>m.payload?.headers?.find(h=>h.name.toLowerCase()===name)?.value??"";
 const parts:Part[]=[];const walk=(p:Part,depth=0)=>{if(depth>8||parts.length>75)return;parts.push(p);for(const child of p.parts??[])walk(child,depth+1);};if(m.payload)walk(m.payload);
 const attachments=parts.filter(p=>p.filename&&(p.body?.attachmentId||p.body?.data)).slice(0,20).map((p,index)=>({index,name:p.filename!.slice(0,180),mimeType:p.mimeType??"application/octet-stream",size:p.body?.size??0}));
 const plain=parts.find(p=>p.mimeType==="text/plain"&&p.body?.data);
 const html=parts.find(p=>p.mimeType==="text/html"&&p.body?.data);
 const decode=(p:Part)=>Buffer.from(p.body?.data??"","base64url").toString("utf8").slice(0,150000);
 let body=plain?decode(plain):html?decode(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">"):"";
 const htmlBody=html?decode(html).slice(0,150000):undefined;
 return {from:field("from"),to:field("to"),subject:field("subject"),date:field("date"),messageId:field("message-id"),threadId:m.threadId??"",body,htmlBody,attachments,notice:html?"HTML isolato; immagini esterne bloccate fino alla tua autorizzazione.":undefined};
}
