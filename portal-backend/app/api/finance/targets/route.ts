import {workspaceSession} from '@/lib/workspace-session';
import {listFinanceTargets} from '@/lib/finance-targets';
export const dynamic='force-dynamic';
export async function GET(r:Request){
 const s=await workspaceSession(r.headers);
 if(!s)return Response.json({error:'Accesso richiesto.'},{status:401});
 if(s.role!=='admin')return Response.json({error:'Sezione riservata all’amministratore.'},{status:403});
 try{return Response.json({targets:await listFinanceTargets(s.workspaceOwnerId)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Situazione economica non disponibile.'},{status:503});}
}
