import {newsCoverResponse} from '@/lib/news-cover-response';
import {getDb} from '@/lib/db';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const result=await getDb().query(`SELECT n.cover,n.cover_type FROM studio_news n JOIN "user" u ON u.id=n.owner_id WHERE n.slug=$1 AND n.status='published' AND n.publication_date<=CURRENT_DATE AND lower(u.email)=lower($2)`,[slug,process.env.PORTAL_OWNER_EMAIL]);const row=result.rows[0];return row?.cover?newsCoverResponse(new Uint8Array(row.cover),row.cover_type,false):new Response(null,{status:404});}
