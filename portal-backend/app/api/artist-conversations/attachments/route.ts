import {randomUUID} from "node:crypto";
import {put} from "@vercel/blob";
import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
import {sameOrigin} from "@/lib/calendar-policy";
import {canEdit} from "@/lib/access-policy";
export const dynamic="force-dynamic";
const MAX=10*1024*1024;
const ALLOWED=new Set(["application/pdf","image/png","image/jpeg","image/webp"]);
const out=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return out({error:"Origine non autorizzata"},403);
 const s=await workspaceSession(req.headers);
 if(!s)return out({error:"Accesso richiesto"},401);
 if(!canEdit(s.role))return out({error:"Ruolo di sola lettura"},403);
 const contentLength=Number(req.headers.get("content-length")||0);
 if(contentLength>MAX+65536)return out({error:"File troppo grande (massimo 10 MB)"},413);
 try{
  const form=await req.formData(),messageId=form.get("messageId"),file=form.get("file");
  if(typeof messageId!=="string"||!validId(messageId)||!(file instanceof File))return out({error:"Richiesta non valida"},400);
  if(!ALLOWED.has(file.type)||file.size<=0||file.size>MAX)return out({error:"Solo PDF o immagini PNG, JPEG, WebP fino a 10 MB"},400);
  const result=await getDb().query(`SELECT m.artist_id,m.track_id FROM studio_artist_track_messages m
   JOIN studio_production t ON t.id=m.track_id AND t.owner_id=m.owner_id AND t.deleted_at IS NULL
   LEFT JOIN studio_projects p ON p.id=t.project_id AND p.owner_id=t.owner_id
   JOIN studio_artists a ON a.id=m.artist_id AND a.owner_id=m.owner_id AND a.deleted_at IS NULL
   WHERE m.id=$1 AND m.owner_id=$2 AND m.sender_role='studio' AND (t.project_id IS NULL OR p.deleted_at IS NULL)
   AND COALESCE(p.artist_id,t.artist_id)=m.artist_id`,[messageId,s.workspaceOwnerId]);
  if(!result.rowCount)return out({error:"Messaggio non autorizzato"},403);
  const magic=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const match=file.type==="application/pdf"?String.fromCharCode(...magic.slice(0,5))==="%PDF-"
    :file.type==="image/png"?magic.slice(0,8).every((v,i)=>v===[137,80,78,71,13,10,26,10][i])
    :file.type==="image/jpeg"?magic[0]===255&&magic[1]===216&&magic[2]===255
    :file.type==="image/webp"?String.fromCharCode(...magic.slice(0,4))==="RIFF"&&String.fromCharCode(...magic.slice(8,12))==="WEBP":false;
  if(!match)return out({error:"Il contenuto non corrisponde al formato dichiarato"},400);
  const id=randomUUID(),name=file.name.slice(0,180).replace(/[\\/\x00-\x1f]/g,"_");
  const pathname=`artist-private/${s.workspaceOwnerId}/${id}`;
  const stored=await put(pathname,file,{access:"private",contentType:file.type,addRandomSuffix:false});
  try {
   await getDb().query(`INSERT INTO studio_artist_message_attachments
    (id,owner_id,artist_id,track_id,message_id,blob_path,filename,mime_type,byte_size)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[id,s.workspaceOwnerId,result.rows[0].artist_id,result.rows[0].track_id,messageId,stored.pathname,name,file.type,file.size]);
  } catch(e) {
   const {del}=await import("@vercel/blob");
   await del(stored.url).catch(()=>{});
   throw e;
  }
  return out({id,filename:name,mimeType:file.type,size:file.size},201);
 }catch{return out({error:"Caricamento non riuscito; verificare storage e migrazione 020"},503)}
}
