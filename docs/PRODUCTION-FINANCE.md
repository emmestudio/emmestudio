# Preventivi dei lavori in Produzione

Brani, registrazioni (anche sessioni dentro un brano), show live e servizi singoli hanno un preventivo autonomo, con importo modificabile, stato, voci, quantità, condizioni e riferimento di conferma. La sezione è riservata all’amministratore, sia nel browser sia nella API. Per gli altri membri del team, il salvataggio dei dati operativi non sovrascrive gli importi.

In creazione o modifica: «Aggiungi preventivo / importo» abilita i campi. Scheda operativa e preventivo vengono salvati nella stessa transazione. Gli importi non confermati restano preventivi; quelli confermati alimentano Guadagni, dove si registrano incassi, rate, scadenze e storni con gli stessi vincoli dei progetti. Il PDF usa il layout esistente e mostra artista, lavoro e servizio corretti. Il profilo artista include i lavori nei riepiloghi economici riservati.

Ogni preventivo rappresenta un addebito autonomo. Non duplicare nel preventivo del lavoro una somma già compresa nel preventivo del progetto o del brano. Il portale non ricava o ripartisce automaticamente gli importi dei figli nel preventivo del progetto. «Importo del lavoro» è il prezzo addebitato all’artista; i costi dei fornitori rimangono nel registro Costi esistente.

Il menu Servizi singoli contiene: Riarrangiamento Cover, Servizio Mix, Servizio Master, Mix & Master, Reamp, Post-produzione audio, Altro. «Altro» richiede una specifica; scegliendo una voce standard la specifica viene rimossa. I vecchi nomi personalizzati vengono riaperti come Altro mantenendo il testo.

## Dati e compatibilità
La migrazione 010 introduce `studio_finance_targets`, con riferimento esclusivo a un vero progetto o a una vera scheda produzione. Non crea progetti nascosti. Le tabelle economiche mantengono i loro campi e i dati precedenti; il campo tecnico project_id dei preventivi e movimenti identifica ora il soggetto economico. Le nuove FK assicurano l’isolamento del workspace. Un trigger registra i nuovi progetti anche per compatibilità con il codice precedente. I dati economici sono conservati durante lo spostamento nel cestino; l’eliminazione definitiva di un progetto rimuove anche i preventivi dei suoi lavori, lasciando intatti quelli autonomi dell’artista.

Gli export locali usano la versione 3, includendo i riferimenti economici. Il ripristino supporta anche le versioni 1 e 2 e richiede uno schema fino a 010, su un database locale vuoto. Il ripristino è verificato solo con dati sintetici. Backup automatici e trasferimenti verso Blob restano disabilitati.

## Verifiche mirate
- `node test/production-finance.integration.mjs`: quote per tutti e quattro i tipi, calcoli in centesimi, incassi/rate, rollback scheda+preventivo, versioni, isolamento, permessi editor/viewer, contenuto del PDF, servizi/Altro, preventivi di progetto, export/ripristino isolato e cancellazione definitiva del progetto.
- `node test/direct-artist.integration.mjs`: regressione dei lavori senza progetto e loro collegamenti.
- `node test/production-finance.visual.mjs`: componenti reali, HTTP simulato, creazione desktop/mobile e campi Altro/preventivo.
- Build Next.js e TypeScript. Nessun test crea incassi, eventi Calendar o file sui servizi reali.
