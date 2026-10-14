import Link from "next/link";
export default function Page() {
  return (
    <main className="shell portal-welcome">
      <span className="eyebrow">EMME STUDIO · PORTALE INTERNO</span>
      <h1>
        Il lavoro prende forma.
        <br />
        <em>Insieme.</em>
      </h1>
      <p className="welcome-lead">
        Lo spazio del nostro team per seguire ogni progetto, dalla prima idea
        alla consegna.
      </p>
      <div className="welcome-layout">
        <section className="welcome-access">
          <span className="badge">ACCESSO RISERVATO AL TEAM</span>
          <h2>
            Il tuo studio.
            <br />
            Tutto in un unico posto.
          </h2>
          <p>
            Progetti, brani, appuntamenti e attività: ritrova il lavoro da fare
            e coordina il prossimo passo con il team.
          </p>
          <Link className="button" href="/accesso">
            Accedi al portale <span aria-hidden="true">↗</span>
          </Link>
          <p className="small">
            Usa l’account Google abilitato dall’amministratore.
          </p>
        </section>
        <div className="welcome-features">
          <article>
            <span>01</span>
            <div>
              <h3>Progetti e artisti</h3>
              <p>
                Una visione condivisa, responsabilità chiare e consegne
                ordinate.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <h3>Produzione e live</h3>
              <p>Brani, sessioni, materiali e show, collegati al progetto.</p>
            </div>
          </article>
          <article>
            <span>03</span>
            <div>
              <h3>Il lavoro di ogni giorno</h3>
              <p>Attività, scadenze e calendario sincronizzato.</p>
            </div>
          </article>
        </div>
      </div>
      <a className="text-button" href="https://emmestudioproduction.it/">
        ← Torna al sito Emme Studio
      </a>
    </main>
  );
}
