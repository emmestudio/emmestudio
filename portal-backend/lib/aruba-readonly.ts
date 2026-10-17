import "server-only";
import tls from "node:tls";
import {ARUBA_MAIL,arubaMailReadiness} from "./aruba-mail-config";
import type {MailHeader} from "./gmail-readonly";
const MAX_BYTES=900000;
function decode(v:string){return v.replace(/=\?UTF-8\?B\?([^?]+)\?=/gi,(_,s:string)=>{try{return Buffer.from(s,"base64").toString("utf8")}catch{return s}}).replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi,(_,s:string)=>s.replace(/_/g," ").replace(/=([0-9a-f]{2})/gi,(_x:string,h:string)=>String.fromCharCode(parseInt(h,16))));}
export async function listArubaHeaders(accountId:string,folder:"inbox"|"sent"="inbox"):Promise<MailHeader[]>{
 if(!arubaMailReadiness().configured)throw Error("Credenziali Aruba non configurate");
 const user=process.env.ARUBA_MAIL_USERNAME!,password=process.env.ARUBA_MAIL_PASSWORD!;
 if(/[\r\n]/.test(user+password))throw Error("Credenziali non valide");
 return new Promise((resolve,reject)=>{
  let finished=false, buffer=Buffer.alloc(0),step=0,folderIndex=0;let collected:MailHeader[]=[];
  const folders=folder==="sent"?["Sent","Sent Items","INBOX.Sent","Posta inviata"]:["INBOX"];
  const sock=tls.connect({host:ARUBA_MAIL.imap.host,port:993,servername:ARUBA_MAIL.imap.host,rejectUnauthorized:true,timeout:12000});
  const fail=(msg:string)=>{if(finished)return;finished=true;sock.destroy();reject(Error(msg))};
  const ok=()=>{if(finished)return;finished=true;sock.destroy();resolve(collected)};
  const send=(tag:string,command:string)=>sock.write(tag+" "+command+"\r\n");
  const quoted=(x:string)=>'"'+x.replace(/\\/g,"\\\\").replace(/"/g,'\\"')+'"';
  sock.on("timeout",()=>fail("Timeout connessione IMAP Aruba"));sock.on("error",()=>fail("Connessione IMAP Aruba non disponibile"));
  sock.on("data",(chunk:Buffer)=>{
   buffer=Buffer.concat([buffer,chunk]);if(buffer.length>MAX_BYTES)return fail("Risposta IMAP troppo grande");
   const text=buffer.toString("latin1");
   if(step===0&&text.includes("\r\n")){
    if(!/^\* OK/i.test(text))return fail("IMAP Aruba non disponibile");
    buffer=Buffer.alloc(0);step=1;send("A001","LOGIN "+quoted(user)+" "+quoted(password));return;
   }
   if(step===1&&/A001 (OK|NO|BAD)\b/i.test(text)){
    if(!/A001 OK\b/i.test(text))return fail("Autenticazione Aruba rifiutata");
    buffer=Buffer.alloc(0);step=2;send("A002","EXAMINE "+JSON.stringify(folders[folderIndex]));return;
   }
   if(step===2&&/A002 (OK|NO|BAD)\b/i.test(text)){
    if(!/A002 OK\b/i.test(text)){folderIndex++;if(folderIndex>=folders.length)return fail("Cartella Posta inviata Aruba non disponibile");buffer=Buffer.alloc(0);send("A002","EXAMINE "+JSON.stringify(folders[folderIndex]));return;}
    buffer=Buffer.alloc(0);step=3;send("A003","UID SEARCH ALL");return;
   }
   if(step===3&&/A003 (OK|NO|BAD)\b/i.test(text)){
    if(!/A003 OK\b/i.test(text))return fail("Ricerca INBOX non disponibile");
    const ids=(text.match(/^\* SEARCH ([0-9 ]*)/m)?.[1]??"").trim().split(/\s+/).filter(Boolean).slice(-15);
    if(!ids.length)return ok();
    buffer=Buffer.alloc(0);step=4;send("A004","UID FETCH "+ids.join(",")+" (UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])");return;
   }
   if(step===4&&/A004 (OK|NO|BAD)\b/i.test(text)){
    if(!/A004 OK\b/i.test(text))return fail("Intestazioni Aruba non disponibili");
    const chunks=text.split(/(?=\* \d+ FETCH \()/i);
    collected=chunks.flatMap(part=>{
     const uid=part.match(/\bUID (\d+)\b/i)?.[1];if(!uid)return [];
     const literal=part.match(/\{(\d+)\}\r\n/);if(!literal)return [];
     const at=(literal.index??0)+literal[0].length, size=Number(literal[1]);if(size>10000||at+size>part.length)return [];
     const raw=part.slice(at,at+size).replace(/\r\n[ \t]+/g," ");
     const field=(name:string)=>decode(raw.match(new RegExp("^"+name+":\\s*(.*)$","im"))?.[1]?.trim()??"").slice(0,300);
     return [{id:uid,accountId,provider:"aruba" as const,from:field("From"),subject:field("Subject"),date:field("Date"),snippet:"",unread:!(/\\Seen/i.test(part.slice(0,at)))}];
    }).slice(-15);
    ok();
   }
  });
 });
}
