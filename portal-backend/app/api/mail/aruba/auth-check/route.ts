import {ownerMailboxSession} from "@/lib/mail-access";
import {probeArubaImap} from "@/lib/aruba-imap-probe";
import {sameOrigin} from "@/lib/calendar-policy";
export const dynamic="force-dynamic";export const runtime="nodejs";export const maxDuration=20;
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return Response.json({error:"Origine non autorizzata"},{status:403});
 const session=await ownerMailboxSession(req.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const result=await probeArubaImap();
 return Response.json({...result,readOnly:true,messagesRead:0,messagesSent:0},{headers:{"Cache-Control":"no-store"}});
}
