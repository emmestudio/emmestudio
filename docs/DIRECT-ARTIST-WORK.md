# Lavori direttamente collegati all’artista

In Produzione, l’artista è il riferimento e progetto/album è facoltativo. Sono disponibili brani, registrazioni autonome, live e servizi singoli (arrangiamento, mix, mastering, consulenza e altri servizi descritti dal team). Materiali e revisioni restano dentro il brano; le sessioni di registrazione possono essere autonome oppure collegate al brano.

Dalla scheda Artista: «+ Brano singolo», «+ Registrazione», «+ Servizio singolo» aprono il modulo già assegnato all’artista. La scheda raccoglie i lavori senza progetto e ne include gli stati nei contatori. Il filtro artista in Produzione consente di consultare tutti i lavori dell’artista.

La migrazione 009 rende facoltativo project_id e aggiunge artist_id con chiave esterna composta per workspace, preservando i collegamenti esistenti. Nessun progetto tecnico o nascosto viene creato. Le letture ricavano l’artista dal progetto per compatibilità con i template esistenti.

L’assegnazione successiva di un brano a un progetto sposta nella stessa transazione anche sessioni, materiali e revisioni, inclusi quelli cestinati, incrementandone le versioni e registrando lo storico. L’artista deve corrispondere a quello del progetto. Se esistono ore o verifiche di consegna collegate al progetto, lo spostamento viene bloccato per evitare incoerenze. Non si possono riassegnare le schede figlie separatamente dal brano.

Non è possibile cestinare un artista con lavori singoli ancora attivi. Un progetto eliminato definitivamente non rimuove i lavori autonomi dell’artista. Le schede di artisti cestinati non vengono mostrate e non sono modificabili.

Preventivi, contabilità, costi, attività generali, ore e verifiche di consegna restano riferiti ai progetti: questa fase aggiunge autonomia alla produzione, senza trasferire o modificare dati economici esistenti. Nessun evento Google Calendar o file esterno viene modificato.

Verifica mirata: `node test/direct-artist.integration.mjs` su PGlite isolato, con migrazione ripetuta, backfill, creazione senza progetto, sessioni/versioni/revisioni, servizi e live, collegamento e scollegamento album, storico figli, isolamento tra workspace e artisti, retry/versioni, cestino e conservazione dei lavori autonomi dopo purge del progetto. Verificati build e form desktop/mobile senza usare dati reali. Lo schema 009 è necessario anche nel database locale vuoto utilizzato per il ripristino degli export.
