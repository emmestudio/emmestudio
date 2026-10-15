import {createHmac,timingSafeEqual} from "node:crypto";
import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {drivePermission,syncDriveSubject} from "@/lib/drive-archive";
import {getAuth} from "@/lib/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const CHUNK=2*1024*1024,MAX=1024*1024*1024;
const reply=(d:unknown,s=200)=>Response.json(d,{status:s,headers:{"Cache-Control":"no-store"}});
type Ticket={url:string;owner:string;artistId:string;trackId:string;kind:"preview"|"delivery";name:string;total:number;expires:number};
function sign(p:Ticket){const raw=Buffer.from(JSON.stringify(p)).toString("base64url");const mac=createHmac("sha256",process.env.BETTER_AUTH_SECRET!).update(raw).digest("base64url");return raw+"."+mac;}
function verify(token:string):Ticket|null{
 if(token.length>6000||!token.includes("."))return null;
 const [raw,mac]=token.split(".");
 const signature=createHmac("sha256",process.env.BETTER_AUTH_SECRET!).update(raw).digest("base64url");
 const a=Buffer.from(mac||""),b=Buffer.from(signature);
 if(a.length!==b.length||!timingSafeEqual(a,b))return null;
 try{const p=JSON.parse(Buffer.from(raw,"base64url").toString()) as Ticket;const url=new URL(p.url);if(url.protocol!=="https:"||url.hostname!=="www.googleapis.com"||!url.pathname.startsWith("/upload/drive/v3/files")||p.expires<Date.now()||p.total<=0||p.total>MAX)return null;return p;}catch{return null;}
}
async function ownerToken(owner:string){
 const permission=await drivePermission(owner);
 if(!permission.granted||!permission.account)throw Error("Drive non autorizzato");
 const token=await getAuth().api.getAccessToken({body:{accountId:permission.account.id,userId:owner}});
 return token.accessToken;
}
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata"},403);
 const s=await workspaceSession(request.headers);
 if(!s)return reply({error:"Accesso richiesto"},401);
 if(s.role!=="admin")return reply({error:"Solo amministratore"},403);
 const action=new URL(request.url).searchParams.get("action");
 try{
 if(action==="start"){
  const b=await request.json();
  if(!validId(b.artistId)||!validId(b.trackId)||(b.kind!=="preview"&&b.kind!=="delivery")||typeof b.name!=="string"||typeof b.total!=="number"||!Number.isSafeInteger(b.total)||b.total<1||b.total>MAX)return reply({error:"Dati non validi o file superiore a 1 GB"},400);
  const name=b.name.replace(/[\\/\r\n]/g,"_").trim().slice(0,180),ext=name.toLowerCase().split(".").pop();
  if(!name||(b.kind==="preview"?ext!=="mp3"||b.total>20*1024*1024:!["mp3","wav","zip","pdf"].includes(ext||"")))return reply({error:"Formato o dimensione non supportati"},415);
  const r=await getDb().query(`SELECT p.id FROM studio_production p LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id JOIN studio_artists a ON a.owner_id=p.owner_id AND a.id=COALESCE(j.artist_id,p.artist_id) AND a.deleted_at IS NULL WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='track' AND p.deleted_at IS NULL AND a.id=$3 AND (p.project_id IS NULL OR j.deleted_at IS NULL)`,[s.workspaceOwnerId,b.trackId,b.artistId]);
  if(!r.rowCount)return reply({error:"Brano e artista non corrispondono"},400);
  await syncDriveSubject(s.workspaceOwnerId,"artist",b.artistId);
  const f=await getDb().query("SELECT folder_id FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2 AND state='ready'",[s.workspaceOwnerId,`artist/${b.artistId}/music`]);
  if(!f.rows[0])return reply({error:"Archivio Drive non pronto"},503);
  const mime=b.kind==="preview"?"audio/mpeg":ext==="wav"?"audio/wav":ext==="zip"?"application/zip":ext==="pdf"?"application/pdf":"audio/mpeg";
  const token=await ownerToken(s.workspaceOwnerId);
  const start=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,mimeType",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":mime,"X-Upload-Content-Length":String(b.total)},body:JSON.stringify({name,parents:[f.rows[0].folder_id],mimeType:mime,description:`Emme Studio / ${b.kind} / ${b.trackId}`}),redirect:"error",signal:AbortSignal.timeout(12000)});
  const location=start.headers.get("location");if(!start.ok||!location)return reply({error:"Drive non ha avviato il trasferimento"},502);
  const url=new URL(location);if(url.protocol!=="https:"||url.hostname!=="www.googleapis.com")return reply({error:"Sessione di trasferimento non valida"},502);
  return reply({ticket:sign({url:location,owner:s.workspaceOwnerId,artistId:b.artistId,trackId:b.trackId,kind:b.kind,name,total:b.total,expires:Date.now()+60*60*1000}),chunkSize:CHUNK});
 }
 if(action==="chunk"){
  const ticket=request.headers.get("x-upload-ticket");const p=ticket?verify(ticket):null;
  if(!p||p.owner!==s.workspaceOwnerId)return reply({error:"Sessione upload non valida o scaduta"},403);
  const offset=Number(request.headers.get("x-upload-offset"));
  if(!Number.isSafeInteger(offset)||offset<0||offset>=p.total||offset%CHUNK!==0)return reply({error:"Posizione blocco non valida"},400);
  const bytes=await request.arrayBuffer(),len=bytes.byteLength;
  if(!len||len>CHUNK||len!==Math.min(CHUNK,p.total-offset))return reply({error:"Dimensione blocco non valida"},413);
  const token=await ownerToken(s.workspaceOwnerId);
  const last=offset+len===p.total;
  const upload=await fetch(p.url,{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Length":String(len),"Content-Range":`bytes ${offset}-${offset+len-1}/${p.total}`},body:bytes,redirect:"manual",signal:AbortSignal.timeout(30000)});
  if(upload.status===308)return reply({uploaded:offset+len,complete:false});
  if(!upload.ok)return reply({error:"Blocco non accettato da Drive, interrompi il trasferimento"},502);
  if(!last)return reply({error:"Drive ha terminato prima della fine del file"},502);
  const data=await upload.json() as{id?:string;size?:string};
  if(!data.id||!/^[A-Za-z0-9_-]{5,200}$/.test(data.id)||Number(data.size)!==p.total)return reply({error:"Dimensione del file su Drive non verificata"},502);
  const id=crypto.randomUUID();
  if(p.kind==="preview")await getDb().query("INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status) VALUES($1,$2,$3,$4,$5,$6,'Mix v01','draft')",[id,p.owner,p.artistId,p.trackId,p.name,data.id]);
  else await getDb().query("INSERT INTO studio_artist_deliveries(id,owner_id,artist_id,track_id,title,file_id,file_name,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,false)",[id,p.owner,p.artistId,p.trackId,p.name,data.id,p.name]);
  return reply({complete:true,id});
 }
 return reply({error:"Operazione non valida"},400);
 }catch{return reply({error:"Caricamento interrotto. Se Drive ha già ricevuto il file, verifica l'archivio prima di ripetere."},503);}
}
