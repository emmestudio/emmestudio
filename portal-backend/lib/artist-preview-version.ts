import "server-only";
import {getDb} from "./db";
/** Atomically assigns the next per-track version label, including existing versions. */
export async function registerTrackPreview(args:{id:string;owner:string;artistId:string;trackId:string;title:string;driveFileId:string}){
 const c=await getDb().connect();
 try{
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,9723186))",[args.owner+"/"+args.trackId]);
  const n=await c.query(`SELECT COALESCE(MAX(NULLIF(substring(version_label from 'v([0-9]+)$'),'')::integer),0) AS n,COUNT(*)::integer AS count FROM studio_artist_previews WHERE owner_id=$1 AND track_id=$2`,[args.owner,args.trackId]);
  const next=Math.max(Number(n.rows[0]?.n)||0,Number(n.rows[0]?.count)||0)+1;
  const label="Mix v"+String(next).padStart(2,"0");
  await c.query("INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status) VALUES($1,$2,$3,$4,$5,$6,$7,'draft')",[args.id,args.owner,args.artistId,args.trackId,args.title,args.driveFileId,label]);
  await c.query("COMMIT");return label;
 }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
