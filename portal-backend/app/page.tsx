import Link from "next/link";
export default function Page() {
  return <main className="shell"><span className="eyebrow">EMME STUDIO · AREA DI LAVORO</span><h1>Musica, persone.<br /><em>Un unico spazio.</em></h1><p>Il portale per organizzare progetti, produzione e appuntamenti dello studio.</p><div className="card"><span className="badge">ACCESSO RISERVATO</span><h2>Il tuo prossimo progetto inizia qui.</h2><p>Raccogli la visione artistica, segui le aree di lavoro e organizza gli appuntamenti sul calendario collegato. In questa fase l’accesso è riservato all’amministratore.</p><Link className="button" href="/accesso">Accesso amministratore <span aria-hidden="true">↗</span></Link></div></main>;
}
