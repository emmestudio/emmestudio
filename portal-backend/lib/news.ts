import 'server-only';
import {cache} from 'react';
import {getDb} from './db';
export const publicNewsFields="n.id,n.slug,n.title,n.excerpt,n.category,n.body,n.featured,n.publication_date::text,n.related_label,n.related_url,n.updated_at,n.media_url,(n.cover IS NOT NULL) AS has_cover";
export const publishedNews=cache(async(slug?:string)=>{
 const result=await getDb().query(`SELECT ${publicNewsFields} FROM studio_news n JOIN "user" u ON u.id=n.owner_id WHERE lower(u.email)=lower($1) AND n.status='published' AND n.publication_date<=CURRENT_DATE ${slug?'AND n.slug=$2':''} ORDER BY n.featured DESC,n.publication_date DESC,n.created_at DESC LIMIT 200`,slug?[process.env.PORTAL_OWNER_EMAIL,slug]:[process.env.PORTAL_OWNER_EMAIL]);return result.rows;
});
export function coverUrl(slug:string){return '/api/public/news/'+encodeURIComponent(slug)+'/cover';}
