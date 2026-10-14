# Lavoro personale, ore, modelli e consegne

Il portale resta esclusivamente interno a Emme Studio. La nuova voce **Il mio lavoro** contiene cinque viste collegate ai progetti.

## Assegnazioni e urgenze

Attività e schede produttive possono essere collegate all’email di un account del team abilitato, anche prima del suo primo login Google. Il proprietario è sempre disponibile nella directory. Non vengono creati account, inviati inviti o collegati automaticamente i nomi storici: il testo già presente si conserva finché viene selezionata una persona. Le assegnazioni di persone disabilitate si conservano nello storico; non sono selezionabili per nuovi incarichi.

La vista personale mostra le attività, schede produttive e verifiche aperte assegnate all’email autenticata. L’assegnazione non modifica i permessi del workspace. Urgenze distingue ritardi, scadenze entro sette giorni (oggi incluso), revisioni in attesa e voci senza responsabile o data. Le scadenze di incassi e fornitori sono riservate all’amministratore.

## Ore lavorate

Registro per progetto, persona, data, minuti, fase e scheda produttiva opzionale. Una registrazione deve descrivere lavoro effettivamente svolto: date future e durate non valide vengono rifiutate. Limite di 24 ore complessive al giorno per persona, protetto anche contro inserimenti simultanei. I collaboratori con ruolo Modifica possono inserire e correggere le proprie ore; l’amministratore può registrare ore per il team e correggere le altre registrazioni. Consultazione non può scrivere.

Le correzioni conservano versioni e autore. L’annullamento richiede una motivazione ed esclude la registrazione dai totali senza cancellare lo storico. Stima del progetto e ore effettive permettono di vedere lo scostamento; il rapporto preventivo/ore è indicativo e riservato all’amministratore. Non si generano automaticamente fatture, tariffe o costi.

## Modelli

Singolo, Album, Live e Percorso artistico: attività iniziali, verifiche di consegna e, ove previste, schede brano/show. Numero brani configurabile (1–50), referente iniziale e stima ore. Si applicano a un progetto esistente, una sola volta, in una transazione. Non sovrascrivono il lavoro presente: se il progetto contiene già brani o uno show, non vengono generati duplicati di quel tipo. Titoli, incarichi e scadenze si completano dopo l’applicazione. Le stime si possono aggiornare con controllo versione.

## Checklist

Verifiche per progetto o brano, con referente, scadenza, note, obbligatorietà e stato. Le verifiche obbligatorie aperte impediscono di segnare il progetto Completato o il brano Consegnato. Dopo la consegna occorre riattivare il lavoro prima di riaprire una verifica obbligatoria. L’archiviazione conserva il lavoro anche se ritirato/incompleto, senza dichiararlo completato. Solo l’amministratore può rendere facoltativa una verifica obbligatoria già presente. Cronologia conservata con autore, data e versione.

## Backup privati

Spazio Vercel Blob privato `emme-studio-private-backups`, collegato soltanto al progetto Emme Studio. Il job giornaliero `/api/cron/backup` è previsto alle **04:00 UTC** (06:00 italiane in estate, 05:00 in inverno); il pianificatore può eseguirlo nella propria finestra di precisione. Richiede un segreto server, l’ID del progetto Emme Studio e l’ambiente Production.

L’export usa uno snapshot coerente del database. La copia viene caricata privata, riletta e confrontata con SHA-256 prima di confermare il successo. Se la rilettura fallisce, si tenta di rimuovere esclusivamente la nuova copia fallita. Le copie precedenti non vengono cancellate automaticamente.

L’amministratore trova elenco, download e **Crea backup adesso** nella vista Consegne. Le copie comprendono dati operativi, ore, piani, checklist e cronologie; escludono sessioni/password/token Google, eventi Calendar e file nei servizi esterni. Sono copie dell’applicazione, non una certificazione della retention/PITR di Neon. Download e lista verificano workspace e ruolo; i file non hanno URL pubblici utilizzabili senza credenziali.

Export aggiornato al formato v2; ripristino locale dei dati verificato su PostgreSQL WASM. Il ripristino mantiene disabilitati i membri del team e richiede schema e account proprietario predisposti. Gli export v1 restano compatibili, con le nuove tabelle vuote. Nessun ripristino viene eseguito sul database operativo.

## Verifiche e limiti

Test su validazioni, assegnazioni, isolamento, tempi, concorrenza, template ripetuti, blocchi di consegna, storia, backup privati e checksum. Prove browser con moduli reali e API reali sul database locale isolato, desktop/mobile; compilazione Next.js e controlli degli accessi anonimi sul deployment. OAuth è esterno all’harness: il login reale di un collaboratore e la revoca della sua sessione vanno ancora collaudati con un account effettivamente abilitato. La prima copia reale viene verificata dopo il deployment; il ciclo giornaliero successivo non si può anticipare come verifica avvenuta.

Tutto sul branch `restyling-cinematic-2026`, senza modifiche a main, DNS o progetto/database Accademia. È stata mantenuta la struttura della scheda brano introdotta dagli aggiornamenti più recenti.

## Stato dell’autorizzazione ai backup reali

La verifica automatica delle autorizzazioni ha rifiutato l’attivazione di una copia reale contenente dati personali ed economici su Vercel Blob, richiedendo autorizzazione specifica dell’utente al contenuto e alla destinazione. Nessuna copia reale è stata verificata. La pianificazione cron è rimossa e i comandi di trasferimento richiedono `STUDIO_BACKUPS_ENABLED=true`, non impostato. Dopo approvazione esplicita saranno attivati il trasferimento e il job giornaliero, e verificata la prima copia. Il deposito privato è predisposto.
