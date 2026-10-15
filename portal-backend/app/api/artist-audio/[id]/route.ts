import {artistSession} from "@/lib/artist-session";
import {getDb} from "@/lib/db";
import {getAuth} from "@/lib/auth";
import {drivePermission} from "@/lib/drive-archive";
import {validId} from "@/lib/task-data";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"};
const fail=(status:number)=>new Response(null,{status,headers:noStore});
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 const {id}=await context.params;
 if(!validId(id))return fail(404);
 try{
  const session=await artistSession(request.headers);
  if(!session)return fail(401);
  const r=await getDb().query(`SELECT x.drive_file_id FROM studio_artist_previews x
    JOIN studio_production p ON p.id=x.track_id AND p.owner_id=x.owner_id
    LEFT JOIN studio_projects j ON j.id=p.project_id AND j.owner_id=p.owner_id
    WHERE x.id=$1 AND x.owner_id=$2 AND x.artist_id=$3
    AND x.status IN ('ready','approved','revision_requested')
    AND p.deleted_at IS NULL AND (p.project_id IS NULL OR j.deleted_at IS NULL)
    AND COALESCE(j.artist_id,p.artist_id)=x.artist_id`,
   [id,session.ownerId,session.artistId]);
  const fileId=r.rows[0]?.drive_file_id;
  if(!fileId)return fail(404);
  const {account,granted}=await drivePermission(session.ownerId);
  if(!granted||!account)return fail(503);
  const token=await getAuth().api.getAccessToken({body:{accountId:account.id,userId:session.ownerId}});
  const auth={Authorization:`Bearer ${token.accessToken}`};
  const metaResponse=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,mimeType,size,trashed`,{headers:auth,cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!metaResponse.ok)return fail(502);
  const meta=await metaResponse.json() as {mimeType?:string;size?:string;trashed?:boolean};
  const total=Number(meta.size);
  // Only explicitly prepared MP3 preview copies, max 20 MB.
  if(meta.trashed||meta.mimeType!=="audio/mpeg"||!Number.isSafeInteger(total)||total<=0||total>20*1024*1024)return fail(415);
  const range=request.headers.get("range");
  let start=0,end=total-1;
  if(range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(range);
   if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...noStore,"Content-Range":`bytes */${total}`}});
   if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return fail(416);start=Math.max(0,total-suffix);}
   else{start=Number(match[1]);end=match[2]?Number(match[2]):total-1;}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=total||end<start)return fail(416);
   end=Math.min(end,total-1);
  }
  // Bounded chunks: do not materialize full originals.
  end=Math.min(end,start+1024*1024-1);
  const media=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,{
   headers:{...auth,Range:`bytes=${start}-${end}`},cache:"no-store",signal:AbortSignal.timeout(15000)
  });
  if(media.status!==206||!media.body||media.headers.get("content-range")!==`bytes ${start}-${end}/${total}`)return fail(502);
  return new Response(media.body,{status:206,headers:{...noStore,"Content-Type":"audio/mpeg","Accept-Ranges":"bytes","Content-Range":`bytes ${start}-${end}/${total}`,"Content-Length":String(end-start+1),"Content-Disposition":"inline"}});
 }catch{return fail(503);}
}
