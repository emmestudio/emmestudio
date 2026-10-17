import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {readGmailMessage} from "@/lib/gmail-message-readonly";
import {fetchArubaFull} from "@/lib/aruba-message-readonly";
import {ARUBA_MAIL} from "@/lib/aruba-mail-config";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=25;
export async function GET(req:Request){
 const owner=await ownerMailboxSession(req.headers);
 if(!owner)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const url=new URL(req.url),id=url.searchParams.get("accountId"),messageId=url.searchParams.get("messageId"),provider=url.searchParams.get("provider");
 if(!validId(id)||!messageId||!(/^[A-Za-z0-9_-]{5,120}$/.test(messageId))||!["gmail","aruba"].includes(provider??""))return Response.json({error:"Messaggio non valido"},{status:400});
 const a=await getDb().query("SELECT id,address FROM studio_mail_accounts WHERE id=$1 AND owner_id=$2 AND provider=$3",[id,owner.workspaceOwnerId,provider]);
 if(!a.rowCount)return Response.json({error:"Casella non autorizzata"},{status:403});
 if(provider==="aruba"&&String(a.rows[0].address).toLowerCase()!==ARUBA_MAIL.address)return Response.json({error:"Casella Aruba non autorizzata"},{status:403});
 try{return Response.json({message:provider==="gmail"?await readGmailMessage(owner.workspaceOwnerId,id!,messageId):(await fetchArubaFull(messageId)).message},{headers:{"Cache-Control":"no-store"}})}
 catch{return Response.json({error:"Impossibile aprire questa email"},{status:503})}
}
