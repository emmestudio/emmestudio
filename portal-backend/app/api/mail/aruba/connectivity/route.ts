import {connect} from "node:tls";
import {ownerMailboxSession} from "@/lib/mail-access";
import {ARUBA_MAIL} from "@/lib/aruba-mail-config";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=20;
function handshake(host:string,port:number):Promise<{ok:boolean;message:string}>{
 return new Promise(resolve=>{
  let complete=false;let socket:ReturnType<typeof connect>|undefined;
  const finish=(ok:boolean,message:string)=>{if(complete)return;complete=true;socket?.destroy();resolve({ok,message});};
  try{
   socket=connect({host,port,servername:host,rejectUnauthorized:true,timeout:6500},()=>finish(socket?.authorized===true,socket?.authorized?"Connessione TLS verificata":"Certificato TLS non verificato"));
   socket.on("timeout",()=>finish(false,"Timeout connessione"));
   socket.on("error",()=>finish(false,"Connessione TLS non disponibile"));
  }catch{finish(false,"Connessione TLS non disponibile");}
 });
}
export async function GET(req:Request){
 const s=await ownerMailboxSession(req.headers);
 if(!s)return Response.json({error:"Riservato al titolare"},{status:403});
 const [imap,smtp]=await Promise.all([handshake(ARUBA_MAIL.imap.host,ARUBA_MAIL.imap.port),handshake(ARUBA_MAIL.smtp.host,ARUBA_MAIL.smtp.port)]);
 return Response.json({imap,smtp,authenticated:false,notice:"Test solo TLS: nessuna password usata, email letta o inviata."},{headers:{"Cache-Control":"no-store"}});
}
