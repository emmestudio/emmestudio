import {workspaceSession} from '@/lib/workspace-session';
import {validId} from '@/lib/task-data';
import {prepareBookingQuotes} from '@/lib/booking-quotes';
import {listLedger} from '@/lib/finance';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const s=await workspaceSession(request.headers);if(!s||s.role!=='admin')return new Response(null,{status:403});
 const id=new URL(request.url).searchParams.get('id');if(!validId(id))return new Response(null,{status:400});
 try{const q=(await listLedger(s.workspaceOwnerId)).quotes.find(q=>q.projectId===id);if(!q)return new Response(null,{status:404});const prepared=await prepareBookingQuotes(s.workspaceOwnerId,[{id,version:q.version}]);const file=prepared.files[0];return new Response(new Uint8Array(file.pdf),{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="'+file.name+'"','Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'}});}catch{return Response.json({error:'Preventivo non disponibile. Aggiorna la pagina.'},{status:409});}
}
