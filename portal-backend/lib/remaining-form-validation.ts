import type {FormDefinition,GeneralFormDraft} from './form-templates';
import {changeMoney,shareBasisPoints} from './form-templates';
const key=(s:string)=>(s||'').replace(/\s/g,'').toUpperCase();
export function validateRemainingForm(t:FormDefinition,d:GeneralFormDraft,ready:boolean){
 const x=d.fields,need=(k:string,message:string)=>{if(ready&&!x[k])throw Error(message);};
 if(['master-ownership-v1','coproduction-v1'].includes(t.id)){
  const total=d.rows.reduce((n,r)=>n+(r.share?shareBasisPoints(r.share):0),0);
  if(ready&&total!==10000)throw Error('Le quote di proprietà del master devono totalizzare il 100%.');
  if(ready&&new Set(d.rows.map(r=>key(r.taxCode))).size!==d.rows.length)throw Error('Un titolare del master è inserito più volte.');
  if(ready)for(const row of d.rows){if(shareBasisPoints(row.share)===0)throw Error('Verifica il titolare con quota zero.');if(row.capacity!=='Persona fisica maggiorenne'&&!row.representative)throw Error('Completa rappresentante e titolo alla firma del titolare.');}
 }
 if(t.id==='work-suspension-v1'){
  const names=['workDue','approvedCosts','paidAmount','balanceDue','refundDue'];for(const n of names)if(x[n]&&changeMoney(x[n])<0)throw Error('I conteggi della chiusura non possono essere negativi.');
  if(ready){const delta=changeMoney(x.workDue)+changeMoney(x.approvedCosts)-changeMoney(x.paidAmount);if(changeMoney(x.balanceDue)!==Math.max(0,delta)||changeMoney(x.refundDue)!==Math.max(0,-delta))throw Error('Verifica saldo e restituzione rispetto a lavoro, spese e importi versati.');if(x.outcome==='Sospensione temporanea')need('restartTerms','Definisci condizioni e termine della ripresa.');}
 }
 if(t.id==='artist-statement-v1'){
  const names=['grossTotal','deductionTotal','netTotal','recoveredCosts','openingBalance','entitlement','paidAmount','closingBalance'];for(const n of names)if(x[n]&&changeMoney(x[n])<0)throw Error('Questo prospetto richiede importi non negativi.');
  if(x.share)shareBasisPoints(x.share);for(const r of d.rows)for(const n of ['gross','deduction','net'])if(r[n]&&changeMoney(r[n])<0)throw Error('Gli importi delle righe non possono essere negativi.');
  if(ready){if(x.periodEnd<x.periodStart)throw Error('Verifica inizio e fine del periodo.');let gross=0,deduction=0,net=0;for(const r of d.rows){const g=changeMoney(r.gross),a=changeMoney(r.deduction),n=changeMoney(r.net);if(g-a!==n)throw Error('In ogni riga il netto deve coincidere con lordo meno deduzioni.');gross+=g;deduction+=a;net+=n;}
   if(gross!==changeMoney(x.grossTotal)||deduction!==changeMoney(x.deductionTotal)||net!==changeMoney(x.netTotal))throw Error('I totali del rendiconto non coincidono con le righe.');const recovered=changeMoney(x.recoveredCosts);if(recovered>net)throw Error('Il recupero non può superare il netto del periodo in questo prospetto.');const entitlement=Math.round((net-recovered)*shareBasisPoints(x.share)/10000);if(entitlement!==changeMoney(x.entitlement))throw Error('La quota spettante non coincide con la base dopo il recupero e la percentuale.');const closing=changeMoney(x.openingBalance)+entitlement-changeMoney(x.paidAmount);if(closing<0||closing!==changeMoney(x.closingBalance))throw Error('Verifica saldo precedente, quota, pagamenti e saldo finale.');
  }
 }
 if(ready&&['digital-distribution-v1','beat-license-v1','synchronisation-license-v1','live-recording-license-v1'].includes(t.id)&&x.rightsCheck!=='Autorizzazioni verificate e documentate')throw Error('Completa e documenta la verifica dei diritti prima di preparare l’accordo.');
 if(ready&&t.id==='release-approval-v1'){
  if(x.outcome==='Approvata con riserve')need('reservations','Descrivi riserve e approvazioni ancora necessarie.');
  if(x.outcome==='Approvata per i materiali e le condizioni indicati'&&(x.rightsCheck!=='Autorizzazioni verificate e documentate'||d.rows.some(r=>r.decision!=='Approvato')))throw Error('L’approvazione integrale richiede diritti verificati e ogni materiale approvato.');
 }
 if(ready&&t.id==='privacy-notice-v1'){
  if(x.dataSource==='Dati raccolti anche da terzi')need('indirectSources','Specifica fonti, categorie e tempi di informazione per i dati ricevuti da terzi.');
  if(x.transfers==='Presenti e descritti con garanzie applicabili')need('transferSafeguards','Descrivi i trasferimenti e le garanzie applicabili.');
  if(x.automation==='Presenti e descritte')need('automationDetails','Descrivi logica, importanza e conseguenze delle decisioni automatizzate.');
 }
 if(ready&&t.id==='marketing-consent-v1'){
  if(d.rows.some(r=>r.channel!=='Email'&&r.decision==='Acconsento alla finalità e al canale indicati'))need('phone','Indica il recapito dei canali telefonici per cui è espresso consenso.');
  if(new Set(d.rows.map(r=>r.channel+'|'+r.purpose.trim().toLocaleLowerCase('it'))).size!==d.rows.length)throw Error('La stessa scelta per finalità e canale è ripetuta: riuniscila in una sola riga.');
 }
 if(ready&&t.id==='minor-documentation-v1'){
  const birth=new Date(x.birthDate+'T12:00:00Z'),at=new Date(d.date+'T12:00:00Z');const age=at.getUTCFullYear()-birth.getUTCFullYear()-(at.toISOString().slice(5,10)<birth.toISOString().slice(5,10)?1:0);
  if(birth>at||age>=18)throw Error('Verifica la nascita: il soggetto deve essere minorenne alla data del documento.');
  if(x.guardianMode==='Entrambi i genitori / esercenti'){need('secondRepresentative','Indica entrambi i genitori o esercenti.');need('secondRepresentativeTaxCode','Indica l’identificativo dell’altro genitore o esercente.');}
  else need('guardianEvidence','Documenta la legittimazione del solo rappresentante.');
  if(x.authorisationReview==='Da verificare')throw Error('Completa la verifica delle autorizzazioni per il minore.');
 }
 if(ready&&t.id==='live-collaborator-v1'){
  if(x.engagementCheck!=='Inquadramento e adempimenti individuati per la prestazione')throw Error('Completa la verifica dell’inquadramento e degli adempimenti della prestazione.');
  if(x.capacity==='Minorenne rappresentato')need('minorCompliance','Indica le ulteriori verifiche e autorizzazioni per la prestazione del minore.');
 }
 if(t.id==='show-technical-sheet-v1'){
  for(const r of d.rows)if(r.channel&&!/^\d{1,3}$/.test(r.channel))throw Error('Indica numeri interi per i canali audio.');
  if(ready&&(d.rows.some(r=>Number(r.channel)<1)||new Set(d.rows.map(r=>Number(r.channel))).size!==d.rows.length))throw Error('I canali devono essere positivi e senza duplicati.');
 }
}
