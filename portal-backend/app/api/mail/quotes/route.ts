import {ownerMailboxSession} from "@/lib/mail-access";
import {listLedger} from "@/lib/finance";
import {listFinanceTargets} from "@/lib/finance-targets";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(req:Request){
 const s=await ownerMailboxSession(req.headers);
 if(!s)return Response.json({error:"Accesso riservato"},{status:403});
 try{
  const [ledger,targets]=await Promise.all([listLedger(s.workspaceOwnerId),listFinanceTargets(s.workspaceOwnerId)]);
  const byId=new Map(targets.filter(t=>!t.deletedAt).map(t=>[t.id,t]));
  const quotes=ledger.quotes.filter(q=>byId.has(q.projectId)).map(q=>{
   const t=byId.get(q.projectId)!;
   return {id:t.id,title:t.title,artist:t.artist,version:q.version,amount:q.amount,status:q.status};
  }).slice(0,100);
  return Response.json({quotes},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Preventivi non disponibili"},{status:503});}
}
