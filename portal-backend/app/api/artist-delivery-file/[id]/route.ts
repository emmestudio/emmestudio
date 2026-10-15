import {artistSession} from "@/lib/artist-session";
import {drivePermission} from "@/lib/drive-archive";
import {getDb} from "@/lib/db";
import {getAuth} from "@/lib/auth";
import {validId} from "@/lib/task-data";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cache={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const fail=(s:number)=>new Response(null,{status:s,headers:cache});
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params;
 if(!validId(id))return fail(404);
 try{
 const session=await artistSession(request.headers);
 if(!session)return fail(401);
 const result=await getDb().query(`SELECT d.file_id,d.file_name FROM studio_artist_deliveries d
 JOIN studio_production p ON p.owner_id=d.owner_id AND p.id=d.track_id AND p.deleted_at IS NULL
 LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id
 WHERE d.id=$1 AND d.owner_id=$2 AND d.artist_id=$3 AND d.enabled=true
 AND COALESCE(j.artist_id,p.artist_id)=d.artist_id
 AND (p.project_id IS NULL OR j.deleted_at IS NULL)`,[id,session.ownerId,session.artistId]);
 const item=result.rows[0];if(!item)return fail(404);
 const {account,granted}=await drivePermission(session.ownerId);
 if(!account||!granted)return fail(503);
 const token=await getAuth().api.getAccessToken({body:{accountId:account.id,userId:session.ownerId}});
 const headers={Authorization:`Bearer ${token.accessToken}`};
 const idEncoded=encodeURIComponent(item.file_id as string);
 const meta=await fetch(`https://www.googleapis.com/drive/v3/files/${idEncoded}?fields=id,mimeType,size,trashed`,{headers,cache:"no-store",signal:AbortSignal.timeout(10000)});
 if(!meta.ok)return fail(502);
 const m=await meta.json() as {trashed?:boolean;size?:string;mimeType?:string};
 const size=Number(m.size);
 if(m.trashed||!Number.isSafeInteger(size)||size<=0||size>1024*1024*1024||m.mimeType?.startsWith("application/vnd.google-apps."))return fail(415);
 const response=await fetch(`https://www.googleapis.com/drive/v3/files/${idEncoded}?alt=media`,{headers,cache:"no-store",signal:AbortSignal.timeout(30000)});
 if(!response.ok||!response.body||response.headers.get("content-length")!==String(size))return fail(502);
 const safeName=String(item.file_name).replace(/[\r\n"\\]/g,"_").slice(0,255);
 return new Response(response.body,{headers:{...cache,"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="${safeName}"`,"Content-Length":String(size)}});
 }catch{return fail(503);}
}
