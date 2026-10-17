import {workspaceSession} from "@/lib/workspace-session";
import {gmailPermission} from "@/lib/artist-gmail";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const s=await workspaceSession(req.headers);
 if(!s)return Response.json({error:"Accesso richiesto"},{status:401});
 if(s.role!=="admin"||s.user.id!==s.workspaceOwnerId)return Response.json({authorized:false,canConnect:false});
 try{
  const p=await gmailPermission(s.workspaceOwnerId);
  return Response.json({authorized:p.granted,canConnect:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Verifica Gmail non disponibile"},{status:503})}
}
