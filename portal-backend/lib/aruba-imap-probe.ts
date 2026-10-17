import "server-only";
import tls from "node:tls";
import {ARUBA_MAIL,arubaMailReadiness} from "./aruba-mail-config";
export type ImapProbe={tls:boolean;authenticated:boolean;message:string};
export async function probeArubaImap():Promise<ImapProbe>{
 if(!arubaMailReadiness().configured)return {tls:false,authenticated:false,message:"Credenziali non configurate"};
 return new Promise(resolve=>{
  let socket:tls.TLSSocket|undefined;
  let buffer="",phase="hello",tlsOk=false,done=false;
  const finish=(authenticated:boolean,message:string)=>{if(done)return;done=true;socket?.destroy();resolve({tls:tlsOk,authenticated,message});};
  try{
   socket=tls.connect({host:ARUBA_MAIL.imap.host,port:ARUBA_MAIL.imap.port,servername:ARUBA_MAIL.imap.host,rejectUnauthorized:true,timeout:8000},()=>{tlsOk=socket?.authorized===true;if(!tlsOk)finish(false,"Certificato TLS non verificato");});
   socket.setEncoding("utf8");socket.on("timeout",()=>finish(false,"Timeout IMAP"));socket.on("error",()=>finish(false,"Connessione IMAP non riuscita"));
   socket.on("close",()=>finish(false,"Connessione IMAP chiusa"));
   socket.on("data",(part:string)=>{
    buffer+=part;if(buffer.length>16384)return finish(false,"Risposta IMAP fuori limite");
    let end=buffer.indexOf("\r\n");
    while(end>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
     if(phase==="hello"&&line.startsWith("* OK")){
      const user=process.env.ARUBA_MAIL_USERNAME!,password=process.env.ARUBA_MAIL_PASSWORD!;
      if(/[\r\n"\\]/.test(user+password))return finish(false,"Caratteri credenziali non supportati dal controllo");
      phase="login";socket?.write('A001 LOGIN "'+user+'" "'+password+'"\r\n');
     }else if(phase==="login"&&/^A001 (OK|NO|BAD)\b/i.test(line)){
      if(/^A001 OK\b/i.test(line)){phase="logout";socket?.write("A002 LOGOUT\r\n");}
      else finish(false,"Autenticazione IMAP rifiutata");
     }else if(phase==="logout"&&/^A002 (OK|NO|BAD)\b/i.test(line))finish(true,"Autenticazione IMAP riuscita");
     end=buffer.indexOf("\r\n");
    }
   });
  }catch{finish(false,"Verifica IMAP non disponibile");}
 });
}
