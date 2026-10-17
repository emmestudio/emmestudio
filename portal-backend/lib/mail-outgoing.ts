import "server-only";
import tls from "node:tls";
import {randomBytes} from "node:crypto";
import {getDb} from "./db";
import {decryptMailSecret} from "./mail-crypto";
import {ARUBA_MAIL,arubaMailReadiness} from "./aruba-mail-config";
export type OutgoingAttachment={name:string;mimeType:string;contentBase64:string};
export type OutgoingMail={to:string;subject:string;body:string;attachments:OutgoingAttachment[];replyMessageId?:string;threadId?:string};
function b64(value:string){return Buffer.from(value,"utf8").toString("base64");}
function mimeHeader(value:string){return "=?UTF-8?B?"+b64(value)+"?=";}
function wrap64(value:string){return value.replace(/.{1,76}/g,"$&\r\n").trimEnd();}
function encodedName(value:string){return encodeURIComponent(value).replace(/['()]/g,c=>"%"+c.charCodeAt(0).toString(16).toUpperCase());}
export function prepareOutgoing(input:unknown):OutgoingMail{
 if(!input||typeof input!=="object")throw Error("Messaggio non valido");
 const x=input as Record<string,unknown>;
 if(typeof x.to!=="string"||x.to.length>254||!(/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(x.to)))throw Error("Destinatario non valido");
 if(typeof x.subject!=="string"||x.subject.length>250||/[\r\n]/.test(x.subject))throw Error("Oggetto non valido");
 if(typeof x.body!=="string"||!x.body.trim()||x.body.length>50000)throw Error("Testo mancante o troppo lungo");
 if(!Array.isArray(x.attachments)||x.attachments.length>8)throw Error("Troppi allegati");
 let total=0;
 const attachments=x.attachments.map((raw:unknown)=>{
  if(!raw||typeof raw!=="object")throw Error("Allegato non valido");
  const a=raw as Record<string,unknown>;
  if(typeof a.name!=="string"||!a.name||a.name.length>180||/[\r\n]/.test(a.name))throw Error("Nome allegato non valido");
  if(typeof a.mimeType!=="string"||a.mimeType.length>100||!/^[\w.+-]+\/[\w.+-]+$/.test(a.mimeType))throw Error("Tipo allegato non valido");
  if(typeof a.contentBase64!=="string"||!/^([A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.contentBase64))throw Error("Formato allegato non valido");
  const buf=Buffer.from(a.contentBase64,"base64");total+=buf.length;
  if(buf.length>1536*1024||total>2*1024*1024)throw Error("Limite allegati: 1,5 MB per file e 2 MB complessivi");
  return {name:a.name,mimeType:a.mimeType,contentBase64:a.contentBase64};
 });
 return {to:x.to.toLowerCase(),subject:x.subject.trim(),body:x.body,attachments,replyMessageId:typeof x.replyMessageId==="string"?x.replyMessageId.slice(0,300):undefined,threadId:typeof x.threadId==="string"&&/^[a-fA-F0-9]{1,64}$/.test(x.threadId)?x.threadId:undefined};
}
export function buildRfc822(from:string,mail:OutgoingMail):string{
 const boundary="emmestudio-"+randomBytes(12).toString("hex");
 const head=[
  "From: <"+from+">",
  "To: <"+mail.to+">",
  "Subject: "+mimeHeader(mail.subject),
  "Date: "+new Date().toUTCString(),
  "MIME-Version: 1.0",
  "Message-ID: <"+randomBytes(12).toString("hex")+"@emmestudioproduction.it>"
 ];
 if(mail.replyMessageId&&/^<[^<>\r\n]+>$/.test(mail.replyMessageId))head.push("In-Reply-To: "+mail.replyMessageId,"References: "+mail.replyMessageId);
 if(!mail.attachments.length)return [...head,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: base64","",wrap64(b64(mail.body)),""].join("\r\n");
 head.push('Content-Type: multipart/mixed; boundary="'+boundary+'"');
 const chunks=[...head,"","--"+boundary,'Content-Type: text/plain; charset="UTF-8"',"Content-Transfer-Encoding: base64","",wrap64(b64(mail.body))];
 for(const a of mail.attachments){
  chunks.push("--"+boundary,
   "Content-Type: "+a.mimeType+"; name*=UTF-8''"+encodedName(a.name),
   "Content-Disposition: attachment; filename*=UTF-8''"+encodedName(a.name),
   "Content-Transfer-Encoding: base64","",wrap64(a.contentBase64));
 }
 chunks.push("--"+boundary+"--","");
 return chunks.join("\r\n");
}
async function gmailToken(ownerId:string,accountId:string){
 const r=await getDb().query("SELECT a.address,c.encrypted_refresh_token FROM studio_mail_accounts a JOIN studio_mail_google_credentials c ON c.account_id=a.id AND c.owner_id=a.owner_id WHERE a.id=$1 AND a.owner_id=$2 AND a.provider='gmail' AND a.status='connected'",[accountId,ownerId]);
 if(!r.rowCount)throw Error("Gmail non collegata");
 const token=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:process.env.GMAIL_OAUTH_CLIENT_ID!,client_secret:process.env.GMAIL_OAUTH_CLIENT_SECRET!,refresh_token:decryptMailSecret(r.rows[0].encrypted_refresh_token),grant_type:"refresh_token"}),signal:AbortSignal.timeout(12000),cache:"no-store"});
 if(!token.ok)throw Error("Autorizzazione Gmail non disponibile");
 const access=(await token.json() as {access_token?:string}).access_token;
 if(!access)throw Error("Accesso Gmail non disponibile");
 return {from:String(r.rows[0].address),access};
}
export async function sendGmail(ownerId:string,accountId:string,mail:OutgoingMail){
 const {from,access}=await gmailToken(ownerId,accountId);
 const raw=Buffer.from(buildRfc822(from,mail),"utf8").toString("base64url");
 const res=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send",{method:"POST",headers:{"Authorization":"Bearer "+access,"Content-Type":"application/json"},body:JSON.stringify(mail.threadId?{raw,threadId:mail.threadId}:{raw}),signal:AbortSignal.timeout(20000),cache:"no-store"});
 if(!res.ok)throw Error(res.status===403?"Gmail non autorizza l'invio: controlla gli scope Google.":"Invio Gmail non riuscito (HTTP "+res.status+")");
 return {sent:true,provider:"gmail"};
}
async function smtpAruba(from:string,mail:OutgoingMail){
 if(!arubaMailReadiness().configured||from.toLowerCase()!==ARUBA_MAIL.address)throw Error("Aruba non configurata");
 const socket=tls.connect({host:ARUBA_MAIL.smtp.host,port:ARUBA_MAIL.smtp.port,servername:ARUBA_MAIL.smtp.host,rejectUnauthorized:true});
 socket.setTimeout(15000);
 let buffer="",waiter:((line:string)=>void)|null=null;
 let failed:((reason:Error)=>void)|null=null;
 const output:string[]=[];
 const complete=(reply:string)=>{output.push(reply);if(waiter){const next=waiter;waiter=null;next(output.splice(0).join("\n"));}};
 socket.on("data",(chunk:Buffer)=>{buffer+=chunk.toString("utf8");if(buffer.length>100000){socket.destroy();return;}let pos=buffer.indexOf("\r\n");while(pos!==-1){const line=buffer.slice(0,pos);buffer=buffer.slice(pos+2);if(/^\d{3} /.test(line))complete(line);pos=buffer.indexOf("\r\n");}});
 socket.on("error",()=>{if(failed)failed(Error("Connessione SMTP non disponibile"));});
 socket.on("timeout",()=>{if(failed)failed(Error("Timeout SMTP"));socket.destroy();});
 const reply=()=>new Promise<string>((resolve,reject)=>{
  if(output.length){resolve(output.splice(0).join("\n"));return;}
  waiter=resolve;failed=reject;
 });
 let returnCode=0;
 const step=async(stage:string,cmd:string|undefined,expected:number[])=>{
  if(cmd!==undefined)socket.write(cmd+"\r\n");
  const response=await reply();const n=Number(response.match(/^(\d{3})/)?.[1]);
  returnCode=n;
  if(!expected.includes(n)){const detail=response.replace(/[^\x20-\x7e]/g," ").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,"[indirizzo]").replace(/\b[A-Za-z0-9+/]{32,}={0,2}\b/g,"[dato riservato]").slice(0,150);throw Error("SMTP Aruba: "+stage+" rifiutato ("+n+"). "+detail);}
 };
 try{
  await step("connessione",undefined,[220]);
  await step("identificazione","EHLO emmestudioproduction.it",[250]);
  await step("autenticazione","AUTH LOGIN",[334]);
  await step("utente",b64(process.env.ARUBA_MAIL_USERNAME!),[334]);
  await step("password",b64(process.env.ARUBA_MAIL_PASSWORD!),[235]);
  await step("mittente","MAIL FROM:<"+from+">",[250]);
  await step("destinatario","RCPT TO:<"+mail.to+">",[250,251]);
  await step("inizio messaggio","DATA",[354]);
  const mime=buildRfc822(from,mail).replace(/(^|\r\n)\./g,"$1..");
  await step("conferma messaggio",mime+"\r\n.",[250]);
  return {sent:true,provider:"aruba",smtpAccepted:true,smtpCode:returnCode,notice:"Messaggio accettato dal server SMTP Aruba; recapito al destinatario non ancora confermato."};
 }finally{socket.destroy();}
}
export async function sendAruba(ownerId:string,accountId:string,mail:OutgoingMail){
 const r=await getDb().query("SELECT address FROM studio_mail_accounts WHERE id=$1 AND owner_id=$2 AND provider='aruba'",[accountId,ownerId]);
 if(!r.rowCount||String(r.rows[0].address).toLowerCase()!==ARUBA_MAIL.address)throw Error("Casella Aruba non autorizzata");
 return smtpAruba(ARUBA_MAIL.address,mail);
}
