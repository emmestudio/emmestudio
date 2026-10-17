import {ownerMailboxSession} from "@/lib/mail-access";
import {getDb} from "@/lib/db";
import {listGmailHeaders} from "@/lib/gmail-readonly";
import {listArubaHeaders} from "@/lib/aruba-readonly";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=25;
export async function GET(req:Request){
 const session=await ownerMailboxSession(req.headers);
 if(!session)return Response.json({error:"Accesso riservato al titolare"},{status:403});
 const query=new URL(req.url).searchParams;const provider=query.get("provider");const folder=query.get("folder")??"inbox";
 if(!["inbox","sent"].includes(folder))return Response.json({error:"Cartella non valida"},{status:400});
 if(provider!==null&&!["gmail","aruba"].includes(provider))return Response.json({error:"Filtro non valido"},{status:400});
 try{
  const r=await getDb().query("SELECT id,provider,address FROM studio_mail_accounts WHERE owner_id=$1 AND ($2::text IS NULL OR provider=$2) ORDER BY provider",[session.workspaceOwnerId,provider]);
  const responses=await Promise.allSettled(r.rows.map(async (a:{id:string;provider:string;address:string})=>{
   if(a.provider==="gmail")return listGmailHeaders(session.workspaceOwnerId,a.id,folder==="sent"?"SENT":"INBOX");
   if(a.provider==="aruba"&&folder==="sent")return [];
   if(a.provider==="aruba"&&a.address.toLowerCase()===(process.env.ARUBA_MAIL_USERNAME??"").trim().toLowerCase())return listArubaHeaders(a.id);
   throw Error("Casella Aruba non configurata");
  }));
  const messages=responses.flatMap(x=>x.status==="fulfilled"?x.value:[]).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).slice(0,30);
  const failures=responses.flatMap((x,i)=>x.status==="rejected"?[{provider:r.rows[i].provider,address:r.rows[i].address,error:x.reason instanceof Error?x.reason.message:"Lettura non disponibile"}]:[]);
  return Response.json({messages,failures,readOnly:true,folder,arubaSentSupported:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Posta in arrivo non disponibile"},{status:503,headers:{"Cache-Control":"no-store"}});}
}
