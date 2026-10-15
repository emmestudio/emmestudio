import {ownerMailboxSession} from "@/lib/mail-access";
import {arubaMailReadiness,ARUBA_MAIL} from "@/lib/aruba-mail-config";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await ownerMailboxSession(request.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const readiness=arubaMailReadiness();
 return Response.json({provider:"aruba",address:ARUBA_MAIL.address,imapReady:readiness.configured,smtpReady:readiness.configured,connected:false,notice:"Configurazione locale soltanto: connessioni IMAP/SMTP non ancora testate."},{headers:{"Cache-Control":"no-store"}});
}
