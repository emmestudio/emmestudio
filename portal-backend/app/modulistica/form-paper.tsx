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
 const value=(v:string)=>v||'Da compilare';const date=d.date?new Date(d.date+'T12:00:00Z').toLocaleDateString('it-IT'):'Da compilare';
 const rows=[['Artista / progetto',d.artistName],['Servizi',d.services.join(', ')],['Attività e materiali',d.scope],['File WAV',d.wavFormat],['Instrumental',d.instrumental?'Inclusa per il servizio concordato':'Non inclusa'],['Tempi e modalità di consegna',d.delivery],['Revisioni incluse','Due giri di revisione'],['Compenso complessivo',d.amount],['Acconto',d.deposit],['Saldo',d.balance],['Modalità di pagamento',d.paymentMethod],['Revisioni aggiuntive',d.extraRevision],['Spostamenti e annullamenti',d.cancellation],['Credito',d.credit],['Master e utilizzi',d.masterTerms]];
 return <article className="agreement-paper">
 <header className="agreement-masthead">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={logo} alt="Emme Studio" width="170" height="80"/><div><span>ACCORDO PER SERVIZI MUSICALI</span><strong>{doc.state==='ready'?'DA SOTTOSCRIVERE':'BOZZA · DA COMPLETARE'}</strong><small>Rif. {id.slice(0,8).toUpperCase()} · versione {doc.version}</small></div></header>
 <h1>{d.title}</h1><p className="agreement-date">Luogo: {value(d.place)} · Data: {date}</p>
 <section className="agreement-parties"><div><h2>Prestatore</h2><p><strong>{p.name}</strong><br/>C.F. {value(p.taxCode)}<br/>Recapito contrattuale: {value(p.address)}<br/>Email: {value(p.email)}<br/>Nome di progetto: Emme Studio</p></div><div><h2>Committente</h2><p><strong>{value(d.clientName)}</strong><br/>{d.clientType==='organization'?'Organizzazione':d.clientType==='minor'?'Artista minorenne':'Persona fisica'}<br/>C.F. / identificativo fiscale: {value(d.clientTaxCode)}<br/>Recapito contrattuale: {value(d.clientAddress)}<br/>Email: {value(d.clientEmail)}{d.clientPhone?<><br/>Telefono: {d.clientPhone}</>:null}</p></div></section>
 {d.clientType!=='private'?<section className="agreement-section"><h2>Rappresentanza</h2><p>{value(d.representative)} · {value(d.representativeRole)} · C.F. {value(d.representativeTaxCode)}</p>{d.clientType==='minor'?<><p>Responsabilità genitoriale e titolo alla sottoscrizione: {value(d.guardianAuthority)}</p>{d.secondGuardian?<p>Altro genitore / rappresentante: {d.secondGuardian}</p>:null}</>:null}</section>:null}
 <h2 className="agreement-table-title">Scheda di incarico e condizioni specifiche</h2><table className="agreement-table"><thead><tr><th>Voce</th><th>Condizioni concordate</th></tr></thead><tbody>{rows.map(([label,v])=><tr key={label}><th scope="row">{label}</th><td>{value(v)}</td></tr>)}</tbody></table>
 {d.quoteId?<section className="agreement-section"><h2>Preventivo richiamato</h2><p>Riferimento {d.quoteId.slice(0,8).toUpperCase()} · versione {d.quoteVersion||'Da importare'}</p><p className="preserve-lines">{value(d.quoteSummary)}</p></section>:null}
 {clauses.map(clause=><section className="agreement-section" key={clause.title}><h2>{clause.title}</h2><p>{clause.text}</p></section>)}
 {d.extraTerms?<section className="agreement-section"><h2>Ulteriori condizioni concordate</h2><p className="preserve-lines">{d.extraTerms}</p></section>:null}
 <section className="agreement-signatures"><p>Le parti dichiarano di aver letto la scheda e le condizioni sopra riportate e appongono la firma sul documento completo.</p><div><p>Il prestatore<br/><strong>{p.name}</strong><span>Firma __________________________</span></p><p>{d.clientType==='private'?'Il committente':'Il rappresentante / genitore'}<br/><strong>{d.clientType==='private'?value(d.clientName):value(d.representative)}</strong><span>Firma __________________________</span></p></div>{d.clientType==='minor'&&d.secondGuardian?<p>Altro genitore / rappresentante: {d.secondGuardian}<br/>Firma __________________________</p>:null}</section>
 <footer className="agreement-footer">EMME STUDIO · Accordo per servizi musicali · modello 1 · rif. {id.slice(0,8).toUpperCase()} · v{doc.version}</footer></article>
}
