import {ownerMailboxSession} from "@/lib/mail-access";
import {probeArubaImap} from "@/lib/aruba-imap-probe";
import {getDb} from "@/lib/db";
import {ARUBA_MAIL} from "@/lib/aruba-mail-config";
import {sameOrigin} from "@/lib/calendar-policy";
export const dynamic="force-dynamic";export const runtime="nodejs";export const maxDuration=20;
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return Response.json({error:"Origine non autorizzata"},{status:403});
 const session=await ownerMailboxSession(req.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const result=await probeArubaImap();
 if(result.authenticated){const updated=await getDb().query("UPDATE studio_mail_accounts SET status='connected',updated_at=now() WHERE owner_id=$1 AND provider='aruba' AND lower(address)=$2 RETURNING id",[session.workspaceOwnerId,ARUBA_MAIL.address]);if(!updated.rowCount)return Response.json({error:"Autenticazione IMAP riuscita, ma casella Aruba non registrata per questo titolare. Registrala prima di verificare."},{status:409});}
 return Response.json({...result,readOnly:true,messagesRead:0,messagesSent:0},{headers:{"Cache-Control":"no-store"}});
}
