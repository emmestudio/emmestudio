import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const s=await workspaceSession(request.headers);
 if(!s)return Response.json({error:"Accesso richiesto"},{status:401});
 if(s.role!=="admin"||s.user.id!==s.workspaceOwnerId)return Response.json({error:"Solo titolare"},{status:403});
 try{
  const db=getDb();
  const result=await db.query(`SELECT p.id,p.title,p.version_label AS "versionLabel",p.status,
    p.superseded_at AS "supersededAt",p.superseded_at+interval '30 days' AS "expiresAt",p.purged_at AS "purgedAt",
    EXISTS(SELECT 1 FROM studio_artist_deliveries d WHERE d.owner_id=p.owner_id AND d.file_id=p.drive_file_id) AS "usedByDelivery",
    EXISTS(SELECT 1 FROM studio_artist_previews x WHERE x.owner_id=p.owner_id AND x.drive_file_id=p.drive_file_id AND x.id<>p.id AND x.purged_at IS NULL) AS "usedByPreview"
    FROM studio_artist_previews p WHERE p.owner_id=$1 ORDER BY p.updated_at DESC LIMIT 100`,[s.workspaceOwnerId]);
  return Response.json({dryRun:true,items:result.rows.map((x:{title:string;status:string;supersededAt:Date|null;expiresAt:Date|null;purgedAt:Date|null;usedByDelivery:boolean;usedByPreview:boolean})=>{
   const namedTest=/(^|[ _-])test([ _.-]|$)/i.test(x.title);
   const reason=x.purgedAt?"Già eliminata":x.status!=="withdrawn"?"Anteprima ancora attiva o in bozza":!x.supersededAt?"Non sostituita automaticamente":!namedTest?"Il nome del file non contiene TEST":x.usedByDelivery||x.usedByPreview?"File condiviso da altri materiali":null;
   return {...x,selectable:reason===null,reason:reason??"Pronta per simulazione",eligible:!!x.expiresAt&&new Date(x.expiresAt).getTime()<=Date.now()};
  })},{headers:{"Cache-Control":"no-store"}});

 }catch{return Response.json({error:"Verifica della conservazione non disponibile"},{status:503});}
}
