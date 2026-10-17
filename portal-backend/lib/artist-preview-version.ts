import "server-only";
import {getDb} from "./db";
/** Atomically assigns the next per-track version label, including existing versions. */
export async function registerTrackPreview(args:{id:string;owner:string;artistId:string;trackId:string;title:string;driveFileId:string}){
 const c=await getDb().connect();
 try{
  await c.query("BEGIN");
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended($1,9723186))",[args.owner+"/"+args.trackId]);
  const result=await c.query("INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status) VALUES($1,$2,$3,$4,$5,$6,'pending','draft') RETURNING version_label",[args.id,args.owner,args.artistId,args.trackId,args.title,args.driveFileId]);
  const label=result.rows[0].version_label as string;
  await c.query("COMMIT");return label;
 }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
