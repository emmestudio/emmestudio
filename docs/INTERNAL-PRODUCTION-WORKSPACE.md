# Emme Studio — organizzazione interna del lavoro

Il portale è riservato allo studio e al team autorizzato. I profili artista sono anagrafiche organizzative: non creano account e non permettono agli artisti di accedere.

## Produzione

La nuova voce **Produzione** è raggiungibile dalla navigazione, dalla scheda progetto e dalla panoramica giornaliera. Filtri per progetto, brano, ricerca e lavori aperti.

- **Brani**: preproduzione, registrazione, editing, mix, mastering, consegna e archivio; BPM, tonalità, crediti, testo, significato, reference, referente e scadenza.
- **Registrazioni**: una scheda per parte/strumento e musicista, associata a un brano; tecnico/studio, data sessione, link e stato. Per segnare Registrata è richiesta una data effettiva, non futura.
- **Materiali e versioni**: tipo, versione, URL HTTPS e stato. Link a Drive o ad altri servizi; nessun upload o cambiamento automatico dei permessi esterni. Ogni aggiornamento conserva il vecchio URL nella cronologia.
- **Revisioni**: versione interessata, feedback riportato dal team, interventi e stato. Per Approvata servono data e provenienza dell’approvazione ricevuta. La registrazione è interna, non una firma o un consenso acquisito dal portale.
- **Show live**: data/venue, organico, scaletta, prove, service, rider, sequenze/click/cue, LTC/MTC, MIDI, luci/visual e piano backup. Per Realizzato serve la data effettiva dello show.

Ogni scheda conserva titolo, responsabile, scadenza, note e cronologia con autore della registrazione. Versioni ottimistiche e transazioni impediscono di sovrascrivere un aggiornamento recente. I collegamenti a brani sono verificati sullo stesso progetto e workspace. I progetti archiviati consentono solo la consultazione delle schede produttive.

Responsabili e musicisti sono campi organizzativi, non autorizzazioni o destinatari di notifiche. Scadenze, sessioni e prove registrate nelle schede non creano appuntamenti: gli appuntamenti reali si gestiscono nel Calendario Google già collegato.

## Workspace dei singoli brani (ottobre 2026)

La sezione **Produzione** espone tre aree principali: **Brani**, **Registrazioni** (autonome) e **Show live**. La scheda di ciascun brano si apre con `Apri scheda brano` e contiene:

- **Panoramica**: progetto e artista assegnato al progetto, stato e scadenza, BPM, tonalità, durata, genere, arrangiamento, crediti, testo, significato, reference e note.
- **Sessioni**: schede separate per registrazione strumenti, voce, editing, mix, mastering e altro. Ogni sessione conserva titolo, stato, responsabile, tecnico/studio, data effettiva, link, take e resoconto; il collegamento al brano è automatico.
- **Materiali e versioni** e **Revisioni**: le nuove schede sono create nel contesto del brano, con collegamento obbligatorio e cronologia individuale. I materiali e le revisioni precedenti senza associazione restano leggibili in una sezione di recupero per essere collegati al brano corretto.
- **Registrazioni autonome**: nella tab Registrazioni le nuove sessioni possono essere associate a un progetto anche senza essere associate a un brano, per servizi di recording, editing, mix e mastering indipendenti. Il progetto è ancora obbligatorio e ne identifica l'artista; la scheda del brano è facoltativa.

Le relazioni sono protette lato server: un elemento collegato a un brano deve appartenere al medesimo progetto. Non si eseguono cancellazioni o spostamenti automatici dei documenti già registrati e non sono richieste nuove migrazioni SQL. Le schede passate rimangono compatibili anche quando non contengono i campi introdotti ora.

Verifiche aggiuntive: 27 test unitari, test di integrazione sul database locale con sessioni autonome e materiali collegati, build TypeScript/Next.js, flussi browser Playwright desktop e mobile con controllo dei dialog e dell'assenza di overflow.

## Preventivi

Importo libero oppure voci con descrizione, quantità (anche ore decimali) e tariffa. Quantità memorizzate in centesimi di unità e prezzi in centesimi di euro; totale per voce arrotondato al centesimo, somma controllata sul server. Il totale delle voci deve coincidere con il preventivo.

Conferma registrata con data e riferimento. La prima conferma senza data esplicita usa la data corrente dello studio; le conferme storiche già presenti senza data non vengono retrodatate automaticamente. Le versioni precedenti di importi, voci e condizioni restano consultabili. La versione del registro aumenta anche durante le operazioni di pagamento, quindi la cronologia dei preventivi può avere numeri non consecutivi.

In Guadagni, **Preventivo · PDF e cronologia** apre una pagina riservata con logo, dati del progetto, voci, totale e condizioni. **Stampa / Salva PDF** usa la stampa del browser e il formato A4. Nessun invio automatico, fattura, firma elettronica o calcolo di imposte.

Restano applicate le regole su incassi e rate di `ARTISTS-AND-FINANCE.md`: un preventivo con incassi attivi resta confermato e non può scendere sotto incassi o rate pianificate.

## Costi e margini

Da Guadagni si apre **Costi e margini**, riservato all’amministratore.

Categorie: musicisti, collaboratori, service, studio esterno, foto/video, promozione, attrezzatura e altro. Dati: fornitore, importo, scadenza, note e stato Previsto / Da pagare / Pagato / Annullato. Per Pagato serve la data effettiva del pagamento. Annullato conserva il record e la cronologia, escludendolo dai calcoli. Il costo rappresenta una singola voce; per uscite suddivise in più pagamenti si possono registrare voci distinte.

- **Costi previsti complessivi**: somma di tutte le voci non annullate, comprese quelle già pagate.
- **Margine stimato**: preventivi confermati meno costi previsti complessivi.
- **Saldo incassi − uscite**: incassi attivi meno costi pagati.

Gli indicatori sono interni e dipendono dai costi inseriti: non includono automaticamente imposte, ammortamenti o spese generali. Il filtro progetto cambia i totali; il filtro di stato cambia solo l’elenco. Scadenze fornitori visibili con segnalazione dei ritardi. I progetti archiviati possono ancora ricevere aggiornamenti economici per chiudere i saldi.

## Esportazione e ripristino

L’amministratore può scaricare un JSON con artisti, progetti, attività, produzione, preventivi, rate, incassi, costi, cronologie e elenco del team. La lettura usa una transazione con snapshot coerente. Esclusi password, sessioni, token, account OAuth, identificativi di proprietario e digest delle richieste. I dati degli eventi Google e i file esterni non sono inclusi: restano nei rispettivi servizi.

`restoreBusinessExport` ripristina i dati in una transazione, senza cancellazioni, rifiutando un database operativo già popolato e campi/tabella non previsti. Gli accessi del team vengono ripristinati **disabilitati**. È necessario un proprietario locale già presente nello schema auth. L’esportazione è un backup dei dati di lavoro, non delle credenziali o dei documenti esterni.

Il comando `scripts/restore-local.mjs` è limitato a un database locale vuoto, con nome `emme_restore_*`, URL `EMME_RESTORE_DATABASE_URL` e consenso esplicito `EMME_ALLOW_LOCAL_RESTORE=1`. Non è un endpoint del portale, non viene eseguito nei deployment e non accetta destinazioni Vercel/remote. Lo schema deve essere predisposto con le migrazioni, prima del ripristino. Il ripristino è stato verificato con PostgreSQL WASM locale; non è stato eseguito sul database operativo. La retention e gli eventuali backup automatici del provider non sono stati verificati in questa fase.

## Migrazione e verifiche

`006-production-finance.sql` aggiunge tabelle e colonne, conservando i dati esistenti e creando lo snapshot iniziale dei preventivi. Runner limitato al progetto Emme Studio Production con controllo delle tabelle attese. Build ordinaria `npm run build`. Nessuna modifica ad Accademia, main, DNS o dominio custom.

Verifiche: 27 test unitari; servizi e API reali contro database locale per cronologie, collegamenti, quote dettagliate, costi, isolamento dei ruoli, esportazione e ripristino; moduli desktop/mobile per brani, materiali, revisioni, show, voci preventivo e costi; controllo visivo del PDF A4; TypeScript e build Next.js. La sessione, il pool e il routing sono isolati nell’harness di test. OAuth e login di un collaboratore reale restano da collaudare con gli account effettivi.
