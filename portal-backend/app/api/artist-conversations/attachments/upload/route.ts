import {handleUpload,type HandleUploadBody} from '@vercel/blob/client';
import {get,head,del} from '@vercel/blob';
import {workspaceSession} from '@/lib/workspace-session';
import {sameOrigin} from '@/lib/calendar-policy';
import {canEdit} from '@/lib/access-policy';
import {validId} from '@/lib/task-data';
import {getDb} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowed=['application/pdf','image/png','image/jpeg','image/webp'];
export async function POST(request:Request){
 try{
 const body=await request.json() as HandleUploadBody;
 const result=await handleUpload({body,request,
 onBeforeGenerateToken:async(pathname,payload)=>{
  if(!sameOrigin(request.headers.get('origin'),process.env.BETTER_AUTH_URL))throw Error('Origine non autorizzata');
  const s=await workspaceSession(request.headers);if(!s||!canEdit(s.role))throw Error('Accesso non autorizzato');
  const id=pathname.replace('message-attachments/','');if(pathname!==`message-attachments/${id}`||!validId(id))throw Error('Percorso non valido');
  const p=JSON.parse(payload||'{}');if(!validId(p.messageId)||typeof p.filename!=='string')throw Error('Allegato non valido');
  const m=await getDb().query(`SELECT m.artist_id,m.track_id FROM studio_artist_track_messages m JOIN studio_production t ON t.owner_id=m.owner_id AND t.id=m.track_id JOIN studio_artists a ON a.owner_id=m.owner_id AND a.id=m.artist_id LEFT JOIN studio_projects j ON j.owner_id=t.owner_id AND j.id=t.project_id WHERE m.owner_id=$1 AND m.id=$2 AND m.sender_role='studio' AND t.deleted_at IS NULL AND a.deleted_at IS NULL AND (j.id IS NULL OR j.deleted_at IS NULL) AND COALESCE(j.artist_id,t.artist_id)=m.artist_id`,[s.workspaceOwnerId,p.messageId]);
  if(!m.rowCount)throw Error('Messaggio non autorizzato');
  return {allowedContentTypes:allowed,maximumSizeInBytes:10*1024*1024,validUntil:Date.now()+10*60*1000,allowOverwrite:false,addRandomSuffix:true,tokenPayload:JSON.stringify({owner:s.workspaceOwnerId,id,messageId:p.messageId,artistId:m.rows[0].artist_id,trackId:m.rows[0].track_id,filename:p.filename.slice(0,180).replace(/[\\/\x00-\x1f]/g,'_')})};
 },
 onUploadCompleted:async({blob,tokenPayload})=>{
  const p=JSON.parse(tokenPayload||'{}');if(!validId(p.id)||!validId(p.messageId)||!blob.pathname.startsWith('message-attachments/'+p.id))throw Error('Upload non valido');
  const meta=await head(blob.url);if(!allowed.includes(meta.contentType)||meta.size<=0||meta.size>10*1024*1024){await del(blob.url);throw Error('Formato o dimensione non validi');}
  const file=await get(blob.url,{access:'private'});if(!file?.stream)throw Error('File non disponibile');
  const reader=file.stream.getReader();let prefix=new Uint8Array();try{while(prefix.length<12){const part=await reader.read();if(part.done)break;const merged=new Uint8Array(prefix.length+Math.min(part.value.length,12-prefix.length));merged.set(prefix);merged.set(part.value.slice(0,12-prefix.length),prefix.length);prefix=merged;}}finally{await reader.cancel().catch(()=>{});}
  const magic=meta.contentType==='application/pdf'?String.fromCharCode(...prefix.slice(0,5))==='%PDF-':meta.contentType==='image/png'?prefix.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>prefix[i]===v):meta.contentType==='image/jpeg'?prefix[0]===255&&prefix[1]===216&&prefix[2]===255:String.fromCharCode(...prefix.slice(0,4))==='RIFF'&&String.fromCharCode(...prefix.slice(8,12))==='WEBP';
  if(!magic){await del(blob.url);throw Error('Contenuto non corrispondente al formato');}
  const saved=await getDb().query(`INSERT INTO studio_artist_message_attachments(id,owner_id,artist_id,track_id,message_id,blob_path,filename,mime_type,byte_size) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9 WHERE EXISTS(SELECT 1 FROM studio_artist_track_messages WHERE owner_id=$2 AND id=$5 AND artist_id=$3 AND track_id=$4) ON CONFLICT(id) DO NOTHING RETURNING id`,[p.id,p.owner,p.artistId,p.trackId,p.messageId,blob.pathname,p.filename,meta.contentType,meta.size]);
  if(!saved.rowCount){const exists=await getDb().query('SELECT id FROM studio_artist_message_attachments WHERE owner_id=$1 AND id=$2',[p.owner,p.id]);if(!exists.rowCount)await del(blob.url);}
 }});
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Caricamento non completato: verifica formato, dimensione e accesso al messaggio.'},{status:400})}
}
