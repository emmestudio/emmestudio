import "server-only";
import tls from "node:tls";
import {ARUBA_MAIL,arubaMailReadiness} from "./aruba-mail-config";
type Part={name?:string;type:string;bytes:Buffer;children:Part[]};
function splitMessage(bytes:Buffer){
 const pos=bytes.indexOf("\r\n\r\n");if(pos<0)return {headers:{} as Record<string,string>,body:bytes};
 const h:Record<string,string>={};
 for(const line of bytes.subarray(0,pos).toString("latin1").replace(/\r\n[ \t]+/g," ").split("\r\n")){
  const i=line.indexOf(":");if(i>0)h[line.slice(0,i).trim().toLowerCase()]=line.slice(i+1).trim();
 }
 return {headers:h,body:bytes.subarray(pos+4)};
}
function param(header:string,key:string){
 const match=header.match(new RegExp(key+'\\s*=\\s*(?:"([^"]+)"|([^;\\s]+))',"i"));
 const extended=header.match(new RegExp(key+"\\*\\s*=\\s*UTF-8''([^;\\s]+)","i"));
 if(extended){try{return decodeURIComponent(extended[1])}catch{}}
 return match?.[1]??match?.[2]??"";
}
function transfer(bytes:Buffer,encoding:string){
 if(encoding.toLowerCase().includes("base64"))return Buffer.from(bytes.toString("latin1").replace(/[^A-Za-z0-9+/=]/g,""),"base64");
 if(encoding.toLowerCase().includes("quoted-printable")){
  const s=bytes.toString("latin1").replace(/=\r?\n/g,"").replace(/=([a-f0-9]{2})/gi,(_a,h:string)=>String.fromCharCode(parseInt(h,16)));
  return Buffer.from(s,"latin1");
 }
 return bytes;
}
function parse(bytes:Buffer,depth=0):Part{
 if(depth>8)throw Error("MIME troppo complesso");
 const {headers,body}=splitMessage(bytes),header=headers["content-type"]??"text/plain";
 const type=header.split(";")[0].trim().toLowerCase();
 const name=param(headers["content-disposition"]??"","filename")||param(header,"name");
 const boundary=param(header,"boundary");
 if(type.startsWith("multipart/")&&boundary){
  const children:Part[]=[];
  for(const section of body.toString("latin1").split("--"+boundary).slice(1,70)){
   if(section.startsWith("--"))break;
   const cleaned=section.replace(/^\r?\n/,"").replace(/\r?\n$/,"");
   if(cleaned.trim())children.push(parse(Buffer.from(cleaned,"latin1"),depth+1));
  }
  return {name,type,bytes:Buffer.alloc(0),children};
 }
 return {name,type,bytes:transfer(body,headers["content-transfer-encoding"]??""),children:[]};
}
function parts(root:Part){const out:Part[]=[];const visit=(p:Part)=>{if(out.length>=80)return;out.push(p);for(const x of p.children)visit(x)};visit(root);return out;}
export async function fetchArubaFull(uid:string,folder:"inbox"|"sent"="inbox"){
 if(!/^\d{1,18}$/.test(uid))throw Error("UID IMAP non valido");
 if(!arubaMailReadiness().configured)throw Error("Casella Aruba non configurata");
 const username=process.env.ARUBA_MAIL_USERNAME!,password=process.env.ARUBA_MAIL_PASSWORD!;
 if(/[\r\n"\\]/.test(username+password))throw Error("Credenziali Aruba non valide");
 const bytes=await new Promise<Buffer>((resolve,reject)=>{
  const sock=tls.connect({host:ARUBA_MAIL.imap.host,port:993,servername:ARUBA_MAIL.imap.host,rejectUnauthorized:true});
  sock.setTimeout(18000);let buffer=Buffer.alloc(0),state=0,done=false,folderIndex=0;
  const folders=folder==="sent"?["Sent","Sent Items","INBOX.Sent","Posta inviata"]:["INBOX"];
  const finish=(error:Error|null,value?:Buffer)=>{if(done)return;done=true;sock.destroy();if(error)reject(error);else resolve(value??Buffer.alloc(0))};
  const send=(tag:string,command:string)=>sock.write(tag+" "+command+"\r\n");
  sock.on("timeout",()=>finish(Error("Timeout IMAP Aruba")));
  sock.on("error",()=>finish(Error("Connessione IMAP Aruba fallita")));
  sock.on("close",()=>finish(Error("IMAP Aruba interrotto")));
  sock.on("data",(chunk:Buffer)=>{
   buffer=Buffer.concat([buffer,chunk]);if(buffer.length>11*1024*1024)return finish(Error("Email superiore al limite di 10 MB"));
   const text=buffer.toString("latin1");
   if(state===0&&text.includes("\r\n")){
    if(!text.startsWith("* OK"))return finish(Error("Server IMAP non disponibile"));
    state=1;buffer=Buffer.alloc(0);send("A001",'LOGIN "'+username+'" "'+password+'"');return;
   }
   if(state===1&&/\r\nA001 (OK|NO|BAD)\b/i.test("\r\n"+text)){
    if(!/\r\nA001 OK\b/i.test("\r\n"+text))return finish(Error("Login Aruba rifiutato"));
    state=2;buffer=Buffer.alloc(0);send("A002","EXAMINE "+JSON.stringify(folders[folderIndex]));return;
   }
   if(state===2&&/\r\nA002 (OK|NO|BAD)\b/i.test("\r\n"+text)){
    if(!/\r\nA002 OK\b/i.test("\r\n"+text)){folderIndex++;if(folderIndex>=folders.length)return finish(Error("Cartella IMAP non disponibile"));buffer=Buffer.alloc(0);send("A002","EXAMINE "+JSON.stringify(folders[folderIndex]));return;}
    state=3;buffer=Buffer.alloc(0);send("A003","UID FETCH "+uid+" (UID BODY.PEEK[])");return;
   }
   if(state===3&&/\r\nA003 (OK|NO|BAD)\b/i.test("\r\n"+text)){
    if(!/\r\nA003 OK\b/i.test("\r\n"+text))return finish(Error("Messaggio Aruba non disponibile"));
    const match=/\{(\d+)\}\r\n/.exec(text);if(!match)return finish(Error("Messaggio non trovato"));
    const size=Number(match[1]),begin=(match.index??0)+match[0].length;
    if(size>10*1024*1024||begin+size>buffer.length)return finish(Error("Messaggio IMAP incompleto"));
    return finish(null,buffer.subarray(begin,begin+size));
   }
  });
 });
 const headers=splitMessage(bytes).headers,all=parts(parse(bytes));
 const attachments=all.filter(p=>Boolean(p.name)).slice(0,20);
 const plain=all.find(p=>p.type==="text/plain"&&!p.name);
 const html=all.find(p=>p.type==="text/html"&&!p.name);
 const selected=plain??html;
 let text=selected?.bytes.toString("utf8")??"";
 if(!plain&&html)text=text.replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&");
 return {message:{from:headers.from??"",to:headers.to??"",subject:headers.subject??"",date:headers.date??"",messageId:headers["message-id"]??"",threadId:"",body:text.slice(0,150000),attachments:attachments.map((a,index)=>({index,name:a.name??"allegato",size:a.bytes.length,mimeType:a.type}))},buffers:attachments.map(a=>a.bytes)};
}
