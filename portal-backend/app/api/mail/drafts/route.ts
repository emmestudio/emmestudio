import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import {sameOrigin} from "@/lib/calendar-policy";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:Request){
 const owner=await ownerMailboxSession(req.headers);
 if(!owner)return respond({error:"Solo titolare"},403);
 try{
  const r=await getDb().query(`SELECT id,account_id AS "accountId",recipient,subject,body,attachments,updated_at AS "updatedAt"
   FROM studio_mail_drafts WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100`,[owner.workspaceOwnerId]);
  return respond({items:r.rows});
 }catch(e){
  if((e as {code?:string}).code==="42703"){
   const r=await getDb().query('SELECT id,account_id AS "accountId",recipient,subject,body,updated_at AS "updatedAt" FROM studio_mail_drafts WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100',[owner.workspaceOwnerId]);
   return respond({items:r.rows.map(row=>({...row,attachments:[]})),attachmentMigrationNeeded:true});
  }
  return respond({error:"Bozze non disponibili"},503);
 }
}
export async function POST(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return respond({error:"Origine non consentita"},403);
 const owner=await ownerMailboxSession(req.headers);
 if(!owner)return respond({error:"Solo titolare"},403);
 let b:Record<string,any>={};let recipient="";let inputAttachments:any[]=[];
 try{
  b=await req.json();
  if(b.id!==null&&b.id!==undefined&&!validId(b.id))return respond({error:"Bozza non valida"},400);
  if(typeof b.recipient!=="string"||b.recipient.length>320||typeof b.subject!=="string"||b.subject.length>300||typeof b.body!=="string"||b.body.length>40000)return respond({error:"Contenuto troppo lungo"},400);
  recipient=b.recipient.trim();
  if(recipient&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))return respond({error:"Destinatario non valido"},400);
  if(b.accountId&&!validId(b.accountId))return respond({error:"Account non valido"},400);
  if(b.accountId){
   const a=await getDb().query("SELECT 1 FROM studio_mail_accounts WHERE id=$1 AND owner_id=$2",[b.accountId,owner.workspaceOwnerId]);
   if(!a.rowCount)return respond({error:"Account non autorizzato"},403);
  }
  inputAttachments=b.attachments??[];
  if(!Array.isArray(inputAttachments)||inputAttachments.length>8)return respond({error:"Massimo otto allegati per bozza"},400);
  let total=0;
  for(const a of inputAttachments){
   if(!a||typeof a.name!=="string"||!a.name||a.name.length>180||typeof a.mimeType!=="string"||typeof a.contentBase64!=="string"||!/^[A-Za-z0-9+/]*={0,2}$/.test(a.contentBase64))return respond({error:"Allegato non valido"},400);
   const n=Buffer.from(a.contentBase64,"base64").length;total+=n;
   if(n>1536*1024||total>2*1024*1024)return respond({error:"Allegati superiori al limite di 2 MB"},413);
  }
  const r=await getDb().query(`INSERT INTO studio_mail_drafts(id,owner_id,account_id,recipient,subject,body,attachments)
   VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6,$7::jsonb)
   ON CONFLICT(id) DO UPDATE SET account_id=EXCLUDED.account_id,recipient=EXCLUDED.recipient,subject=EXCLUDED.subject,body=EXCLUDED.body,attachments=EXCLUDED.attachments,updated_at=now()
   WHERE studio_mail_drafts.owner_id=$2 RETURNING id`,[b.id??null,owner.workspaceOwnerId,b.accountId??null,recipient,b.subject.trim(),b.body,JSON.stringify(inputAttachments)]);
  return r.rowCount?respond({saved:true,id:r.rows[0].id}):respond({error:"Bozza non autorizzata"},403);
 }catch(e){
  if((e as {code?:string}).code==="42703"){
   if(inputAttachments.length)return respond({error:"Prima di salvare gli allegati occorre applicare la migrazione 024 su Neon main."},409);
   const r=await getDb().query(`INSERT INTO studio_mail_drafts(id,owner_id,account_id,recipient,subject,body)
   VALUES(COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5,$6)
   ON CONFLICT(id) DO UPDATE SET account_id=EXCLUDED.account_id,recipient=EXCLUDED.recipient,subject=EXCLUDED.subject,body=EXCLUDED.body,updated_at=now()
   WHERE studio_mail_drafts.owner_id=$2 RETURNING id`,[b.id??null,owner.workspaceOwnerId,b.accountId??null,recipient,b.subject.trim(),b.body]);
   return r.rowCount?respond({saved:true,id:r.rows[0].id,attachmentMigrationNeeded:true}):respond({error:"Bozza non autorizzata"},403);
  }
  return respond({error:"Impossibile salvare la bozza"},503);
 }
}

export async function DELETE(req:Request){
 if(!sameOrigin(req.headers.get("origin"),process.env.BETTER_AUTH_URL))return respond({error:"Origine non consentita"},403);
 const owner=await ownerMailboxSession(req.headers);if(!owner)return respond({error:"Solo titolare"},403);
 let b:{id?:string};try{b=await req.json()}catch{return respond({error:"Richiesta non valida"},400)}
 if(!validId(b.id))return respond({error:"Bozza non valida"},400);
 try{const r=await getDb().query("DELETE FROM studio_mail_drafts WHERE id=$1 AND owner_id=$2 RETURNING id",[b.id,owner.workspaceOwnerId]);return r.rowCount?respond({deleted:true}):respond({error:"Bozza non trovata"},404)}
 catch{return respond({error:"Impossibile eliminare la bozza"},503)}
}
