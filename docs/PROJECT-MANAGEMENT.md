# Gestione progetti — prima fase reale

Il portale contiene dashboard, calendario Google e archivio persistente dei progetti. L'accesso resta limitato al proprietario verificato; i ruoli del team non sono ancora disponibili.

Schede: titolo, artista/gruppo, tipo (singolo, album, live, percorso artistico), stato, scadenza, visione/obiettivo, note e tre aree di lavoro (musica, live, immagine). Ogni area ha stato da avviare/in corso/completata, con indicatore manuale 0/50/100. La percentuale globale è una media, non una misurazione automatica del lavoro.

La dashboard usa dati reali e mostra progetti attivi, completati, prossimi appuntamenti Google e scadenze interne. Un servizio indisponibile mostra un messaggio o un trattino, senza sostituire dati reali con esempi. Le scadenze di progetto non creano appuntamenti Google automaticamente.

Creazione e modifica delle schede tramite API protette. owner_id deriva dalla sessione verificata e non dal client; ogni query filtra per proprietario. Versioni per evitare sovrascritture concorrenti, UUID e impronta iniziale per evitare creazioni duplicate dopo un retry. Non c'è cancellazione definitiva: lo stato Archiviato conserva il progetto e permette di riattivarlo.

Database: `db/002-projects.sql` crea solo tabella e indice nuovi. `scripts/migrate-projects.mjs` verifica progetto Vercel, ambiente Production e tabelle attese, poi esegue la migrazione in transazione. Nessun seed e nessun accesso al database Accademia. Il build ordinario resta `npm run build`.

Verifiche: 14 test locali, TypeScript e build. L'interfaccia autenticata e il salvataggio reale delle schede richiedono ancora collaudo con l'account amministratore. Nessuna immagine, biografia o dato reale di artisti è stato aggiunto automaticamente.

Prossime fasi: accessi e permessi del team, brani/versioni/revisioni, attività e documenti, eventuale collegamento degli appuntamenti alle schede progetto.
