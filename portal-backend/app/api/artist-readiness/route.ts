import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {drivePermission} from "@/lib/drive-archive";
import {configurationReady} from "@/lib/config";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await workspaceSession(request.headers);
 if(!session)return Response.json({error:"Accesso richiesto"},{status:401});
 if(session.role!=="admin"||session.user.id!==session.workspaceOwnerId)return Response.json({error:"Solo titolare"},{status:403});
 const status:{configuration:boolean;database:boolean;tables:Record<string,boolean>;driveScope:boolean;errors:string[]}={
  configuration:configurationReady(),database:false,tables:{},driveScope:false,errors:[]
 };
 try{
  const db=await getDb().query(`SELECT
    to_regclass('public.studio_artist_previews') IS NOT NULL AS previews,
    to_regclass('public.studio_artist_access') IS NOT NULL AS access,
    to_regclass('public.studio_artist_deliveries') IS NOT NULL AS deliveries`);
  status.database=true;
  status.tables=db.rows[0]??{};
 }catch{status.errors.push("Database non raggiungibile");}
 if(status.database){
  try{status.driveScope=(await drivePermission(session.workspaceOwnerId)).granted;}
  catch{status.errors.push("Autorizzazione Drive non verificabile");}
 }
 return Response.json(status,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
