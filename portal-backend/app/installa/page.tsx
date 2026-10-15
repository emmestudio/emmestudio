import InstallButton from "./install-button";

export default function InstallPage() {
  return <main className="shell">
    <span className="eyebrow">EMME STUDIO · SEMPRE CON TE</span>
    <h1>Lo studio,<br /><em>in tasca.</em></h1>
    <p>Artisti, produzioni, appuntamenti e attività: accedi al portale dalla schermata Home del tuo smartphone. Ritrovi gli stessi dati e i permessi del tuo account team.</p>
    <InstallButton />
    <section className="card"><h2>Android</h2><p>Apri questa pagina in Chrome. Tocca «Installa app» qui sopra, se disponibile, oppure apri il menu ⋮ del browser e scegli «Installa app» o «Aggiungi a schermata Home».</p></section>
    <section className="card"><h2>iPhone e iPad</h2><p>Apri il portale in Safari. Tocca Condividi, poi «Aggiungi alla schermata Home» e conferma. Se disponibile, lascia attiva l’opzione «Apri come app web».</p></section>
    <p>L’app richiede una connessione Internet. Al primo accesso entra con il tuo account Google autorizzato.</p>
    <a className="button" href="/dashboard">Apri il portale →</a>
  </main>;
}
