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
   ORDER BY superseded_at ASC LIMIT 15`);
  let removed=0,failed=0;
  for(const row of due.rows){
   try{
    const {account,granted}=await drivePermission(row.owner_id);
    if(!account||!granted){failed++;continue;}
    const token=await getAuth().api.getAccessToken({body:{accountId:account.id,userId:row.owner_id}});
    const result=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?fields=id,trashed`,{
     method:"PATCH",headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":"application/json"},
     body:JSON.stringify({trashed:true}),cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    // A missing remote object is already unavailable and may be marked as purged.
    if(!result.ok&&result.status!==404){failed++;continue;}
    const saved=await db.query(`UPDATE studio_artist_previews SET purged_at=now(),updated_at=now()
      WHERE id=$1 AND owner_id=$2 AND status='withdrawn' AND purged_at IS NULL
       AND superseded_at<=now()-interval '30 days'`,[row.id,row.owner_id]);
    if(saved.rowCount)removed++;
   }catch{failed++;}
  }
  return reply({examined:due.rowCount,removed,failed});
 }catch{return reply({error:"Pulizia non completata"},503);}
}
