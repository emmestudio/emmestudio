import {randomUUID} from 'node:crypto';
import {ownerSession} from '@/lib/owner-session';
import {getDb} from '@/lib/db';
import {sameOrigin} from '@/lib/calendar-policy';
import {validateNews,imageType} from '@/lib/news-data';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 const session=await ownerSession(request.headers);if(!session)return json({error:'Accesso riservato al titolare.'},401);
 const result=await getDb().query(`SELECT id,slug,title,excerpt,category,body,status,featured,publication_date::text,related_label,related_url,media_url,version,(cover IS NOT NULL) AS has_cover FROM studio_news WHERE owner_id=$1 ORDER BY updated_at DESC`,[session.user.id]);return json({articles:result.rows});
}
async function save(request:Request){
 const session=await ownerSession(request.headers);if(!session)return json({error:'Accesso riservato al titolare.'},401);
 if(!sameOrigin(request.headers.get('origin'),process.env.BETTER_AUTH_URL)&&request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origine non consentita.'},403);
 if(Number(request.headers.get('content-length')||0)>3000000)return json({error:'Copertina troppo grande (massimo 2 MB).'},413);
 let input:Record<string,unknown>;let data;let cover:Buffer|null=null;let mime:string|null=null;
 try{const raw=await request.text();if(raw.length>3000000)return json({error:'Richiesta troppo grande.'},413);input=JSON.parse(raw);data=validateNews(input);if(input.cover_upload_id!==undefined&&(typeof input.cover_upload_id!=='string'||!/^[0-9a-f-]{36}$/.test(input.cover_upload_id)))throw Error('Caricamento non valido.');if(input.id!==undefined&&(typeof input.id!=='string'||!/^[0-9a-f-]{36}$/.test(input.id)))throw Error('Articolo non valido.');
  if(input.cover!==undefined&&input.cover!==null){if(typeof input.cover!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.cover))throw Error('Immagine non valida.');cover=Buffer.from(input.cover,'base64');mime=imageType(cover);if(!mime||cover.length>2097152)throw Error('Carica un JPG, PNG o WebP fino a 2 MB.');}
 }catch(e){return json({error:e instanceof Error?e.message:'Dati non validi.'},400);}
 const client=await getDb().connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[session.user.id+'-news']);
 if(input.cover_upload_id){const uploaded=await client.query('SELECT bytes,mime_type FROM studio_news_cover_uploads WHERE id=$1 AND owner_id=$2 AND received=total AND expires_at>now() FOR UPDATE',[input.cover_upload_id,session.user.id]);if(!uploaded.rowCount){await client.query('ROLLBACK');return json({error:'Copertina non disponibile o incompleta. Seleziona di nuovo il file.'},400);}cover=Buffer.from(uploaded.rows[0].bytes);mime=uploaded.rows[0].mime_type;}
 const existing=input.id?await client.query('SELECT id,version,(cover IS NOT NULL) AS has_cover,status,slug,first_published_at FROM studio_news WHERE id=$1 AND owner_id=$2 FOR UPDATE',[input.id,session.user.id]):null;
 if(existing&&!existing.rowCount){await client.query('ROLLBACK');return json({error:'Articolo non trovato.'},404);}
 if(existing&&existing.rows[0].version!==input.version){await client.query('ROLLBACK');return json({error:'Articolo aggiornato in un’altra finestra. Ricarica prima di salvare.'},409);}
 if(existing?.rows[0].first_published_at&&existing.rows[0].slug!==data.slug){await client.query('ROLLBACK');return json({error:'L’indirizzo di un articolo pubblicato non può essere cambiato.'},400);}
 const hasCover=cover!==null||(input.cover!==null&&existing?.rows[0].has_cover);
 if(data.status==='published'&&!hasCover){await client.query('ROLLBACK');return json({error:'Aggiungi una copertina prima di pubblicare.'},400);}
 if(data.featured&&data.status==='published')await client.query('UPDATE studio_news SET featured=false,version=version+1 WHERE owner_id=$1 AND featured=true AND id<>$2',[session.user.id,input.id||randomUUID()]);
 const id=existing?String(input.id):randomUUID();const values=[id,session.user.id,data.slug,data.title,data.excerpt,data.category,data.body,data.status,data.featured,data.publication_date,data.related_label,data.related_url,cover,mime,data.media_url||''];
 if(existing)await client.query(`UPDATE studio_news SET slug=$3,title=$4,excerpt=$5,category=$6,body=$7,status=$8,featured=$9,publication_date=$10,related_label=$11,related_url=$12,cover=CASE WHEN $16 THEN $13::bytea ELSE cover END,cover_type=CASE WHEN $16 THEN $14 ELSE cover_type END,media_url=$15,first_published_at=CASE WHEN $8='published' THEN COALESCE(first_published_at,now()) ELSE first_published_at END,version=version+1,updated_at=now() WHERE id=$1 AND owner_id=$2`,[...values,input.cover!==undefined||Boolean(input.cover_upload_id)]);
 else await client.query(`INSERT INTO studio_news(id,owner_id,slug,title,excerpt,category,body,status,featured,publication_date,related_label,related_url,cover,cover_type,media_url,first_published_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,CASE WHEN $8='published' THEN now() ELSE NULL END)`,values);
 if(input.cover_upload_id)await client.query('DELETE FROM studio_news_cover_uploads WHERE id=$1 AND owner_id=$2',[input.cover_upload_id,session.user.id]);
 await client.query('COMMIT');return json({id});
 }catch(e){await client.query('ROLLBACK');if((e as {code?:string}).code==='23505')return json({error:'Questo indirizzo è già usato. Scegline un altro.'},409);console.error('NEWS_SAVE_FAILED');return json({error:'Salvataggio non riuscito. Riprova.'},500);}finally{client.release();}
}
export const POST=save;
