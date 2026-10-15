import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {drivePermission} from "@/lib/drive-archive";
import {getAuth} from "@/lib/auth";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non consentita"},403);
 const s=await workspaceSession(req.headers);
 if(!s||s.role!=="admin"||s.user.id!==s.workspaceOwnerId)return reply({error:"Solo titolare"},403);
 try{
  const b=await req.json();
  if(!validId(b.previewId)||b.confirm!=="SIMULA SCADENZA TEST")return reply({error:"Conferma non valida"},400);
  const db=getDb(),c=await db.connect();
  try{
   await c.query("BEGIN");
   const r=await c.query(`SELECT id,title,drive_file_id FROM studio_artist_previews
    WHERE owner_id=$1 AND id=$2 AND status='withdrawn'
     AND superseded_at IS NOT NULL AND purged_at IS NULL FOR UPDATE`,[s.workspaceOwnerId,b.previewId]);
   const p=r.rows[0];
   if(!p||!/(^|[ _-])test([ _.-]|$)/i.test(p.title)){await c.query("ROLLBACK");return reply({error:"Solo anteprime ritirate con TEST nel nome del file"},409);}
   const refs=await c.query(`SELECT
    (SELECT count(*) FROM studio_artist_deliveries WHERE owner_id=$1 AND file_id=$2) AS deliveries,
    (SELECT count(*) FROM studio_artist_previews WHERE owner_id=$1 AND drive_file_id=$2 AND id<>$3 AND purged_at IS NULL) AS previews`,[s.workspaceOwnerId,p.drive_file_id,p.id]);
   if(Number(refs.rows[0].deliveries)>0||Number(refs.rows[0].previews)>0){await c.query("ROLLBACK");return reply({error:"File ancora referenziato: test bloccato"},409);}
   const permission=await drivePermission(s.workspaceOwnerId);
   if(!permission.granted||!permission.account){await c.query("ROLLBACK");return reply({error:"Drive non autorizzato"},403);}
   const token=await getAuth().api.getAccessToken({body:{accountId:permission.account.id,userId:s.workspaceOwnerId}});
   const remote=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(p.drive_file_id)}?fields=id,trashed`,{method:"PATCH",headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({trashed:true}),cache:"no-store",signal:AbortSignal.timeout(12000)});
   if(!remote.ok&&remote.status!==404){await c.query("ROLLBACK");return reply({error:"Drive non ha confermato lo spostamento nel cestino"},502);}
   await c.query("UPDATE studio_artist_previews SET purged_at=now(),updated_at=now() WHERE owner_id=$1 AND id=$2",[s.workspaceOwnerId,p.id]);
   await c.query("COMMIT");return reply({tested:true,trashed:true,previewId:p.id});
  }catch{await c.query("ROLLBACK");return reply({error:"Test non completato; controlla Drive prima di riprovare"},503);}finally{c.release();}
 }catch{return reply({error:"Dati non validi"},400);}
}
