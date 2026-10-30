import {randomUUID} from 'node:crypto';
import {ownerSession} from '@/lib/owner-session';
import {getDb} from '@/lib/db';
import {sameOrigin} from '@/lib/calendar-policy';
import {newsCoverMaxBytes,newsCoverChunkBytes,imageType} from '@/lib/news-data';
export const dynamic='force-dynamic';
const reply=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const session=await ownerSession(request.headers);if(!session)return reply({error:'Accesso riservato al titolare.'},401);
 if(!sameOrigin(request.headers.get('origin'),process.env.BETTER_AUTH_URL)&&request.headers.get('origin')!==new URL(request.url).origin)return reply({error:'Origine non consentita.'},403);
 const db=getDb();
 try{
 const action=new URL(request.url).searchParams.get('action');
 if(action==='start'){
  if(Number(request.headers.get('content-length')||0)>2048)return reply({error:'Richiesta non valida.'},413);
  const raw=await request.text();if(raw.length>2048)return reply({error:'Richiesta non valida.'},413);const b=JSON.parse(raw);
  if(!Number.isSafeInteger(b.size)||b.size<=0||b.size>newsCoverMaxBytes)return reply({error:'La copertina può pesare fino a 30 MB.'},413);
  if(!['image/jpeg','image/png','image/webp'].includes(b.type))return reply({error:'Scegli un JPG, PNG o WebP.'},415);
  await db.query('DELETE FROM studio_news_cover_uploads WHERE expires_at<now()');
  const id=randomUUID();await db.query('INSERT INTO studio_news_cover_uploads(id,owner_id,total,mime_type) VALUES($1,$2,$3,$4)',[id,session.user.id,b.size,b.type]);
  return reply({id,chunkSize:newsCoverChunkBytes});
 }
 if(action==='chunk'){
  const id=request.headers.get('x-upload-id'),offset=Number(request.headers.get('x-upload-offset'));
  if(!id||!/^[0-9a-f-]{36}$/.test(id)||!Number.isSafeInteger(offset)||offset<0||offset%newsCoverChunkBytes!==0)return reply({error:'Trasferimento non valido.'},400);
  if(Number(request.headers.get('content-length')||0)>newsCoverChunkBytes)return reply({error:'Blocco troppo grande.'},413);
  const bytes=Buffer.from(await request.arrayBuffer());if(!bytes.length||bytes.length>newsCoverChunkBytes)return reply({error:'Blocco non valido.'},413);
  const row=await db.query('SELECT total,received,mime_type FROM studio_news_cover_uploads WHERE id=$1 AND owner_id=$2 AND expires_at>now()',[id,session.user.id]);const u=row.rows[0];
  if(!u)return reply({error:'Caricamento scaduto. Seleziona di nuovo il file.'},404);
  if(offset!==u.received||bytes.length!==Math.min(newsCoverChunkBytes,u.total-offset))return reply({error:'Trasferimento incompleto. Seleziona di nuovo il file.'},409);
  if(offset===0&&imageType(bytes)!==u.mime_type)return reply({error:'Il contenuto non corrisponde al formato immagine.'},415);
  const saved=await db.query('UPDATE studio_news_cover_uploads SET bytes=bytes||$3::bytea,received=received+$4 WHERE id=$1 AND owner_id=$2 AND received=$5 AND expires_at>now() RETURNING received,total',[id,session.user.id,bytes,bytes.length,offset]);
  if(!saved.rowCount)return reply({error:'Trasferimento non aggiornato. Riprova.'},409);
  return reply({received:saved.rows[0].received,complete:saved.rows[0].received===saved.rows[0].total});
 }
 return reply({error:'Operazione non valida.'},400);
 }catch{console.error('NEWS_COVER_UPLOAD_FAILED');return reply({error:'Caricamento interrotto. Riprova selezionando il file.'},503);}
}
