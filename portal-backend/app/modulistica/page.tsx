import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {ownerSession} from '@/lib/owner-session';
import './modulistica.css';

export const dynamic='force-dynamic';
export const metadata={title:'Modulistica — Emme Studio'};
const areas=[
 {id:'studio',number:'01',title:'Studio e servizi',description:'Documenti per organizzare collaborazioni, produzioni e attività dello studio.',tag:'EMME STUDIO'},
 {id:'label',number:'02',title:'Emme Label',description:'Accordi e documenti dedicati agli artisti, alle pubblicazioni e al collettivo.',tag:'EMME LABEL'},
 {id:'consensi',number:'03',title:'Liberatorie e consensi',description:'Autorizzazioni e dichiarazioni da definire in base alle esigenze di ogni progetto.',tag:'AUTORIZZAZIONI'},
];
function DocumentIcon(){return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M19 4H8a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V11L19 4Z"/><path d="M19 4v7h7M11 16h10m-10 5h7"/></svg>;}
export default async function Modulistica(){
 if(!await ownerSession(await headers()))redirect('/accesso');
 return <main className="shell forms-hub">
  <header className="forms-intro"><div><p className="eyebrow">AMMINISTRAZIONE · DOCUMENTI</p><h1>Modulistica.</h1><p>Uno spazio per i modelli di Emme Studio ed Emme Label. Qui raccoglieremo i documenti da compilare direttamente nel portale, con le informazioni utili per ogni collaborazione.</p></div><span className="forms-intro-icon"><DocumentIcon/></span></header>
  <section aria-labelledby="forms-models-title"><div className="forms-section-heading"><div><p className="eyebrow">LA RACCOLTA</p><h2 id="forms-models-title">Modelli compilabili</h2></div><span className="forms-status">In preparazione</span></div>
   <div className="forms-areas">{areas.map(area=><article className={'forms-area forms-area-'+area.id} key={area.id}><div className="forms-area-top"><span className="forms-area-number">{area.number}</span><span className="forms-area-tag">{area.tag}</span></div><h3>{area.title}</h3><p>{area.description}</p><span className="forms-area-footer">Modelli da definire</span></article>)}</div>
   <div className="forms-empty"><span className="forms-empty-icon"><DocumentIcon/></span><div><h3>La raccolta è pronta per il primo modello.</h3><p>I singoli moduli non sono ancora disponibili. Aggiungeremo un modello alla volta, definendo campi, informazioni richieste e formato del documento.</p></div></div>
  </section>
  <section className="forms-roadmap" aria-labelledby="forms-roadmap-title"><p className="eyebrow">IL PERCORSO PREVISTO</p><h2 id="forms-roadmap-title">Dal modello al documento.</h2><ol><li><span>01</span><div><h3>Scegli il modello</h3><p>Ogni documento avrà un utilizzo preciso e le indicazioni per compilarlo.</p></div></li><li><span>02</span><div><h3>Compila nel portale</h3><p>I campi raccoglieranno dati dell’artista, riferimenti del progetto e dettagli dell’accordo.</p></div></li><li><span>03</span><div><h3>Controlla ed esporta</h3><p>Definiremo per ciascun modello l’anteprima, il PDF e le modalità di archiviazione.</p></div></li></ol></section>
 </main>;
}
