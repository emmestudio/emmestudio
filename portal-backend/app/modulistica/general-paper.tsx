import {formBrand,formBrandName} from '@/lib/form-brand';
import {splitTotals,revenueTotal,changeMoney,type FormDefinition,type GeneralFormDraft} from '@/lib/form-templates';
type Provider={name:string;email:string;taxCode?:string;address?:string};
export default function GeneralPaper({doc,logo}:{doc:{id:string;state:string;version:number;payload:{draft:GeneralFormDraft;definition:FormDefinition;provider:Provider}};logo:string}){
 const {draft:d,definition:t,provider}=doc.payload,brand=formBrand(t.id,t.brand),brandName=formBrandName(brand);
 const text=(v?:string)=>v||null;
 const date=d.date?new Date(d.date+'T12:00:00Z').toLocaleDateString('it-IT'):'';
 const rows=d.rows.filter(row=>t.columns.some(f=>row[f.key]?.trim()));
 const columns=t.columns.filter(f=>rows.some(row=>row[f.key]?.trim()));
 const details=(entries:[string,string|undefined][])=>entries.filter(([,value])=>value?.trim()).map(([label,value],index)=><div key={index}>{label?label+': ':''}{value}</div>);

 let totals='';try{if(t.id==='author-split-v1'&&rows.some(row=>row.dem||row.drm)){const n=splitTotals(d.rows);totals=[rows.some(r=>r.dem)?'Totale DEM: '+(n.dem/100).toLocaleString('it-IT')+'%':'',rows.some(r=>r.drm)?'Totale DRM: '+(n.drm/100).toLocaleString('it-IT')+'%':''].filter(Boolean).join(' · ');}if(t.id==='revenue-recoupment-v1'&&rows.some(row=>row.share))totals='Totale quote sui ricavi: '+(revenueTotal(d.rows)/100).toLocaleString('it-IT')+'%';if(t.id==='work-change-v1'&&d.fields.previousAmount&&d.fields.deltaAmount&&d.fields.newAmount){const euro=(v:string)=>(changeMoney(v)/100).toLocaleString('it-IT',{style:'currency',currency:'EUR'});totals='Compenso precedente: '+euro(d.fields.previousAmount)+' · Variazione: '+euro(d.fields.deltaAmount)+' · Nuovo totale: '+euro(d.fields.newAmount);}}catch{totals='Quote o importi ancora da completare o verificare.';}
 const tax=(v?:string)=>(v||'').replace(/\s/g,'').toUpperCase();
 const signers=rows.map((r,i)=>({name:r.name||'Partecipante '+(i+1),representative:r.capacity&& !['Maggiorenne','Persona fisica maggiorenne'].includes(r.capacity)?r.representative:'',taxCode:r.taxCode}));
 if(t.signatures==='participants'){
  if(!signers.some(r=>tax(r.taxCode)&&tax(r.taxCode)===tax(provider.taxCode)))signers.unshift({name:provider.name,representative:'',taxCode:provider.taxCode||''});
  if(!signers.some(r=>tax(r.taxCode)&&tax(r.taxCode)===tax(d.fields.clientTaxCode)))signers.push({name:d.fields.clientName||'Controparte',representative:d.fields.representative||'',taxCode:d.fields.clientTaxCode});
 }
 const tripartite=t.signatures==='tripartite';
 const euro=(n:number)=>(n/100).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
 const partyKeys=new Set(['clientName','clientTaxCode','clientAddress','email','capacity','representative','representativeTaxCode','authority','secondRepresentative','secondRepresentativeTaxCode',...(tripartite?['academyBrand','academyType','academyEntity','academyTaxCode','academyAddress','academyEmail','academyRepresentative','academyRepresentativeTaxCode','academyAuthority']:[])]);
 const tableFields=t.fields.filter(f=>d.fields[f.key]?.trim()&&(!(t.contract||t.authorization)||!partyKeys.has(f.key)));
 const clientDetails:[string,string|undefined][]=[['',d.fields.clientName],['',d.fields.capacity],...(t.contract?[['C.F. / identificativo fiscale',d.fields.clientTaxCode],['Recapito',d.fields.clientAddress]] as [string,string|undefined][]:[]),['Email',d.fields.email]];
 const academyDetails:[string,string|undefined][]=[['',d.fields.academyEntity],['',d.fields.academyType],['C.F. / identificativo',d.fields.academyTaxCode],['Sede / recapito',d.fields.academyAddress],['Email',d.fields.academyEmail],['Nome del progetto',d.fields.academyBrand]];
 const footer=<footer className="agreement-footer">{brandName.toUpperCase()} · {t.title} · rif. {doc.id.slice(0,8).toUpperCase()} · v{doc.version}</footer>;
 return <article className={'agreement-paper agreement-paper-'+brand+(t.contract||t.authorization||t.notice?' forms-contract-paper':'')}>
  <header className="agreement-masthead">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logo} alt={brandName} width="170" height="80"/><div><span>{t.category.toUpperCase()} · MODULISTICA</span><strong>{doc.state==='ready'?'DOCUMENTO PREPARATO':'BOZZA · DA COMPLETARE'}</strong><small>Rif. {doc.id.slice(0,8).toUpperCase()} · versione {doc.version}</small></div></header>
  <h1>{d.title}</h1>{(d.place||date)?<p className="agreement-date">{[d.place&&"Luogo: "+d.place,date&&"Data: "+date].filter(Boolean).join(" · ")}</p>:null}
  {t.notice?<section className="agreement-parties"><div><h2>Titolare del trattamento</h2>{details([['',provider.name],['Recapito',provider.address],['Email',provider.email],['Nome di progetto',brandName]])}</div><div><h2>Informativa</h2>{details([['Versione',d.fields.noticeVersion]])}<p>Documento informativo. Nessun consenso generale e nessuna firma obbligatoria.</p></div></section>:null}
  {(t.contract||t.authorization)?<>
    <section className="agreement-parties">
      <div><h2>{t.id==='master-license-v1'?'Licenziatario':t.authorization?'Richiedente':'Contraente'}</h2>{details([['',provider.name],['C.F.',t.contract?provider.taxCode:undefined],['Recapito contrattuale',provider.address],['Email',provider.email],['Nome di progetto',brandName]])}</div>
      {clientDetails.some(([,v])=>v)?<div><h2>{t.id==='master-license-v1'?'Concedente':t.authorization?'Interessato / autorizzante':tripartite?'Artista':'Controparte'}</h2>{details(clientDetails)}</div>:null}
    </section>
    {[d.fields.representative,d.fields.representativeTaxCode,d.fields.authority,d.fields.secondRepresentative,d.fields.secondRepresentativeTaxCode].some(Boolean)?
      <section className="agreement-section"><h2>Rappresentanza</h2>{details([['Rappresentante',d.fields.representative],['C.F.',d.fields.representativeTaxCode],['',d.fields.authority],['Altro rappresentante / genitore',d.fields.secondRepresentative],['C.F. altro rappresentante',d.fields.secondRepresentativeTaxCode]])}</section>:null}
  </>:null}
  {tripartite?<section className="agreement-parties">
    {academyDetails.some(([,v])=>v)?<div><h2>Soggetto gestore dell’Accademia</h2>{details(academyDetails)}</div>:null}
    {[d.fields.academyRepresentative,d.fields.academyRepresentativeTaxCode,d.fields.academyAuthority].some(Boolean)?
      <div><h2>Sottoscrittore per l’Accademia</h2>{details([['',d.fields.academyRepresentative],['C.F.',d.fields.academyRepresentativeTaxCode],['',d.fields.academyAuthority]])}</div>:null}
  </section>:null}
  {tableFields.length?<table className="agreement-table"><thead><tr><th>Voce</th><th>{t.contract?'Condizioni concordate':'Informazioni'}</th></tr></thead><tbody>{tableFields.map(f=><tr key={f.key}><th scope="row">{f.label}</th><td>{d.fields[f.key]}</td></tr>)}</tbody></table>:null}
  {rows.length||d.quoteSnapshot?<h2 className="agreement-table-title">{t.rowTitle}</h2>:null}
  {t.id==='quote-acceptance-v1'?d.quoteSnapshot?<section className="agreement-section"><p><strong>{d.quoteSnapshot.title}</strong><br/>{d.quoteSnapshot.artist} · {d.quoteSnapshot.service}<br/>Preventivo {d.quoteSnapshot.id} · versione {d.quoteSnapshot.version}</p><table className="agreement-table"><thead><tr><th>Descrizione</th><th>Quantità</th><th>Tariffa</th><th>Totale</th></tr></thead><tbody>{!d.quoteSnapshot.items.length?<tr><td>Importo complessivo del preventivo</td><td>—</td><td>—</td><td>{euro(d.quoteSnapshot.amount)}</td></tr>:d.quoteSnapshot.items.map((item,i)=><tr key={i}><td>{item.description}</td><td>{(item.quantity/100).toLocaleString('it-IT')}</td><td>{euro(item.unitPrice)}</td><td>{euro(Math.round(item.quantity*item.unitPrice/100))}</td></tr>)}</tbody></table><p className="forms-paper-totals">Totale preventivo: {euro(d.quoteSnapshot.amount)}</p>{d.quoteSnapshot.notes?<p style={{whiteSpace:'pre-wrap'}}>{d.quoteSnapshot.notes}</p>:null}</section>:null:!rows.length?null:columns.length>5||t.authorization||rows.some(row=>columns.some(f=>!row[f.key]))?
    rows.map((row,i)=><section className="forms-paper-entry" key={i}>
      <h3>{t.rowLabel|| (t.id==='author-split-v1'?'Partecipante':'Voce')} {i+1}{row.name||row.title?' · '+(row.name||row.title):''}</h3>
      <dl className="forms-author-info">{columns.filter(f=>row[f.key]).map(f=><div key={f.key}><dt>{f.label}</dt><dd>{row[f.key]}</dd></div>)}</dl>
    </section>):<table className="agreement-table forms-file-table"><thead><tr>{columns.map(f=><th key={f.key}>{f.label}</th>)}</tr></thead>
      <tbody>{rows.map((row,i)=><tr key={i}>{columns.map(f=><td key={f.key}>{row[f.key]}</td>)}</tr>)}</tbody></table>}
  {totals?<p className="forms-paper-totals">{totals}</p>:null}
  <section className="agreement-section"><h2>{t.contract?'Condizioni dell’accordo':'Ambito e precisazioni'}</h2>{t.notes.map((n,i)=>t.signatures==='none'&&i===t.notes.length-1?<div className="forms-note-footer" key={i}><p>{n}</p>{footer}</div>:<p key={i}>{n}</p>)}</section>
  {t.signatures!=='none'?<section className="agreement-signatures"><h2>{t.authorization?'Scelte e sottoscrizione':t.signatures==='authors'||t.contract?'Sottoscrizione delle parti indicate':'Conferma delle informazioni'}</h2><p>La preparazione nel portale non costituisce firma. Apponi le firme previste sul documento completo.</p>
   {t.signatures==='guardians'?<div><p>Primo rappresentante / genitore<br/><strong>{text(d.fields.representative)}</strong><span>Firma __________________________</span></p>{d.fields.guardianMode==='Entrambi i genitori / esercenti'?<p>Altro genitore / esercente<br/><strong>{text(d.fields.secondRepresentative)}</strong><span>Firma __________________________</span></p>:null}</div>:tripartite?<><div><p>Per Studio / Label<br/><strong>{provider.name}</strong><span>Firma __________________________</span></p><p>Per il soggetto gestore dell’Accademia<br/><strong>{text(d.fields.academyRepresentative)}</strong><span>Firma __________________________</span></p></div><p>Artista / rappresentante<br/><strong>{d.fields.representative||text(d.fields.clientName)}</strong><br/>Firma __________________________</p>{d.fields.secondRepresentative?<p>Altro rappresentante / genitore: {d.fields.secondRepresentative}<br/>Firma __________________________</p>:null}</>:t.signatures==='authors'||t.signatures==='participants'?signers.map((r,i)=><p className="forms-author-signature" key={i}><strong>{r.name}</strong>{r.representative?<><br/>Rappresentante: {r.representative}</>:null}<br/>Firma __________________________ · Data __________________</p>):<><div><p>{t.id==='master-license-v1'?'Il licenziatario':t.contract?'Il contraente':'Referente del documento'}<br/><strong>{provider.name}</strong><span>Firma __________________________</span></p><p>{t.id==='master-license-v1'?'Il concedente / rappresentante':t.authorization?'Interessato / rappresentante':'Committente / referente / rappresentante'}<br/><strong>{d.fields.representative||d.fields.contactName||d.fields.clientName||''}</strong><span>Firma __________________________</span></p></div>{(t.contract||t.authorization)&&d.fields.secondRepresentative?<p>Altro rappresentante / genitore: {d.fields.secondRepresentative}<br/>Firma __________________________</p>:null}</>}
  {footer}</section>:null}
 </article>;
}
