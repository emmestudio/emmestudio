import {workspaceSession} from "@/lib/workspace-session";
import {artistSession} from "@/lib/artist-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
export const dynamic="force-dynamic";
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{"Cache-Control":"no-store"}});
async function context(h:Headers){
 const team=await workspaceSession(h);
 if(team?.role==="admin"&&team.user.id===team.workspaceOwnerId)return {owner:team.workspaceOwnerId,recipient:"studio" as const,artistId:null};
 const artist=await artistSession(h);
 return artist?{owner:artist.ownerId,recipient:"artist" as const,artistId:artist.artistId}:null;
}
export async function GET(r:Request){
 const s=await context(r.headers);if(!s)return reply({error:"Accesso non autorizzato"},401);
 try{
  const q=await getDb().query(`SELECT n.id,n.event_type AS "eventType",n.body,n.track_id AS "trackId",
  n.created_at AS "createdAt",n.read_at AS "readAt",p.data->>'title' AS "trackTitle"
  FROM studio_artist_notifications n
  JOIN studio_production p ON p.owner_id=n.owner_id AND p.id=n.track_id AND p.deleted_at IS NULL
  LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
  WHERE n.owner_id=$1 AND n.recipient=$2
  AND ($3::uuid IS NULL OR n.artist_id=$3::uuid)
  AND COALESCE(j.artist_id,p.artist_id)=n.artist_id
  AND (p.project_id IS NULL OR j.deleted_at IS NULL)
  ORDER BY n.created_at DESC LIMIT 100`,[s.owner,s.recipient,s.artistId]);
  return reply({items:q.rows,unread:q.rows.filter((x:{readAt:Date|null})=>!x.readAt).length});
 }catch{return reply({error:"Notifiche non disponibili: verifica migrazione 019"},503);}
}
export async function PATCH(r:Request){
 if(!sameOrigin(r.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non valida"},403);
 const s=await context(r.headers);if(!s)return reply({error:"Accesso non autorizzato"},401);
 try{
  const b=await r.json();if(!validId(b.id))return reply({error:"Notifica non valida"},400);
  const q=await getDb().query(`UPDATE studio_artist_notifications SET read_at=COALESCE(read_at,now())
   WHERE id=$1 AND owner_id=$2 AND recipient=$3 AND ($4::uuid IS NULL OR artist_id=$4::uuid)
   RETURNING id`,[b.id,s.owner,s.recipient,s.artistId]);
  return q.rowCount?reply({saved:true}):reply({error:"Notifica inesistente"},404);
 }catch{return reply({error:"Aggiornamento non riuscito"},503);}
}
