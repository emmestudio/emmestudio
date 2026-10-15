import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {normalizeEmail} from "@/lib/access-policy";
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
  return reply({access:r.rows[0]??{email:"",enabled:false}});
 }catch{return reply({error:"Accesso artista non disponibile: verifica migrazione 014."},503);}
}
export async function PUT(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata."},403);
 try{
  const s=await workspaceSession(request.headers);
  if(!s)return reply({error:"Accesso richiesto."},401);
  if(s.role!=="admin")return reply({error:"Solo amministratore."},403);
  const body=await request.json();
  if(!validId(body.artistId)||typeof body.email!=="string"||typeof body.enabled!=="boolean")return reply({error:"Dati non validi."},400);
  const email=normalizeEmail(body.email);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return reply({error:"Email non valida."},400);
  const client=await getDb().connect();
  try{
   await client.query("BEGIN");
   const a=await client.query("SELECT id FROM studio_artists WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE",[s.workspaceOwnerId,body.artistId]);
   if(!a.rowCount){await client.query("ROLLBACK");return reply({error:"Artista non trovato."},404);}
   const owner=await client.query('SELECT email FROM "user" WHERE id=$1',[s.workspaceOwnerId]);
   if(email===normalizeEmail(owner.rows[0]?.email??"")){await client.query("ROLLBACK");return reply({error:"Usa un'email distinta dall'amministratore."},400);}
   const team=await client.query("SELECT 1 FROM portal_members WHERE owner_id=$1 AND lower(email)=$2 AND active=true",[s.workspaceOwnerId,email]);
   if(team.rowCount){await client.query("ROLLBACK");return reply({error:"Email già assegnata al team."},409);}
   await client.query(`INSERT INTO studio_artist_access(owner_id,artist_id,email,enabled)
     VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,artist_id)
     DO UPDATE SET email=excluded.email,enabled=excluded.enabled,updated_at=now()`,[s.workspaceOwnerId,body.artistId,email,body.enabled]);
   await client.query("COMMIT");
   return reply({saved:true,enabled:body.enabled});
  }catch(e){
   await client.query("ROLLBACK");
   if((e as {code?:string}).code==="23505")return reply({error:"Email già associata a un altro artista."},409);
   throw e;
  }finally{client.release();}
 }catch{return reply({error:"Modifica accesso non completata."},503);}
}
