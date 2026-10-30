import {newsArtwork} from '@/lib/news-share-image';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;const result=await newsArtwork(slug,true);if(result.ok&&new URL(request.url).searchParams.has('download'))result.headers.set('Content-Disposition','attachment; filename="emme-news-'+slug+'.png"');return result;}
