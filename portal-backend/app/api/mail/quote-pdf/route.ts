import {ownerMailboxSession} from "@/lib/mail-access";
import {validId} from "@/lib/task-data";
import {listFinanceTargets} from "@/lib/finance-targets";
import {listLedger} from "@/lib/finance";
import {renderQuotePdf} from "@/lib/mail-quote-pdf";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=20;
export async function GET(req:Request){
 const session=await ownerMailboxSession(req.headers);
 if(!session)return Response.json({error:"Accesso riservato"},{status:403});
 const id=new URL(req.url).searchParams.get("id");
 if(!validId(id))return Response.json({error:"Riferimento preventivo non valido"},{status:400});
 try{
  const [targets,ledger]=await Promise.all([listFinanceTargets(session.workspaceOwnerId),listLedger(session.workspaceOwnerId)]);
  const target=targets.find(t=>t.id===id&&!t.deletedAt);
  const q=ledger.quotes.find(q=>q.projectId===id);
  if(!target||!q)return Response.json({error:"Preventivo non trovato"},{status:404});
  const pdf=renderQuotePdf({title:target.title,artist:target.artist,service:target.service,id:target.id,version:q.version,status:q.status,amount:q.amount,notes:q.notes??"",items:q.items??[]});
  if(pdf.length>1536*1024)return Response.json({error:"Preventivo superiore al limite degli allegati"},{status:413});
  return new Response(new Uint8Array(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Preventivo-EmmeStudio-'+id.slice(0,8)+'.pdf"',"X-Content-Type-Options":"nosniff","Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Generazione PDF non riuscita"},{status:503});}
}
