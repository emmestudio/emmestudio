import {ownerMailboxSession} from "@/lib/mail-access";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {prepareOutgoing,sendGmail,sendAruba} from "@/lib/mail-outgoing";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata"},403);
 if(process.env.MAIL_SEND_ENABLED!=="true")return reply({error:"Invio disabilitato: collaudo SMTP/Gmail Send non completato."},503);
 const owner=await ownerMailboxSession(req.headers);
 if(!owner)return reply({error:"Invio riservato al titolare"},403);
 if(Number(req.headers.get("content-length")??0)>12*1024*1024)return reply({error:"Messaggio troppo grande"},413);
 let data:Record<string,unknown>;
 try{data=await req.json()}catch{return reply({error:"Richiesta non valida"},400)}
 const accountId=data.accountId;
 if(!validId(accountId))return reply({error:"Casella non valida"},400);
 try{
  const mail=prepareOutgoing(data);
  const {getDb}=await import("@/lib/db");
  const accounts=await getDb().query("SELECT provider FROM studio_mail_accounts WHERE id=$1 AND owner_id=$2",[accountId,owner.workspaceOwnerId]);
  if(!accounts.rowCount)return reply({error:"Casella non autorizzata"},403);
  const provider=accounts.rows[0].provider;
  const result=provider==="gmail"?await sendGmail(owner.workspaceOwnerId,accountId,mail):provider==="aruba"?await sendAruba(owner.workspaceOwnerId,accountId,mail):null;
  if(!result)return reply({error:"Provider non supportato"},400);
  return reply(result);
 }catch(err){const msg=err instanceof Error?err.message:"Invio fallito";return reply({error:msg},503)}
}
