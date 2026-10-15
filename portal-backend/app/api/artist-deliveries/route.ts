import {notifyArtistEvent} from "@/lib/artist-notifications";
import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {sameOrigin} from "@/lib/calendar-policy";
export const dynamic="force-dynamic";
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 const session=await workspaceSession(request.headers);
 if(!session)return reply({error:"Accesso richiesto"},401);
 if(session.role!=="admin")return reply({error:"Solo amministratore"},403);
 const a=new URL(request.url).searchParams.get("artistId");
 if(!validId(a))return reply({error:"Artista non valido"},400);
 try{
 const r=await getDb().query('SELECT id,track_id AS "trackId",title,file_name AS "fileName",enabled FROM studio_artist_deliveries WHERE owner_id=$1 AND artist_id=$2 ORDER BY updated_at DESC',[session.workspaceOwnerId,a]);
 return reply({items:r.rows});
 }catch{return reply({error:"Archivio consegne non disponibile"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non valida"},403);
 const session=await workspaceSession(request.headers);
 if(!session)return reply({error:"Accesso richiesto"},401);
 if(session.role!=="admin")return reply({error:"Solo amministratore"},403);
 try{
 const b=await request.json();
 if(!validId(b.id)||!validId(b.artistId)||!validId(b.trackId)||typeof b.title!=="string"||!b.title.trim()||b.title.length>300||typeof b.fileName!=="string"||!b.fileName.trim()||b.fileName.length>255||typeof b.fileId!=="string"||!/^[a-zA-Z0-9_-]{5,200}$/.test(b.fileId))return reply({error:"Dati non validi"},400);
 const r=await getDb().query(`INSERT INTO studio_artist_deliveries(id,owner_id,artist_id,track_id,title,file_id,file_name)
 SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS (
 SELECT 1 FROM studio_production p LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
 JOIN studio_artists a ON a.owner_id=p.owner_id AND a.id=COALESCE(j.artist_id,p.artist_id)
 WHERE p.owner_id=$2 AND p.id=$4 AND p.kind='track' AND p.deleted_at IS NULL AND a.id=$3 AND a.deleted_at IS NULL AND (p.project_id IS NULL OR j.deleted_at IS NULL))
 RETURNING id`,[b.id,session.workspaceOwnerId,b.artistId,b.trackId,b.title.trim(),b.fileId,b.fileName.trim()]);
 return r.rowCount?reply({created:true},201):reply({error:"Artista e brano non corrispondono"},400);
 }catch{return reply({error:"Consegna non registrata"},503);}
}
export async function PATCH(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non valida"},403);
 const session=await workspaceSession(request.headers);
 if(!session)return reply({error:"Accesso richiesto"},401);
 if(session.role!=="admin")return reply({error:"Solo amministratore"},403);
 try{
 const b=await request.json();
 if(!validId(b.id)||typeof b.enabled!=="boolean")return reply({error:"Dati non validi"},400);
 const r=await getDb().query('UPDATE studio_artist_deliveries SET enabled=$3,updated_at=now() WHERE owner_id=$1 AND id=$2 RETURNING id',[session.workspaceOwnerId,b.id,b.enabled]);
 if(r.rowCount&&b.enabled){const v=await getDb().query("SELECT artist_id,track_id FROM studio_artist_deliveries WHERE id=$1 AND owner_id=$2",[b.id,session.workspaceOwnerId]);if(v.rows[0])await notifyArtistEvent(session.workspaceOwnerId,v.rows[0].artist_id,v.rows[0].track_id,"artist","delivery","Nuova consegna disponibile per il download");}
 return r.rowCount?reply({saved:true}):reply({error:"Consegna inesistente"},404);
 }catch{return reply({error:"Aggiornamento fallito"},503);}
}
