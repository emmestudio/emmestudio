import {artistSession} from "@/lib/artist-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {sameOrigin} from "@/lib/calendar-policy";
export const dynamic="force-dynamic";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata."},403);
 try{
  const session=await artistSession(request.headers);
  if(!session)return reply({error:"Accesso artista richiesto."},401);
  const body=await request.json();
  if(!validId(body.previewId)||!["approve","revision"].includes(body.action))return reply({error:"Richiesta non valida."},400);
  const feedback=typeof body.feedback==="string"?body.feedback.trim():"";
  if(feedback.length>4000||(body.action==="revision"&&!feedback))return reply({error:"Descrivi le modifiche richieste (massimo 4000 caratteri)."},400);
  const result=await getDb().query(`UPDATE studio_artist_previews x
   SET status=$4,feedback=$5,updated_at=now()
   FROM studio_production p
   LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
   WHERE x.id=$1 AND x.owner_id=$2 AND x.artist_id=$3
   AND x.track_id=p.id AND x.owner_id=p.owner_id
   AND p.deleted_at IS NULL AND (p.project_id IS NULL OR j.deleted_at IS NULL)
   AND COALESCE(j.artist_id,p.artist_id)=x.artist_id
   AND x.status IN ('ready','revision_requested')
   RETURNING x.id`,
   [body.previewId,session.ownerId,session.artistId,body.action==="approve"?"approved":"revision_requested",feedback]);
  return result.rowCount?reply({saved:true}):reply({error:"Anteprima non disponibile o già approvata."},409);
 }catch{return reply({error:"Feedback non salvato."},503);}
}
