import { formBrand } from "@/lib/form-brand";
import { documentLogo } from "@/lib/document-logo";
import type { ServiceAgreement, AgreementProvider, AgreementClause } from "@/lib/service-agreement-data";
import type { FormDefinition, GeneralFormDraft } from "@/lib/form-templates";
import GeneralPaper from "./general-paper";

type DocumentPaper = {
  id: string;
  state: string;
  version: number;
  template: string;
  payload: {
    draft: ServiceAgreement | GeneralFormDraft;
    provider: AgreementProvider;
    clauses?: AgreementClause[];
    definition?: FormDefinition;
  };
};

export default async function FormPaper({ doc }: { doc: DocumentPaper }) {
 const { id, template } = doc;
 const logo = await documentLogo(formBrand(template, doc.payload.definition?.brand));
 if (doc.payload.definition) {
   const { draft, provider, definition } = doc.payload;
   return <GeneralPaper doc={{ ...doc, payload: { draft: draft as GeneralFormDraft, provider, definition } }} logo={logo}/>;
 }
 const {draft:d,provider:p,clauses}=doc.payload as {draft:ServiceAgreement;provider:AgreementProvider;clauses:AgreementClause[]};
 const date=d.date?new Date(d.date+'T12:00:00Z').toLocaleDateString('it-IT'):'';
 const details=(entries:[string,string][])=>entries.filter(([,value])=>value?.trim()).map(([label,value],index)=><div key={index}>{label?label+': ':''}{value}</div>);
 const clientType=d.clientType==='organization'?'Organizzazione':d.clientType==='minor'?'Artista minorenne':d.clientType==='private'?'Persona fisica':'';
 const client:[string,string][]=[['',d.clientName],['Tipo di committente',clientType],['C.F. / identificativo fiscale',d.clientTaxCode],['Recapito contrattuale',d.clientAddress],['Email',d.clientEmail],['Telefono',d.clientPhone]];
 const representation:[string,string][]=[['Rappresentante',d.representative],['Qualifica',d.representativeRole],['C.F.',d.representativeTaxCode],['Responsabilità genitoriale e titolo alla sottoscrizione',d.guardianAuthority],['Altro genitore / rappresentante',d.secondGuardian]];
 const rows=[['Artista / progetto',d.artistName],['Servizi',d.services.join(', ')],['Attività e materiali',d.scope],['File WAV',d.wavFormat],['Instrumental',d.instrumental?'Inclusa per il servizio concordato':''],['Tempi e modalità di consegna',d.delivery],['Revisioni incluse','Due giri di revisione'],['Compenso complessivo',d.amount],['Acconto',d.deposit],['Saldo',d.balance],['Modalità di pagamento',d.paymentMethod],['Revisioni aggiuntive',d.extraRevision],['Spostamenti e annullamenti',d.cancellation],['Credito',d.credit],['Master e utilizzi',d.masterTerms]];
 return <article className="agreement-paper">
 <header className="agreement-masthead">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logo} alt="Emme Studio" width="170" height="80"/><div><span>ACCORDO PER SERVIZI MUSICALI</span><strong>{doc.state==='ready'?'DA SOTTOSCRIVERE':'BOZZA · DA COMPLETARE'}</strong><small>Rif. {id.slice(0,8).toUpperCase()} · versione {doc.version}</small></div></header>
 <h1>{d.title}</h1>{(d.place||date)?<p className="agreement-date">{[d.place&&"Luogo: "+d.place,date&&"Data: "+date].filter(Boolean).join(" · ")}</p>:null}
 <section className="agreement-parties">
   <div><h2>Prestatore</h2>{details([['',p.name],['C.F.',p.taxCode],['Recapito contrattuale',p.address],['Email',p.email],['Nome di progetto','Emme Studio']])}</div>
   {client.some(([,v])=>v)?<div><h2>Committente</h2>{details(client)}</div>:null}
 </section>
 {d.clientType!=='private'&&representation.some(([,v])=>v)?<section className="agreement-section"><h2>Rappresentanza</h2>{details(representation)}</section>:null}
 <h2 className="agreement-table-title">Scheda di incarico e condizioni specifiche</h2><table className="agreement-table"><thead><tr><th>Voce</th><th>Condizioni concordate</th></tr></thead><tbody>{rows.filter(([,v])=>v?.trim()).map(([label,v])=><tr key={label}><th scope="row">{label}</th><td>{v}</td></tr>)}</tbody></table>
 {d.quoteId&&d.quoteVersion&&d.quoteSummary?<section className="agreement-section"><h2>Preventivo richiamato</h2><p>Riferimento {d.quoteId.slice(0,8).toUpperCase()} · versione {d.quoteVersion}</p><p className="preserve-lines">{d.quoteSummary}</p></section>:null}
 {clauses.map(clause=><section className="agreement-section" key={clause.title}><h2>{clause.title}</h2><p>{clause.text}</p></section>)}
 {d.extraTerms?<section className="agreement-section"><h2>Ulteriori condizioni concordate</h2><p className="preserve-lines">{d.extraTerms}</p></section>:null}
 <section className="agreement-signatures"><p>Le parti dichiarano di aver letto la scheda e le condizioni sopra riportate e appongono la firma sul documento completo.</p><div><p>Il prestatore<br/><strong>{p.name}</strong><span>Firma __________________________</span></p><p>{d.clientType==='organization'||d.clientType==='minor'?'Il rappresentante / genitore':'Il committente'}<br/><strong>{d.clientType==='organization'||d.clientType==='minor'?d.representative:d.clientName}</strong><span>Firma __________________________</span></p></div>{d.clientType==='minor'&&d.secondGuardian?<p>Altro genitore / rappresentante: {d.secondGuardian}<br/>Firma __________________________</p>:null}</section>
 <footer className="agreement-footer">EMME STUDIO · Accordo per servizi musicali · modello 1 · rif. {id.slice(0,8).toUpperCase()} · v{doc.version}</footer></article>
}
