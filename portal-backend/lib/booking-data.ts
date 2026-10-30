import {standaloneServices,sessionPhases} from './production-data';
export const firstMeeting='Primo incontro — Parliamo del tuo progetto';
export const bookingServices=[firstMeeting,'Produzione musicale e sviluppo brano',...sessionPhases.filter(s=>s!=='Altro'),...standaloneServices.filter(s=>!['Servizio Mix','Servizio Master','Altro'].includes(s)),'Produzione live','Altro'];
export function bookingTime(date:string,time:string,duration:number,now=Date.now(),lead=true){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||!Number.isInteger(duration)||duration<30||duration>240||duration%30)throw Error('Data, orario o durata non validi.');
 const noon=new Date(date+'T12:00:00Z');if(!Number.isFinite(+noon)||noon.toISOString().slice(0,10)!==date||noon.getUTCDay()===0)throw Error('Scegli un giorno dal lunedì al sabato.');
 const [h,m]=time.split(':').map(Number),minutes=h*60+m;if(m%30||m>59||!((minutes>=570&&minutes+duration<=780)||(minutes>=960&&minutes+duration<=1200)))throw Error('La sessione deve rientrare nelle fasce 9:30–13:00 o 16:00–20:00.');
 const zone=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Rome',timeZoneName:'shortOffset'}).formatToParts(noon).find(p=>p.type==='timeZoneName')!.value;const offset=Number(zone.replace('GMT',''));const start=new Date(Date.parse(date+'T'+time+':00Z')-offset*3600000);
 if(+start<now+(lead?48*3600000:0)||+start>now+366*86400000)throw Error(lead?'Scegli una data con almeno 48 ore di anticipo, entro un anno.':'L’appuntamento deve essere futuro.');
 return {start:start.toISOString(),end:new Date(+start+duration*60000).toISOString()};
}
export function validateBooking(v:Record<string,unknown>,now=Date.now()){
 const field=(k:string,max:number,required=true)=>{const x=v[k];if(typeof x!=='string'||x.length>max||(required&&!x.trim()))throw Error('Controlla il campo '+k+'.');return x.trim();};
 const name=field('name',120),email=field('email',254).toLowerCase(),phone=field('phone',40),project=field('project',160,false),service=field('service',150),description=field('description',4000),links=field('links',1500,false),alternative=field('alternative',500,false);
 if(!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email)||!/^[-+() 0-9.]{6,40}$/.test(phone)||!bookingServices.includes(service)||v.privacy!==true||typeof v.clientKey!=='string'||!/^[0-9a-f-]{36}$/.test(v.clientKey))throw Error('Controlla contatti, servizio e consenso privacy.');
 const duration=service===firstMeeting?60:Number(v.duration);const slot=bookingTime(String(v.date),String(v.time),duration,now);
 return {name,email,phone,project,service,description,links,alternative,...slot,clientKey:v.clientKey};
}
export function bookingDate(value:string){return new Date(value).toLocaleString('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
export const bookingStates:Record<string,string>={pending:'Da valutare',proposed:'Nuovo orario proposto',confirmed:'Confermata',rejected:'Rifiutata',cancelled:'Annullata',completed:'Completata'};
