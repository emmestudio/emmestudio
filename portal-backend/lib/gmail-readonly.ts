import "server-only";
import {getDb} from "./db";
import {decryptMailSecret} from "./mail-crypto";
export type MailHeader={id:string;accountId:string;provider:"gmail"|"aruba";from:string;subject:string;date:string;snippet:string;unread:boolean};
export async function listGmailHeaders(ownerId:string,accountId:string):Promise<MailHeader[]>{
 const db=getDb();
 const r=await db.query(`SELECT a.id,a.address,c.encrypted_refresh_token FROM studio_mail_accounts a
 JOIN studio_mail_google_credentials c ON c.account_id=a.id AND c.owner_id=a.owner_id
 WHERE a.id=$1 AND a.owner_id=$2 AND a.provider='gmail' AND a.status='connected'`,[accountId,ownerId]);
 if(!r.rowCount)throw Error("Gmail non collegata.");
 const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,refresh_token:decryptMailSecret(r.rows[0].encrypted_refresh_token),grant_type:"refresh_token"}),signal:AbortSignal.timeout(10000),cache:"no-store"});
 if(!token.ok)throw Error("Autorizzazione Gmail scaduta o non disponibile.");
 const info=await token.json() as {access_token?:string};if(!info.access_token)throw Error("Token Gmail non disponibile");
 const headers={Authorization:"Bearer "+info.access_token};
 const list=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?"+new URLSearchParams({maxResults:"15",labelIds:"INBOX"}),{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});
 if(!list.ok)throw Error("Impossibile leggere la posta Gmail.");
 const ids=await list.json() as {messages?:{id:string}[]};
 const records=await Promise.all((ids.messages??[]).slice(0,15).map(async m=>{
  const u="https://gmail.googleapis.com/gmail/v1/users/me/messages/"+encodeURIComponent(m.id)+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date";
  const res=await fetch(u,{headers,signal:AbortSignal.timeout(10000),cache:"no-store"});
  if(!res.ok)return null;
  const b=await res.json() as {id:string;snippet?:string;labelIds?:string[];payload?:{headers?:{name:string;value:string}[]}};
  const h=(key:string)=>b.payload?.headers?.find(v=>v.name.toLowerCase()===key)?.value??"";
  return {id:b.id,accountId,provider:"gmail" as const,from:h("from").slice(0,300),subject:h("subject").slice(0,300),date:h("date"),snippet:(b.snippet??"").slice(0,400),unread:(b.labelIds??[]).includes("UNREAD")};
 }));
 return records.filter((v):v is MailHeader=>v!==null);
}
