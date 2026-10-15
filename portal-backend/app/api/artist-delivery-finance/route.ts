import {ownerMailboxSession} from "@/lib/mail-access";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {listLedger} from "@/lib/finance";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await ownerMailboxSession(request.headers);
 if(!session)return Response.json({error:"Riservato al titolare"},{status:403});
 const trackId=new URL(request.url).searchParams.get("trackId");
 if(!validId(trackId))return Response.json({error:"Brano non valido"},{status:400});
 try{
  const r=await getDb().query("SELECT id,project_id FROM studio_production WHERE owner_id=$1 AND id=$2 AND kind='track' AND deleted_at IS NULL",[session.workspaceOwnerId,trackId]);
  if(!r.rowCount)return Response.json({error:"Brano non trovato"},{status:404});
  const track=r.rows[0],ledger=await listLedger(session.workspaceOwnerId);
  const summary=(id:string)=>{
   const quotes=ledger.quotes.filter(q=>q.projectId===id).sort((a,b)=>b.version-a.version);
   const received=ledger.payments.filter(p=>p.projectId===id&&!p.voidReason).reduce((sum,p)=>sum+p.amount,0);
   const total=quotes[0]?.amount??null;
   return {targetId:id,quoteStatus:quotes[0]?.status??null,quoteVersion:quotes[0]?.version??null,totalCents:total,receivedCents:received,balanceCents:total===null?null:Math.max(0,total-received)};
  };
  return Response.json({track:summary(track.id),project:track.project_id?summary(track.project_id):null,notice:"Il riepilogo progetto può comprendere altri brani. Download sempre autorizzato manualmente."},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Riepilogo economico non disponibile"},{status:503});}
}
