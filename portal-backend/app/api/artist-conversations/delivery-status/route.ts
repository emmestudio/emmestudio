import {workspaceSession} from '@/lib/workspace-session';
import {getDb} from '@/lib/db';
import {sameOrigin} from '@/lib/calendar-policy';
import {validId} from '@/lib/task-data';
import {deliverArtistEmail} from '@/lib/artist-notifications';
export const dynamic='force-dynamic';
const out=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(r:Request){const s=await workspaceSession(r.headers);if(!s||s.role!=='admin')return out({error:'Solo amministratore'},403);try{
 const q=await getDb().query("SELECT id,recipient_email AS email,CASE WHEN state='sending' AND updated_at<now()-interval '5 minutes' THEN 'uncertain' ELSE state END AS state,error,attempts,updated_at AS date FROM studio_artist_email_outbox WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 100",[s.workspaceOwnerId]);return out({enabled:process.env.MAIL_SEND_ENABLED==='true',items:q.rows});}catch{return out({error:'Registro notifiche non disponibile'},503)}}
export async function POST(r:Request){if(!sameOrigin(r.headers.get('origin'),process.env.BETTER_AUTH_URL))return out({error:'Origine non autorizzata'},403);const s=await workspaceSession(r.headers);if(!s||s.role!=='admin')return out({error:'Solo amministratore'},403);try{const b=await r.json();if(!validId(b.id))return out({error:'Invio non valido'},400);if(process.env.MAIL_SEND_ENABLED!=='true')return out({error:'Invio email disattivato nella configurazione.'},409);if(b.confirmResend===true)await getDb().query("UPDATE studio_artist_email_outbox SET state='failed',error='Nuovo invio richiesto dopo verifica manuale',updated_at=now() WHERE owner_id=$1 AND id=$2 AND (state='uncertain' OR (state='sending' AND updated_at<now()-interval '5 minutes'))",[s.workspaceOwnerId,b.id]);await deliverArtistEmail(s.workspaceOwnerId,b.id);return out({saved:true})}catch{return out({error:'Invio non completato'},503)}}
