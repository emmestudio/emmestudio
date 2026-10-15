import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import {sameOrigin} from "@/lib/calendar-policy";
export const dynamic="force-dynamic";
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store"}});
export async function GET(request:Request){
 const s=await ownerMailboxSession(request.headers);
 if(!s)return reply({error:"Accesso riservato al titolare"},403);
 try{
  const r=await getDb().query("SELECT id,provider,address,display_name AS \"displayName\",status FROM studio_mail_accounts WHERE owner_id=$1 ORDER BY provider,address",[s.workspaceOwnerId]);
  return reply({accounts:r.rows});
 }catch{return reply({error:"Archivio posta non predisposto: eseguire la migrazione 020 nell'ambiente di test"},503);}
}
export async function POST(request:Request){
 if(!sameOrigin(request.headers.get("origin"),process.env.BETTER_AUTH_URL))return reply({error:"Origine non autorizzata"},403);
 const s=await ownerMailboxSession(request.headers);
 if(!s)return reply({error:"Accesso riservato al titolare"},403);
 try{
  const b=await request.json();
  if(!["gmail","aruba"].includes(b.provider)||typeof b.address!=="string"||!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(b.address.trim())||b.address.length>254)return reply({error:"Casella email non valida"},400);
  const address=b.address.trim().toLowerCase();
  const displayName=typeof b.displayName==="string"?b.displayName.trim().slice(0,100):"";
  const result=await getDb().query(`INSERT INTO studio_mail_accounts(owner_id,provider,address,display_name,status)
   VALUES($1,$2,$3,$4,'not_connected')
   ON CONFLICT(owner_id,address) DO UPDATE SET display_name=EXCLUDED.display_name,updated_at=now()
   RETURNING id,provider,address,display_name AS "displayName",status`,[s.workspaceOwnerId,b.provider,address,displayName]);
  return reply({account:result.rows[0],notice:"Indirizzo registrato. Nessuna connessione o autorizzazione email è stata effettuata."},201);
 }catch{return reply({error:"Salvataggio della casella non riuscito"},503);}
}
