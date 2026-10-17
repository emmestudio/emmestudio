import {get} from "@vercel/blob";
import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){
 const s=await workspaceSession(req.headers);
 if(!s)return Response.json({error:"Accesso richiesto"},{status:401});
 const {id}=await ctx.params;
 if(!validId(id))return Response.json({error:"Identificativo non valido"},{status:400});
 try{
  const r=await getDb().query(`SELECT a.blob_path,a.mime_type,a.filename FROM studio_artist_message_attachments a
    JOIN studio_artist_track_messages m ON m.id=a.message_id AND m.owner_id=a.owner_id AND m.artist_id=a.artist_id AND m.track_id=a.track_id
    JOIN studio_production t ON t.id=a.track_id AND t.owner_id=a.owner_id AND t.deleted_at IS NULL
    LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id
    WHERE a.id=$1 AND a.owner_id=$2 AND (t.project_id IS NULL OR p.deleted_at IS NULL)
    AND COALESCE(p.artist_id,t.artist_id)=a.artist_id`,[id,s.workspaceOwnerId]);
  if(!r.rowCount)return Response.json({error:"Allegato non disponibile"},{status:404});
  const a=r.rows[0],blob=await get(a.blob_path,{access:"private"});
  if(!blob?.stream)return Response.json({error:"File non disponibile"},{status:404});
  const safe=String(a.filename).replace(/["\\\r\n]/g,"_");
  return new Response(blob.stream,{headers:{"Content-Type":a.mime_type,"Content-Disposition":`inline; filename="${safe}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch{return Response.json({error:"Allegato non disponibile"},{status:503})}
}
