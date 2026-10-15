import {workspaceSession} from "@/lib/workspace-session";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
import {getDb} from "@/lib/db";
import {drivePermission,syncDriveSubject} from "@/lib/drive-archive";
import {getAuth} from "@/lib/auth";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
const LIMIT=4*1024*1024;
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return response({error:"Origine non autorizzata"},403);
 const session=await workspaceSession(request.headers);
 if(!session)return response({error:"Accesso richiesto"},401);
 if(session.role!=="admin")return response({error:"Solo amministratore"},403);
 const size=Number(request.headers.get("content-length")||0);
 if(size>LIMIT+8192)return response({error:"File troppo grande: massimo 4 MB per il caricamento diretto"},413);
 let uploaded:string|undefined;
 try{
  const data=await request.formData();
  const artistId=data.get("artistId"),trackId=data.get("trackId"),kind=data.get("kind");
  const file=data.get("file");
  if(typeof artistId!=="string"||!validId(artistId)||typeof trackId!=="string"||!validId(trackId)||(kind!=="preview"&&kind!=="delivery")||!(file instanceof File))return response({error:"Dati mancanti"},400);
  if(!file.size||file.size>LIMIT)return response({error:"File non valido o superiore a 4 MB"},413);
  const name=file.name.replace(/[\\/\r\n]/g,"_").trim().slice(0,180);
  const ext=name.toLowerCase().split(".").pop();
  if(kind==="preview"&&!(ext==="mp3"&&(file.type==="audio/mpeg"||file.type==="audio/mp3"||file.type==="")))return response({error:"Le anteprime devono essere MP3"},415);
  if(kind==="delivery"&&!["mp3","wav","zip","pdf"].includes(ext||""))return response({error:"Formato non supportato"},415);
  const match=await getDb().query(`SELECT p.id FROM studio_production p LEFT JOIN studio_projects j ON j.owner_id=p.owner_id AND j.id=p.project_id JOIN studio_artists a ON a.owner_id=p.owner_id AND a.id=COALESCE(j.artist_id,p.artist_id) AND a.deleted_at IS NULL WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='track' AND p.deleted_at IS NULL AND a.id=$3 AND (p.project_id IS NULL OR j.deleted_at IS NULL)`,[session.workspaceOwnerId,trackId,artistId]);
  if(!match.rowCount)return response({error:"Artista e brano non corrispondono"},400);
  await syncDriveSubject(session.workspaceOwnerId,"artist",artistId);
  const folder=await getDb().query("SELECT folder_id FROM studio_drive_folders WHERE owner_id=$1 AND subject_key=$2 AND state='ready'",[session.workspaceOwnerId,`artist/${artistId}/music`]);
  if(!folder.rows[0])return response({error:"Cartella Drive non pronta"},503);
  const permission=await drivePermission(session.workspaceOwnerId);
  if(!permission.granted||!permission.account)return response({error:"Drive non autorizzato"},403);
  const token=await getAuth().api.getAccessToken({body:{accountId:permission.account.id,userId:session.workspaceOwnerId}});
  const boundary="emme"+crypto.randomUUID().replaceAll("-","");
  const metadata=JSON.stringify({name,mimeType:kind==="preview"?"audio/mpeg":file.type||"application/octet-stream",parents:[folder.rows[0].folder_id],description:`Emme Studio / ${kind} / ${trackId}`});
  const head=new TextEncoder().encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${kind==="preview"?"audio/mpeg":file.type||"application/octet-stream"}\r\n\r\n`);
  const tail=new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
  const payload=new Blob([head,await file.arrayBuffer(),tail]);
  const upload=await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size",{method:"POST",headers:{Authorization:`Bearer ${token.accessToken}`,"Content-Type":`multipart/related; boundary=${boundary}`},body:payload,signal:AbortSignal.timeout(30000),cache:"no-store"});
  if(!upload.ok)return response({error:"Google Drive non ha accettato il file. Verifica i permessi."},502);
  const result=await upload.json() as {id?:string;size?:string};
  if(!result.id||!/^[-_a-zA-Z0-9]{5,200}$/.test(result.id))return response({error:"Drive non ha restituito un ID valido"},502);
  uploaded=result.id;
  const id=crypto.randomUUID();
  if(kind==="preview"){
   await getDb().query("INSERT INTO studio_artist_previews(id,owner_id,artist_id,track_id,title,drive_file_id,version_label,status) VALUES($1,$2,$3,$4,$5,$6,$7,'draft')",[id,session.workspaceOwnerId,artistId,trackId,name,result.id,"Mix v01"]);
  }else{
   await getDb().query("INSERT INTO studio_artist_deliveries(id,owner_id,artist_id,track_id,title,file_id,file_name,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,false)",[id,session.workspaceOwnerId,artistId,trackId,name,result.id,name]);
  }
  return response({created:true,id,kind},201);
 }catch{
  return response({error:uploaded?"File caricato su Drive, ma registrazione non completata. Controlla l'archivio per evitare duplicati.":"Caricamento non riuscito"},503);
 }
}
