import {artistSession} from "@/lib/artist-session";
import {conversationWorks} from "@/lib/artist-conversation-work";
import {get} from "@vercel/blob";
import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){
 const s=await workspaceSession(req.headers);
 const artist=s?null:await artistSession(req.headers);
 if(!s&&!artist)return Response.json({error:"Accesso richiesto"},{status:401});
 const {id}=await ctx.params;
 if(!validId(id))return Response.json({error:"Identificativo non valido"},{status:400});
 try{
  const r=await getDb().query(`SELECT a.blob_path,a.mime_type,a.filename FROM studio_artist_message_attachments a
    JOIN studio_artist_track_messages m ON m.id=a.message_id AND m.owner_id=a.owner_id AND m.artist_id=a.artist_id AND m.track_id=a.track_id
    JOIN (${conversationWorks}) w ON w.id=a.track_id AND w.owner_id=a.owner_id AND w.artist_id=a.artist_id
    JOIN studio_artists artist ON artist.id=a.artist_id AND artist.owner_id=a.owner_id AND artist.deleted_at IS NULL
    WHERE a.id=$1 AND a.owner_id=$2 AND ($3::uuid IS NULL OR (a.artist_id=$3 AND m.sender_role='studio'))`,[id,s?.workspaceOwnerId??artist?.ownerId,artist?.artistId??null]);
  if(!r.rowCount)return Response.json({error:"Allegato non disponibile"},{status:404});
  const a=r.rows[0],blob=await get(a.blob_path,{access:"private"});
  if(!blob?.stream)return Response.json({error:"File non disponibile"},{status:404});
  const safe=String(a.filename).replace(/["\\\r\n]/g,"_");
  return new Response(blob.stream,{headers:{"Content-Type":a.mime_type,"Content-Disposition":`inline; filename="${safe}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch{return Response.json({error:"Allegato non disponibile"},{status:503})}
}
