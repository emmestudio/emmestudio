import {reconcileArtistDriveAccess,syncArtistDriveAccess} from "@/lib/drive-archive";
import {artistSharedDriveKey,DriveError,driveFolderUrl} from "@/lib/drive-data";
import {normalizedArtistEmail,validArtistEmail} from "@/lib/artist-access-policy";
import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {normalizeEmail} from "@/lib/access-policy";
export const maxDuration=180;
export const dynamic="force-dynamic";
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 try{
  const s=await workspaceSession(request.headers);
  if(!s)return reply({error:"Accesso richiesto."},401);
  if(s.role!=="admin")return reply({error:"Solo amministratore."},403);
  const artistId=new URL(request.url).searchParams.get("artistId");
  if(!validId(artistId))return reply({error:"Artista non valido."},400);
  const r=await getDb().query("SELECT email,enabled FROM studio_artist_access WHERE owner_id=$1 AND artist_id=$2",[s.workspaceOwnerId,artistId]);
  const access=r.rows[0]??{email:"",enabled:false};
  const folder=access.enabled?(await getDb().query("SELECT folder_id FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2 AND state='ready' AND error=''",[s.workspaceOwnerId,artistSharedDriveKey(artistId)])).rows[0]:null;
  return reply({access,driveUrl:folder?driveFolderUrl(folder.folder_id):null});
 }catch{return reply({error:"Accesso artista non disponibile: verifica migrazione 014."},503);}
}
export async function PUT(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata."},403);
 try{
  const s=await workspaceSession(request.headers);
  if(!s)return reply({error:"Accesso richiesto."},401);
  if(s.role!=="admin")return reply({error:"Solo amministratore."},403);
  const body=await request.json();
  if(!validId(body?.artistId)||typeof body.email!=="string"||typeof body.enabled!=="boolean")return reply({error:"Dati non validi."},400);
  const email=normalizedArtistEmail(body.email);
  if(!validArtistEmail(email))return reply({error:"Email non valida."},400);
  const client=await getDb().connect();
  try{
   await client.query("BEGIN");
   const a=await client.query("SELECT id FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",[s.workspaceOwnerId,body.artistId]);
   if(!a.rowCount){await client.query("ROLLBACK");return reply({error:"Artista non trovato."},404);}
   const owner=await client.query('SELECT email FROM "user" WHERE id=$1',[s.workspaceOwnerId]);
   if(email===normalizeEmail(owner.rows[0]?.email??"")){await client.query("ROLLBACK");return reply({error:"Usa un'email distinta dall'amministratore."},400);}
   const team=await client.query("SELECT 1 FROM portal_members WHERE owner_id=$1 AND lower(email)=$2 AND active=true",[s.workspaceOwnerId,email]);
   if(team.rowCount){await client.query("ROLLBACK");return reply({error:"Email già assegnata al team."},409);}
   const previous=(await client.query("SELECT email FROM studio_artist_access WHERE owner_id=$1 AND artist_id=$2",[s.workspaceOwnerId,body.artistId])).rows[0];
   await client.query(`INSERT INTO studio_artist_access(owner_id,artist_id,email,enabled)
     VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,artist_id)
     DO UPDATE SET email=excluded.email,enabled=excluded.enabled,updated_at=now()`,[s.workspaceOwnerId,body.artistId,email,body.enabled]);
   if(!body.enabled || (previous && previous.email!==email)){
    await reconcileArtistDriveAccess(client,s.workspaceOwnerId,body.artistId,null);
    await client.query("UPDATE studio_drive_folders SET error=$3 WHERE owner_id=$1 AND subject_key=$2",[s.workspaceOwnerId,artistSharedDriveKey(body.artistId),"Condivisione da sincronizzare"]);
   }
   await client.query("COMMIT");
  }catch(e){
   await client.query("ROLLBACK");
   if((e as {code?:string}).code==="23505")return reply({error:"Email già associata a un altro artista."},409);
   throw e;
  }finally{client.release();}
  if(!body.enabled)return reply({saved:true,enabled:false,driveUrl:null});
  try{
   const folderId=await syncArtistDriveAccess(s.workspaceOwnerId,body.artistId);
   return reply({saved:true,enabled:true,driveUrl:folderId?driveFolderUrl(folderId):null});
  }catch(e){
   return reply({saved:true,enabled:true,driveUrl:null,driveError:e instanceof DriveError?e.message:"Sincronizzazione Drive non completata. Riprova."});
  }
 }catch(e){return e instanceof DriveError?reply({error:e.message},e.status):reply({error:"Modifica accesso non completata."},503);}
}
