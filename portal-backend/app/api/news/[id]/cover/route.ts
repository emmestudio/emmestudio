import {newsCoverResponse} from '@/lib/news-cover-response';
import {ownerSession} from '@/lib/owner-session';import {getDb} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const session=await ownerSession(request.headers);if(!session)return new Response(null,{status:401});const {id}=await params;if(!/^[0-9a-f-]{36}$/.test(id))return new Response(null,{status:404});const result=await getDb().query('SELECT cover,cover_type FROM studio_news WHERE id=$1 AND owner_id=$2',[id,session.user.id]);const row=result.rows[0];return row?.cover?newsCoverResponse(new Uint8Array(row.cover),row.cover_type,true):new Response(null,{status:404});}
