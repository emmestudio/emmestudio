# Consolidamento portale — 17 ottobre 2026

## Stato e pubblicazione

Base controllata: commit `1566133`. Le correzioni si applicano solo al portale Emme Studio e al branch `restyling-cinematic-2026`; main e Accademia non sono coinvolti.

Schema additivo: `migrations/025-portal-consolidation.sql`, idempotente, con contatori versioni, letture personali e registro invii. Runner `scripts/migrate-consolidation.mjs` vincolato all'ID Vercel del portale Emme e al solo ambiente produzione.

La prima applicazione dello schema conteneva un errore di accesso ai campi del trigger condiviso anteprima/consegna. La funzione corretta usa `to_jsonb(NEW)` ed è presente nella migrazione corrente. La successiva pubblicazione è stata bloccata da Vercel: `api-deployments-free-per-day`, HTTP 402, oltre 100 deploy. Finché la funzione corretta non viene applicata tramite SQL Editor Neon o runner, gli insert/update delle anteprime/consegne possono fallire. Le transazioni fallite non eliminano dati. Non dichiarare la correzione online senza conferma dell'applicazione.

Dopo il ripristino dei deploy: eseguire il runner sul commit corrente (`node scripts/migrate-consolidation.mjs && npm run build` come override per un solo deploy). Il progetto deve restare con build normale `npm run build`. Verificare marker `EMME_CONSOLIDATION_READY` e deployment READY. Non inviare email reali né eseguire retention/backup come test di build.

## Correzioni

- Cancellazioni: pulizia dei metadati Area Artista prima di eliminare progetti/produzioni; ore collegate rimosse prima del brano; attività/artisti eliminabili dal cestino con titolo e versione, solo admin. Un artista con lavori va prima riassegnato o liberato da tutti i lavori. Drive e Calendar non vengono eliminati. Il Blob originale degli allegati non viene rimosso automaticamente dalla cancellazione delle schede.
- Export v5: include accessi artisti, contatori versioni, anteprime/eventi/consegne, messaggi, riferimenti allegati, notifiche/letture/invii e caselle/bozze email. Non include OAuth/refresh token, credenziali Google o file esterni Drive/Blob. I backup reali restano disattivati. Le credenziali richiedono riconnessione separata. Il ripristino supporta v1-v5, solo DB locale vuoto; disabilita accessi team/artisti, segna caselle da riconnettere e invii non confermati da verificare, senza rispedire nulla.
- Versioni: contatore DB indipendente dalle righe eliminate; nuova versione assegnata dal trigger a tutti i percorsi di creazione. Nessuna rinumerazione retroattiva dei vecchi nomi. Una versione storica già eliminata prima dell'introduzione del contatore non è ricostruibile dal solo registro corrente.
- Conservazione: ripubblicazione azzera `superseded_at`; file già eliminato non ripubblicabile. Controllo finale e lock transazionale condiviso sul file prima del cestinamento remoto. Nessun cron nuovo attivato. Il cron retention preesistente rimane con la sua pianificazione e gestisce al massimo tre file per esecuzione.
- Notifiche: letture personali per membro, consultazione a tutto il team; destinatari email studio = titolare + membri attivi; solo Gmail, nessun SMTP Aruba. Registro invii admin con coda/esito/errore/tentativi, claim atomico contro doppi invii, retry fallimenti certi e conferma esplicita dopo verifica Gmail per gli esiti incerti. Flag `MAIL_SEND_ENABLED` rispettato. I test usano un sender simulato, nessuna email reale inviata.
- Anteprime/consegne: notifiche solo al cambiamento effettivo, nessun invio ripetuto se il valore è già impostato. Dopo cambio stato il registro anteprime ricarica i dati per riflettere anche il ritiro delle altre versioni.
- Allegati chat: token autorizzato per messaggio/utente, upload privato diretto Blob fino a 10 MB; callback SDK verificata, controllo dimensione e firma del contenuto prima del collegamento. SDK privato richiede callback raggiungibile sul deployment reale. Vecchio percorso multipart limitato a 4 MB. Retry del solo allegato non ricrea il messaggio.
- Chat: filtro server per artista/brano, cursore timestamp+UUID con pagine di 100 messaggi e recupero dei precedenti, allegati limitati ai messaggi autorizzati della pagina, aggiornamento periodico senza perdere lo storico caricato, ruolo viewer senza modulo di invio.
- Guadagni: target attivi letti nella stessa transazione dei movimenti, senza richiedere una seconda connessione mentre la prima è occupata; esclusione coerente dei lavori nel cestino.
- Sessione: autenticazione distinta dal ruolo team, quindi l'artista vede il comando Esci senza ricevere privilegi team.

## Validazioni

`npm test`; `node test/consolidation.integration.mjs`; `node test/message-attachment-upload.integration.mjs`; `node test/production-finance.integration.mjs`; `node test/drive-archive.integration.mjs`; `node test/consolidation.visual.mjs`; `npm run build`.

I test di consolidamento usano PGlite, storage e Gmail simulati. Non certificano da soli OAuth, callback Blob privata, consegna email o streaming nel browser dei veri utenti. Dopo la pubblicazione fare il collaudo completo con account team e artista di prova, file non personali e invii esplicitamente autorizzati.

## Esito locale finale

Build di produzione e TypeScript superati su checkout isolato. Test unitari, gestione completa, produzione/finanza, Drive, nuovo consolidamento, upload privato simulato e controlli grafici a 390/1440 px superati. La pubblicazione applicativa rimane bloccata dal limite Vercel. La correzione SQL del trigger richiede applicazione sul solo database Emme Studio oppure il runner dopo lo sblocco dei deploy.
