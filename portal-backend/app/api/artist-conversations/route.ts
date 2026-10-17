import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {sameOrigin} from "@/lib/calendar-policy";
import {canEdit} from "@/lib/access-policy";
import {notifyArtistEvent} from "@/lib/artist-notifications";
export const dynamic="force-dynamic";
const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
 const s=await workspaceSession(req.headers);if(!s)return out({error:"Accesso richiesto"},401);
 const params=new URL(req.url).searchParams,artistId=params.get("artistId"),trackId=params.get("trackId");
 if(artistId&&!validId(artistId)||trackId&&!validId(trackId))return out({error:"Filtro non valido"},400);
 try{
 const [artists,messages,events,tracks]=await Promise.all([
 getDb().query(`SELECT id,name FROM studio_artists WHERE owner_id=$1 AND deleted_at IS NULL ORDER BY name`,[s.workspaceOwnerId]),
 getDb().query(`SELECT m.id,m.artist_id AS "artistId",m.track_id AS "trackId",m.sender_role AS "senderRole",m.body,m.created_at AS "createdAt",t.data->>'title' AS "trackTitle"
 FROM studio_artist_track_messages m JOIN studio_production t ON t.id=m.track_id AND t.owner_id=m.owner_id AND t.deleted_at IS NULL
 LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id
 WHERE m.owner_id=$1 AND ($2::uuid IS NULL OR m.artist_id=$2::uuid) AND ($3::uuid IS NULL OR m.track_id=$3::uuid)
 AND (t.project_id IS NULL OR p.deleted_at IS NULL) AND COALESCE(p.artist_id,t.artist_id)=m.artist_id
 ORDER BY m.created_at DESC LIMIT 750`,[s.workspaceOwnerId,artistId,trackId]),
 getDb().query(`SELECT n.id,n.artist_id AS "artistId",n.track_id AS "trackId",n.event_type AS "eventType",n.body,n.created_at AS "createdAt",t.data->>'title' AS "trackTitle"
 FROM studio_artist_notifications n JOIN studio_production t ON t.id=n.track_id AND t.owner_id=n.owner_id AND t.deleted_at IS NULL
 LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id
 WHERE n.owner_id=$1 AND n.recipient='studio' AND n.event_type<>'message' AND ($2::uuid IS NULL OR n.artist_id=$2::uuid)
 AND ($3::uuid IS NULL OR n.track_id=$3::uuid) AND (t.project_id IS NULL OR p.deleted_at IS NULL) AND COALESCE(p.artist_id,t.artist_id)=n.artist_id
 ORDER BY n.created_at DESC LIMIT 300`,[s.workspaceOwnerId,artistId,trackId]),
 getDb().query(`SELECT t.id,COALESCE(p.artist_id,t.artist_id) AS "artistId",COALESCE(t.data->>'title','Brano') AS title FROM studio_production t LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id WHERE t.owner_id=$1 AND t.kind='track' AND t.deleted_at IS NULL AND (t.project_id IS NULL OR p.deleted_at IS NULL) ORDER BY t.created_at DESC LIMIT 800`,[s.workspaceOwnerId])
 ]);
 return out({artists:artists.rows,messages:messages.rows,events:events.rows,tracks:tracks.rows});
 }catch{return out({error:"Conversazioni non disponibili: controllare le migrazioni 018 e 019"},503)}
}
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return out({error:"Origine non autorizzata"},403);
 const s=await workspaceSession(req.headers);if(!s)return out({error:"Accesso richiesto"},401);
 if(!canEdit(s.role))return out({error:"Ruolo di sola lettura"},403);
 try{
 const b=await req.json();if(!validId(b.artistId)||!validId(b.trackId)||typeof b.body!=="string"||!b.body.trim()||b.body.trim().length>3000)return out({error:"Messaggio non valido"},400);
 const allowed=await getDb().query(`SELECT 1 FROM studio_production t LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id
 JOIN studio_artists a ON a.id=COALESCE(p.artist_id,t.artist_id) AND a.owner_id=t.owner_id
 WHERE t.owner_id=$1 AND t.id=$2 AND t.kind='track' AND t.deleted_at IS NULL AND a.id=$3 AND a.deleted_at IS NULL AND (t.project_id IS NULL OR p.deleted_at IS NULL)`,[s.workspaceOwnerId,b.trackId,b.artistId]);
 if(!allowed.rowCount)return out({error:"Brano non autorizzato"},403);
 const r=await getDb().query(`INSERT INTO studio_artist_track_messages(owner_id,artist_id,track_id,sender_role,body) VALUES($1,$2,$3,'studio',$4) RETURNING id`,[s.workspaceOwnerId,b.artistId,b.trackId,b.body.trim()]);
 await notifyArtistEvent(s.workspaceOwnerId,b.artistId,b.trackId,"artist","message","Nuovo messaggio dallo studio");
 return out({created:true,id:r.rows[0].id},201);
 }catch{return out({error:"Messaggio non inviato"},503)}
}
