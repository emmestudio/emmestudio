import {notifyArtistEvent} from "@/lib/artist-notifications";
import {workspaceSession} from "@/lib/workspace-session";
import {artistSession} from "@/lib/artist-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
async function context(headers:Headers){
 const team=await workspaceSession(headers);
 if(team?.role==="admin"&&team.user.id===team.workspaceOwnerId)return {owner:team.workspaceOwnerId,role:"studio" as const,artistId:null};
 const artist=await artistSession(headers);
 return artist?{owner:artist.ownerId,role:"artist" as const,artistId:artist.artistId}:null;
}
async function allowed(owner:string,artistId:string,trackId:string){
 const r=await getDb().query(`SELECT 1 FROM studio_production p
 LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
 JOIN studio_artists a ON a.id=COALESCE(j.artist_id,p.artist_id) AND a.owner_id=p.owner_id
 WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='track' AND p.deleted_at IS NULL AND (p.project_id IS NULL OR j.deleted_at IS NULL)
 AND a.id=$3 AND a.deleted_at IS NULL`,[owner,trackId,artistId]);
 return Boolean(r.rowCount);
}
export async function GET(request:Request){
 const auth=await context(request.headers);
 if(!auth)return response({error:"Accesso non consentito"},401);
 const params=new URL(request.url).searchParams;
 const trackId=params.get("trackId"),artistId=auth.artistId??params.get("artistId");
 if(!validId(trackId)||!validId(artistId))return response({error:"Identificativi non validi"},400);
 try{
  if(!await allowed(auth.owner,artistId,trackId))return response({error:"Brano non autorizzato"},403);
  const r=await getDb().query(`SELECT id, sender_role AS "senderRole",body,created_at AS "createdAt"
   FROM studio_artist_track_messages WHERE owner_id=$1 AND artist_id=$2 AND track_id=$3 ORDER BY created_at ASC LIMIT 250`,[auth.owner,artistId,trackId]);
  return response({items:r.rows});
 }catch{return response({error:"Messaggi non disponibili. Verifica la migrazione 018."},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return response({error:"Origine non valida"},403);
 const auth=await context(request.headers);
 if(!auth)return response({error:"Accesso non consentito"},401);
 try{
  const b=await request.json();
  const artistId=auth.artistId??b.artistId;
  if(!validId(artistId)||!validId(b.trackId)||typeof b.body!=="string"||!b.body.trim()||b.body.trim().length>3000)return response({error:"Messaggio non valido (massimo 3000 caratteri)"},400);
  if(!await allowed(auth.owner,artistId,b.trackId))return response({error:"Brano non autorizzato"},403);
  // Artists may post only while an active preview is published on this track.
  if(auth.role==="artist"){
   const published=await getDb().query(`SELECT 1 FROM studio_artist_previews WHERE owner_id=$1 AND artist_id=$2 AND track_id=$3
     AND status IN ('ready','approved','revision_requested') LIMIT 1`,[auth.owner,artistId,b.trackId]);
   if(!published.rowCount)return response({error:"Conversazione non ancora disponibile"},403);
  }
  const result=await getDb().query(`INSERT INTO studio_artist_track_messages(owner_id,artist_id,track_id,sender_role,body)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,[auth.owner,artistId,b.trackId,auth.role,b.body.trim()]);
  await notifyArtistEvent(auth.owner,artistId,b.trackId,auth.role==="studio"?"artist":"studio","message","Nuovo messaggio sul brano");
  return response({created:true,id:result.rows[0].id},201);
 }catch{return response({error:"Messaggio non inviato"},503);}
}
