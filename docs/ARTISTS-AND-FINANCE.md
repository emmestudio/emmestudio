# Artisti, progetti e controllo economico

## Percorso operativo

1. In **Artisti**, crea il profilo con nome, email, telefono, genere, link e note. Attiva la direzione artistica e indica il referente e gli obiettivi del percorso.
2. In **Progetti**, seleziona un artista registrato oppure scegli “Crea un nuovo artista”. Il nuovo profilo, il progetto e l’eventuale preventivo vengono salvati in una sola transazione.
3. Inserisci il servizio (anche personalizzato), il tipo di progetto, l’avanzamento e la scadenza operativa. L’importo del preventivo è editabile e separato dallo stato operativo del lavoro.
4. Il preventivo può essere Bozza, Inviato, Confermato o Rifiutato. **Solo Confermato** genera un importo da incassare. I preventivi non vengono inviati automaticamente.
5. In **Guadagni**, pianifica una o più rate e registra gli incassi realmente ricevuti, con data, metodo e note. Le rate non generano incassi automaticamente.

La scheda artista raggruppa i progetti in **Da realizzare**, **In realizzazione**, **Realizzati** e **Archivio**, con collegamenti alle schede operative. La direzione artistica è un’assegnazione organizzativa al team/referente, non un account di accesso dell’artista.

## Regole economiche

- Importi in EUR, memorizzati come centesimi interi. Nessuna stima automatica di IVA, costi o imposte. “Incassato” indica entrate ricevute, non utile netto.
- Il totale delle rate non può superare il preventivo. È possibile lasciare parte del saldo senza una data; questo residuo è evidenziato come da pianificare.
- Gli incassi coprono le rate dalla scadenza più vicina, con ID come ordinamento stabile per rate dello stesso giorno. Il piano è interno: non indica un pagamento bancario o un’allocazione contabile legale.
- Gli incassi registrati non possono superare il saldo ancora disponibile e non possono essere datati nel futuro. Per somme future si usa una rata.
- Una rata è scaduta se la data precede il giorno corrente in Europe/Rome e resta un importo da pagare. Le scadenze di oggi sono imminenti, non scadute.
- Le registrazioni errate si **stornano con motivazione**: restano visibili nel registro, escono dagli incassi attivi e riaprono il saldo. Non viene eseguito alcun rimborso esterno.
- Una rata può essere rimossa e reinserita; gli incassi restano conservati e vengono riallocati sulle rate restanti.
- Un preventivo con incassi attivi deve restare confermato. L’importo non può scendere sotto gli incassi attivi o sotto le rate pianificate.
- Versioni e blocchi sulla riga progetto proteggono dai salvataggi simultanei. Quote, rate e pagamenti letti insieme usano uno snapshot coerente del database.
- Il filtro mese riguarda gli incassi; i totali dei residui seguono la vista artista/progetto e sono sempre complessivi. Ricerca e stato filtrano solo l’elenco delle schede.

## Accessi e isolamento

Artisti e progetti seguono i permessi esistenti (editor modifica, viewer consulta). Preventivi, importi, incassi e scadenze economiche sono riservati all’amministratore. Le API operative non restituiscono il registro economico agli altri ruoli. I collegamenti artista–progetto e progetto–finanze hanno vincoli compositi sul proprietario dello spazio di lavoro.

Le scadenze di pagamento sono promemoria del portale. Gli appuntamenti continuano a usare il calendario Google dedicato, con il flusso esistente. Nessuna email, fattura, addebito o evento Calendar viene creato da queste funzioni.

## Migrazione

`005-artists-finance.sql` aggiunge tabelle e colonne al database Emme Studio. I progetti già presenti generano profili essenziali raggruppati solo per **nome esatto e proprietario**; non vengono inventati contatti, preventivi o assegnazioni. Il nome storico del progetto resta conservato, mentre la visualizzazione segue il profilo collegato.

Il runner verifica l’ID del progetto Vercel Emme Studio, l’ambiente Production, l’URL configurato e la lista delle tabelle attese, ed esegue la migrazione in una transazione con advisory lock. Non coinvolge il database Accademia. La build ordinaria resta `npm run build`; il runner è usato soltanto nel deployment esplicito di migrazione.

## Verifica riproducibile

- `npm test`: validazioni, importi, rate, storni, direzione artistica, permessi e test precedenti.
- `npm run test:integration`: servizi e handler API reali contro PostgreSQL WASM locale (PGlite), senza credenziali e senza connessioni a servizi esterni. Verifica transazioni, rollback, isolamento, autorizzazioni, retry, concorrenza e migrazione ripetibile.
- `npm run typecheck` e `npm run build`: TypeScript e compilazione Next.js.
- `npm run test:visual`: componenti reali e API reali sul database locale; richiede Playwright e Chromium installati. Usa le dipendenze browser dell’ambiente Codex quando disponibili. Playwright è incluso nelle dipendenze di sviluppo; in un ambiente normale installare il browser con `npx playwright install chromium`; è supportata anche la variabile `VISUAL_CHROMIUM_EXECUTABLE`. Il test sostituisce soltanto sessione, pool e routing Next con un harness locale. **Non verifica OAuth o una sessione autenticata sul deployment**.

Le schermate di prova, quando generate (PNG, con copie WebP compresse nel repository), sono in `docs/portal-management-preview/` e contengono esclusivamente dati dimostrativi locali.
