import {getDb} from "@/lib/db";
import {drivePermission} from "@/lib/drive-archive";
import {getAuth} from "@/lib/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return reply({error:"Non autorizzato"},401);
 try{
  const db=getDb();
  const exists=await db.query("SELECT to_regclass('public.studio_artist_previews') IS NOT NULL AS present");
  if(!exists.rows[0]?.present)return reply({skipped:"Installare prima le tabelle"},503);
  const col=await db.query("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='studio_artist_previews' AND column_name='superseded_at') AS present");
  if(!col.rows[0]?.present)return reply({skipped:"Applicare migrazione 016"},503);
  const due=await db.query(`SELECT owner_id,id,drive_file_id FROM studio_artist_previews
   WHERE superseded_at IS NOT NULL AND superseded_at<=now()-interval '30 days' AND purged_at IS NULL
    AND status='withdrawn'
    AND NOT EXISTS (SELECT 1 FROM studio_artist_deliveries d WHERE d.owner_id=studio_artist_previews.owner_id AND d.file_id=studio_artist_previews.drive_file_id)
    AND NOT EXISTS (SELECT 1 FROM studio_artist_previews p2 WHERE p2.owner_id=studio_artist_previews.owner_id AND p2.drive_file_id=studio_artist_previews.drive_file_id AND p2.id<>studio_artist_previews.id AND p2.purged_at IS NULL AND p2.superseded_at IS NULL)
   ORDER BY superseded_at ASC LIMIT 3`);
  if(new URL(request.url).searchParams.get("dryRun")==="1")return reply({dryRun:true,eligible:due.rowCount,files:due.rows.map((r:{id:string})=>({previewId:r.id}))});
  let removed=0,failed=0;
  for(const row of due.rows){
   const c=await db.connect();
   try{
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,9723187))",[row.owner_id+'/'+row.drive_file_id]);
    const still=await c.query(`SELECT p.id FROM studio_artist_previews p WHERE p.owner_id=$1 AND p.id=$2 AND p.drive_file_id=$3 AND p.status='withdrawn' AND p.purged_at IS NULL AND p.superseded_at<=now()-interval '30 days'
     AND NOT EXISTS(SELECT 1 FROM studio_artist_deliveries d WHERE d.owner_id=p.owner_id AND d.file_id=p.drive_file_id)
     AND NOT EXISTS(SELECT 1 FROM studio_artist_previews x WHERE x.owner_id=p.owner_id AND x.drive_file_id=p.drive_file_id AND x.id<>p.id AND x.purged_at IS NULL AND x.superseded_at IS NULL) FOR UPDATE OF p`,[row.owner_id,row.id,row.drive_file_id]);
    if(!still.rowCount){await c.query('ROLLBACK');continue;}
    const {account,granted}=await drivePermission(row.owner_id);
    if(!account||!granted){await c.query('ROLLBACK');failed++;continue;}
    const token=await getAuth().api.getAccessToken({body:{accountId:account.id,userId:row.owner_id}});
    const result=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?fields=id,trashed`,{method:'PATCH',headers:{Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({trashed:true}),cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!result.ok&&result.status!==404)throw Error('Drive retention failed');
    await c.query("UPDATE studio_artist_previews SET purged_at=now(),updated_at=now() WHERE id=$1 AND owner_id=$2",[row.id,row.owner_id]);await c.query('COMMIT');removed++;
   }catch{await c.query('ROLLBACK');failed++;}finally{c.release();}
  }
  console.info("[artist-preview-retention] run",JSON.stringify({examined:due.rowCount,removed,failed,completedAt:new Date().toISOString()}));
  return reply({examined:due.rowCount,removed,failed});
 }catch(e){console.error("[artist-preview-retention] failure",e instanceof Error?e.message:"unknown");return reply({error:"Pulizia non completata"},503);}
}
