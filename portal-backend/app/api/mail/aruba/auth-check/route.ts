import {ownerMailboxSession} from "@/lib/mail-access";
import {probeArubaImap} from "@/lib/aruba-imap-probe";
export const dynamic="force-dynamic";export const runtime="nodejs";
export async function GET(req:Request){
 const session=await ownerMailboxSession(req.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const result=await probeArubaImap();
 return Response.json({...result,readOnly:true,messagesRead:0,messagesSent:0},{headers:{"Cache-Control":"no-store"}});
}
