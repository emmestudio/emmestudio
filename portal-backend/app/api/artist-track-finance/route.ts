import {workspaceSession} from "@/lib/workspace-session";
import {getDb} from "@/lib/db";
import {validId} from "@/lib/task-data";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 const session=await workspaceSession(request.headers);
 if(!session)return Response.json({error:"Accesso richiesto"},{status:401});
 if(session.role!=="admin")return Response.json({error:"Solo amministratore"},{status:403});
 const trackId=new URL(request.url).searchParams.get("trackId");
 if(!validId(trackId))return Response.json({error:"Brano non valido"},{status:400});
 try{
 const r=await getDb().query(`SELECT p.id,p.project_id AS "projectId",
 (SELECT q.amount FROM studio_quotes q WHERE q.owner_id=p.owner_id AND q.project_id=p.id LIMIT 1) AS "trackQuote",
 (SELECT q.amount FROM studio_quotes q WHERE q.owner_id=p.owner_id AND q.project_id=p.project_id LIMIT 1) AS "projectQuote",
 (SELECT COALESCE(SUM(pay.amount),0) FROM studio_payments pay WHERE pay.owner_id=p.owner_id AND pay.project_id=p.id AND pay.void_reason IS NULL) AS "trackPaid",
 (SELECT COALESCE(SUM(pay.amount),0) FROM studio_payments pay WHERE pay.owner_id=p.owner_id AND pay.project_id=p.project_id AND pay.void_reason IS NULL) AS "projectPaid"
 FROM studio_production p WHERE p.owner_id=$1 AND p.id=$2 AND p.kind='track' AND p.deleted_at IS NULL`,[session.workspaceOwnerId,trackId]);
 if(!r.rowCount)return Response.json({error:"Brano non trovato"},{status:404});
 const x=r.rows[0];const separate=x.trackQuote!==null&&x.trackQuote!==undefined;
 const amount=separate?Number(x.trackQuote):x.projectQuote===null?null:Number(x.projectQuote);
 const paid=separate?Number(x.trackPaid):Number(x.projectPaid);
 return Response.json({amount,paid:amount===null?null:paid,balance:amount===null?null:Math.max(0,amount-paid),scope:separate?"track":x.projectQuote!==null?"project":null,warning:!separate&&x.projectQuote!==null?"Importo relativo all’intero progetto, non esclusivamente a questo brano":null},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"Riepilogo economico non disponibile"},{status:503});}
}
