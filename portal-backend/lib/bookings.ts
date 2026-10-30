import 'server-only';
import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';import {getDb} from './db';import {sendArtistGmail} from './artist-gmail';import {sendGmail,sendAruba} from './mail-outgoing';import {arubaMailReadiness} from './aruba-mail-config';import {bookingDate} from './booking-data';
export const bookingBase='https://portal.emmestudioproduction.it';
export function signBooking(value:string){return createHmac('sha256',process.env.BETTER_AUTH_SECRET!).update('booking:'+value).digest('hex');}
export function bookingToken(id:string){return id+'.'+signBooking(id);}
export function verifyBooking(token:string){if(typeof token!=='string'||token.length!==101)return null;const [id,mac]=token.split('.');if(!/^[0-9a-f-]{36}$/.test(id))return null;const expected=signBooking(id);return mac&&mac.length===expected.length&&timingSafeEqual(Buffer.from(mac),Buffer.from(expected))?id:null;}
export async function bookingOwner(){return (await getDb().query(`SELECT id FROM "user" WHERE lower(email)=lower($1) AND "emailVerified"=true`,[process.env.PORTAL_OWNER_EMAIL])).rows[0]?.id as string|undefined;}
export async function queueBookingMail(db:{query:Function},b:Record<string,any>,message:string,notifyOwner=true){
 const link=bookingBase+'/prenota/richiesta#'+bookingToken(b.id);const summary=b.service+'\n'+bookingDate(b.start_at)+' — '+bookingDate(b.end_at)+'\nRiferimento: '+b.id.slice(0,8);
 await db.query('INSERT INTO studio_booking_mail(id,booking_id,recipient,subject,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.id,b.email,'Emme Studio — '+message.split('\n')[0].slice(0,150), message+'\n\n'+summary+'\n\nLeggi gli aggiornamenti e rispondi tramite il tuo collegamento personale (non inoltrarlo):\n'+link+'\n\nPer assistenza: emmestudio.mixinfo@gmail.com']);
 if(notifyOwner)await db.query('INSERT INTO studio_booking_mail(id,booking_id,recipient,subject,body) VALUES($1,$2,$3,$4,$5)',[randomUUID(),b.id,'emmestudio.mixinfo@gmail.com','Prenotazioni — '+message.split('\n')[0].slice(0,150),message+'\n\n'+summary+'\n'+b.name+' · '+b.email+' · '+b.phone+'\n\nGestisci dal portale: '+bookingBase+'/prenotazioni']);
}
export async function deliverBookingMail(owner:string,id?:string){
 const db=getDb();const client=await db.connect();let sent=0,pending=0;
 try{await client.query('BEGIN');const jobs=await client.query(`SELECT m.* FROM studio_booking_mail m JOIN studio_bookings b ON b.id=m.booking_id WHERE b.owner_id=$1 AND m.sent_at IS NULL ${id?'AND b.id=$2':''} ORDER BY m.created_at LIMIT 4 FOR UPDATE OF m SKIP LOCKED`,id?[owner,id]:[owner]);
 for(const job of jobs.rows){try{
 const accounts=(await db.query(`SELECT id,provider FROM studio_mail_accounts WHERE owner_id=$1 ORDER BY CASE WHEN provider='aruba' THEN 0 ELSE 1 END`,[owner])).rows;let done=false;
 for(const account of accounts){try{const mail={to:job.recipient,subject:job.subject,body:job.body,attachments:[]};if(account.provider==='aruba'&&arubaMailReadiness().configured){await sendAruba(owner,account.id,mail);done=true;break;}if(account.provider==='gmail'){await sendGmail(owner,account.id,mail);done=true;break;}}catch{}}
 if(!done){const result=await sendArtistGmail(owner,job.recipient,job.subject,job.body);if(!result.sent)throw Error('MAIL_NOT_CONFIGURED');}
 await client.query("UPDATE studio_booking_mail SET sent_at=now(),attempts=attempts+1,last_error='' WHERE id=$1",[job.id]);sent++;
 }catch{await client.query("UPDATE studio_booking_mail SET attempts=attempts+1,last_error='Invio non riuscito: verifica la casella collegata e riprova.' WHERE id=$1",[job.id]);pending++;}}
 await client.query('COMMIT');return {sent,pending};
 }catch{await client.query('ROLLBACK');return {sent,pending:1};}finally{client.release();}
}
export async function bookingConflict(db:{query:Function},owner:string,id:string,start:string,end:string){return Boolean((await db.query("SELECT id FROM studio_bookings WHERE owner_id=$1 AND id<>$2 AND status='confirmed' AND start_at<$4::timestamptz+interval '15 minutes' AND end_at>$3::timestamptz-interval '15 minutes' LIMIT 1",[owner,id,start,end])).rows.length);}
