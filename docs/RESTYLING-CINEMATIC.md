# Emme Studio — Restyling Cinematic 2026

Branch di lavoro: `restyling-cinematic-2026`. Nessuna modifica a `main`, hosting o dominio.

## Fasi e approvazioni

1. **Home e sistema grafico**: `cinematic-preview.html`, `cinematic.css`, `cinematic.js`. Revisione con Marcello prima di estendere il design.
2. **Pagine principali**: Music Production, Live Show Production, Studio, Portfolio, Contatti/Preventivo; contenuti e collegamenti coerenti.
3. **Pagine secondarie**: corsi, profili, listino, pagina start, privacy e 404. Preservare gli URL esistenti o predisporre reindirizzamenti espliciti. Non eliminare corsi, collaboratori o prezzi senza approvazione del contenuto.
4. **Verifica integrata**: browser desktop/mobile, tastiera, collegamenti, moduli, metadati per pagina, sitemap, immagini. Pubblicazione su `main` solo dopo approvazione esplicita. Dominio fuori da questo intervento.

## Analisi del codice esistente

- 23 file HTML statici, nessuna pipeline di build. Il restyling può restare compatibile con GitHub Pages senza framework o backend aggiuntivi.
- Home attuale orientata soprattutto a corsi, recording e mix/mastering; manca una pagina Live Show Production.
- Header, footer e controller mobile ripetuti con differenze tra le pagine. Alcune pagine corsi/profili hanno il pulsante mobile ma nessuno script per attivarlo.
- `index.html` contiene una chiusura `section` aggiuntiva prima delle lezioni.
- `styles.css` contiene circa 29 KB di regole; `start.html` usa un sistema grafico autonomo con CSS incorporato.
- Hero PNG da 13.213.156 byte, 5376×3584. Diverse immagini corso pesano circa 2 MB e il ritratto di Marcello circa 3 MB.
- Il portfolio ha sei anteprime con link `#` e nomi generici. La prima sorgente video non coincide con l'indice iniziale del controller.
- Collegamenti segnaposto `INSERISCI_LINK_*` in `contatti.html` e `salvatore-moody-di-majo.html`.
- Immagine Open Graph indicata da molte pagine (`og-image-1200x630-logo-badge-smaller.png`) assente dagli asset. Da correggere quando si aggiornano i metadati.
- Preventivo, iscrizioni e sala prove usano Google Forms incorporati; mantenere gli identificativi esistenti. Il semplice controllo del codice non dimostra che invio e ricezione funzionino.
- YouTube, Spotify, Maps e Forms sono caricati direttamente nelle pagine attuali. Nella migrazione predisporre caricamento volontario dei contenuti esterni e rivedere la relativa informativa.
- Nel repository non risultano sitemap o robots.txt. Nell'anteprima `noindex, nofollow` impedisce di promuovere una pagina provvisoria; SEO di produzione da completare nelle fasi successive.

## Prima fase implementata

- Logo originale e contatti esistenti mantenuti.
- Home con gerarchia Music Production / Recording & Editing / Mix & Mastering, spazio studio, sezione live tecnica e accessi al portfolio esistente.
- Palette scura con accento caldo, tipografia di sistema, nessun font remoto o dipendenza JavaScript.
- Visual già presente convertito a WebP 1920×1280 da 98.206 byte: riduzione del 99,3% rispetto al PNG originale. Originale conservato.
- Visual dichiarato illustrativo; non presentarlo come fotografia della sede. Foto reali da inserire dopo la revisione.
- Menu con `aria-expanded`, `aria-controls`, Escape, chiusura al clic esterno e reset al cambio breakpoint. Skip link, focus visibile, titolo H1 unico, preferenza di movimento ridotto.
- Anteprima senza iframe: collegamenti espliciti a Spotify, YouTube e Maps.
- Nuova home isolata: le pagine attuali non sono ancora state migrate e il link privacy conserva la pagina esistente.

## Da concordare nelle prossime fasi

- Foto reali: regia, outboard, vocal booth, amplificatori/pedaliere, panoramica della sala.
- Crediti e titoli pubblicabili per ogni produzione del portfolio.
- Posizione e contenuti aggiornati dei corsi, dei collaboratori, del listino e della sala prove.
- Descrizione dei servizi video e sviluppo artista: evitare promesse operative non confermate.

## Verifica della prima fase — 13 ottobre 2026

- `node --check cinematic.js`: superato.
- `git diff --check`: superato.
- Controllo dei riferimenti locali dell'anteprima: nessun file mancante.
- Browser Chrome tramite HTML Preview: controllo visivo dell'intera home desktop, immagini caricate, nessun overflow orizzontale a viewport 1363 px, collegamento interno Live Show verificato.
- Logo scuro originale su supporto chiaro, dopo correzione emersa dal controllo visivo.
- Schermate di revisione in `docs/previews/`.
- **Limite**: verifica visiva a viewport mobile e verifica interattiva del menu mobile ancora da completare. Il browser locale non era disponibile e il download di Chromium non è riuscito; il browser cloud ha consentito il controllo desktop, senza API di ridimensionamento esposta. I breakpoint sono implementati ma non dichiarati collaudati su telefono.
- Nessun invio di Google Forms o verifica della ricezione dei moduli eseguito in questa fase.

## Revisione dinamica richiesta da Marcello

- Pulsanti: sollevamento breve, riflesso, movimento delle frecce, pressione al clic.
- Schede: sollevamento, bordo luminoso e risposta al focus da tastiera.
- Ingressi una volta per elemento con IntersectionObserver e ritardo tra le schede.
- Navigazione: barra di avanzamento sottile, indicazione della sezione corrente, ombra dopo lo scorrimento.
- Regia: lieve zoom al passaggio del mouse; pannello live con reticolo tecnico discreto.
- Nessuna libreria aggiuntiva, nessun autoplay e nessuno scroll artificiale. Movimento ridotto rispettato anche se la preferenza cambia durante la visita. Senza JavaScript i contenuti restano visibili.
- Logo bianco allegato inserito come `assets/logo-white.png`, copia identica del PNG ricevuto. Nessuno sfondo aggiunto; margini trasparenti gestiti con CSS, marchio e cornice conservati. Eliminata la scritta duplicata accanto al logo.

### Verifica della revisione dinamica

- Sintassi JavaScript e controllo whitespace superati.
- Browser desktop: PNG bianco caricato, marchio e cornice interamente visibili, nessun overflow orizzontale.
- Ingressi osservati sulle tre schede (opacità finale 1), transizioni attive, contenuti Live visibili dopo navigazione.
- Barra di avanzamento aggiornata durante lo scorrimento e voce Live Show contrassegnata come sezione corrente.
- Ritorno al contenuto tramite skip link verificato.
- Verifica visuale mobile ancora pendente come nella prima fase. Riduzione movimento gestita nel codice e nel CSS; non emulata nel browser cloud.

## Chi siamo e contatti — revisione del 13 ottobre

- Team recuperato dalla vecchia pagina `contatti.html`: Marcello Lachina, Salvatore MOODY Di Majo, Alan Marotta, Francesco Lega.
- Foto originali conservate e copie WebP per la home (99.046 byte complessivi). Ruoli, testi sintetici e Instagram ripresi dai profili esistenti; nessun collegamento segnaposto aggiunto.
- Biografie consultabili nelle schede con `details/summary`, senza uscire dal nuovo design; schede responsive a quattro, due o una colonna.
- Sezione contatti ampliata con Marcello, telefono, WhatsApp, email, sede, orari e social già pubblicati nel sito originale.
- Google Maps incorporato con lazy loading, titolo accessibile e indirizzo completo; collegamento esterno Maps conservato dalla vecchia pagina.
- Nuovo collegamento “Chi siamo” nel menu e animazioni di ingresso estese al team e al blocco contatti.
- Verifica desktop: quattro foto caricate, nessun overflow orizzontale, apertura/chiusura della biografia di Marcello, mappa caricata con indirizzo Via Pasolini Pier Paolo 7, Caltanissetta. Riferimenti locali e ID univoci controllati; sintassi JS e whitespace superati.
- Verifica visuale mobile ancora da completare. Nessun messaggio inviato e nessun modulo esterno compilato.
- Aggiornamento logo: `object-fit: contain` evita il ritaglio del PNG completo a tutti i breakpoint.
