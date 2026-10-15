import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {drivePermission} from "@/lib/drive-archive";
import {getAuth} from "@/lib/auth";
import {getDb} from "@/lib/db";
export const runtime="nodejs";export const dynamic="force-dynamic";
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{"Cache-Control":"no-store"}});
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata"},403);
 const session=await workspaceSession(request.headers);
 if(!session)return reply({error:"Accesso richiesto"},401);
 if(session.role!=="admin"||session.user.id!==session.workspaceOwnerId)return reply({error:"Solo titolare"},403);
 try{
  const b=await request.json();if(!validId(b.id)||!validId(b.artistId)||!validId(b.trackId)||!["preview","delivery"].includes(b.kind))return reply({error:"Dati non validi"},400);
  const db=getDb(),isPreview=b.kind==="preview";
  const table=isPreview?"studio_artist_previews":"studio_artist_deliveries",fileColumn=isPreview?"drive_file_id":"file_id";
  const c=await db.connect();
  try{
   await c.query("BEGIN");
   const selected=await c.query(`SELECT ${fileColumn} AS file_id FROM ${table} WHERE id=$1 AND owner_id=$2 AND artist_id=$3 AND track_id=$4 FOR UPDATE`,[b.id,session.workspaceOwnerId,b.artistId,b.trackId]);
   if(!selected.rowCount){await c.query("ROLLBACK");return reply({error:"Materiale non trovato"},404);}
   const fileId=selected.rows[0].file_id as string;
   const uses=await c.query(`SELECT
    (SELECT count(*) FROM studio_artist_previews WHERE owner_id=$1 AND drive_file_id=$2) +
    (SELECT count(*) FROM studio_artist_deliveries WHERE owner_id=$1 AND file_id=$2) AS refs`,[session.workspaceOwnerId,fileId]);
   if(Number(uses.rows[0].refs)!==1){await c.query("ROLLBACK");return reply({error:"Il file è collegato ad altri materiali: eliminazione non consentita"},409);}
   const permission=await drivePermission(session.workspaceOwnerId);
   if(!permission.account||!permission.granted){await c.query("ROLLBACK");return reply({error:"Google Drive non autorizzato"},403);}
   const token=await getAuth().api.getAccessToken({body:{accountId:permission.account.id,userId:session.workspaceOwnerId}});
   const remote=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,{
    method:"PATCH",headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({trashed:true}),cache:"no-store",signal:AbortSignal.timeout(12000)
   });
   if(!remote.ok&&remote.status!==404){await c.query("ROLLBACK");return reply({error:"Non è stato possibile spostare il file nel cestino Drive"},502);}
   await c.query(`DELETE FROM ${table} WHERE id=$1 AND owner_id=$2 AND artist_id=$3 AND track_id=$4`,[b.id,session.workspaceOwnerId,b.artistId,b.trackId]);
   await c.query("COMMIT");return reply({deleted:true});
  }catch{await c.query("ROLLBACK");return reply({error:"Impossibile completare l'eliminazione. Verifica il cestino Drive prima di riprovare."},503);}
  finally{c.release();}
 }catch{return reply({error:"Richiesta non valida"},400);}
}
