import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await workspaceSession(request.headers);
 if(!session)return Response.json({error:"Accesso richiesto"},{status:401});
 if(session.role!=="admin")return Response.json({error:"Solo amministratore"},{status:403});
 const artistId=new URL(request.url).searchParams.get("artistId"),trackId=new URL(request.url).searchParams.get("trackId");
 if(!validId(artistId)||!validId(trackId))return Response.json({error:"Identificativi non validi"},{status:400});
 try{
  const r=await getDb().query(`SELECT e.id,e.preview_id AS "previewId",e.event_type AS "eventType",
   e.notes,e.occurred_at AS "occurredAt",p.title,p.version_label AS "versionLabel"
   FROM studio_artist_preview_events e
   JOIN studio_artist_previews p ON p.id=e.preview_id AND p.owner_id=e.owner_id
   WHERE e.owner_id=$1 AND p.artist_id=$2 AND p.track_id=$3
   ORDER BY e.occurred_at DESC LIMIT 200`,[session.workspaceOwnerId,artistId,trackId]);
  return Response.json({items:r.rows},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Cronologia non disponibile"},{status:503});}
}
