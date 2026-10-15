import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const s=await workspaceSession(request.headers);
 if(!s)return Response.json({error:"Accesso richiesto"},{status:401});
 if(s.role!=="admin"||s.user.id!==s.workspaceOwnerId)return Response.json({error:"Solo titolare"},{status:403});
 try{
  const db=getDb();
  const result=await db.query(`SELECT id,title,version_label AS "versionLabel",status,
   superseded_at AS "supersededAt",superseded_at+interval '30 days' AS "expiresAt"
   FROM studio_artist_previews p
   WHERE p.owner_id=$1 AND p.status='withdrawn' AND p.superseded_at IS NOT NULL AND p.purged_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM studio_artist_deliveries d WHERE d.owner_id=p.owner_id AND d.file_id=p.drive_file_id)
   AND NOT EXISTS(SELECT 1 FROM studio_artist_previews x WHERE x.owner_id=p.owner_id AND x.drive_file_id=p.drive_file_id AND x.id<>p.id AND x.purged_at IS NULL AND x.superseded_at IS NULL)
   ORDER BY p.superseded_at ASC LIMIT 100`,[s.workspaceOwnerId]);
  return Response.json({dryRun:true,items:result.rows.map((x:{expiresAt:string|Date})=>({...x,eligible:new Date(x.expiresAt).getTime()<=Date.now()}))},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Verifica della conservazione non disponibile"},{status:503});}
}
