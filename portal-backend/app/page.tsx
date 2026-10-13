import Link from "next/link";
export default function Page() {
  return <main className="shell"><span className="eyebrow">EMME STUDIO · AREA DI LAVORO</span><h1>Musica, persone.<br /><em>Un unico spazio.</em></h1><p>La base del portale per organizzare progetti, produzione e appuntamenti del team.</p><div className="card"><span className="badge">CONFIGURAZIONE IN CORSO</span><h2>Il tuo prossimo progetto inizia qui.</h2><p>Stiamo preparando l’accesso riservato e il collegamento a Google Calendar. La sincronizzazione e l’archivio dei progetti non sono ancora attivi.</p><Link className="button" href="/accesso">Accesso amministratore <span aria-hidden="true">↗</span></Link></div></main>;
}
