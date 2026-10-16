import {ownerMailboxSession} from "@/lib/mail-access";
import {arubaMailReadiness,ARUBA_MAIL} from "@/lib/aruba-mail-config";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await ownerMailboxSession(request.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const ready=arubaMailReadiness();
 return Response.json({
  provider:"aruba",address:ARUBA_MAIL.address,
  credentialsConfigured:ready.configured,
  authenticated:false,receiveEnabled:false,sendEnabled:false,
  nextStep:ready.configured?"Verifica autenticazione IMAP e SMTP da implementare":"Configurare ARUBA_MAIL_USERNAME e ARUBA_MAIL_PASSWORD come segreti del ramo Preview",
  notice:"Nessuna connessione autenticata o invio di email effettuato."
 },{headers:{"Cache-Control":"no-store"}});
}
