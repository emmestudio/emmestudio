# Archivio artisti e produzione live

## Attivazione

1. Nel solo progetto GCP `emme-studio-portal` abilitare Google Drive API.
2. Google Auth Platform → Accesso ai dati: aggiungere `https://www.googleapis.com/auth/drive.file`.
3. Il titolare accede a `/archivio`, autorizza Google Drive con lo stesso account Google del portale e crea l'archivio.

Il consenso Google deve essere completato dalla persona titolare. Non richiede nuove variabili di ambiente, chiavi API o credenziali in chiaro. Better Auth conserva e rinnova i token sul server. Le autorizzazioni Calendar esistenti vengono conservate con il consenso incrementale Google. Non aggiungere l'ambito globale `drive`.

## Struttura e utilizzo

`Emme Studio — Archivio / Artisti / Nome artista`

- 01 · Profilo e direzione artistica
- 02 · Produzione musicale
- 03 · Immagine e comunicazione
- 04 · Produzioni live / Nome produzione
- 05 · Documenti e accordi

Ogni live contiene otto cartelle: Direzione e organizzazione, Band, Service e tecnica, Sequenze e programmazioni, Luci e video, Logistica, Comunicazione, Documenti e consuntivo.

La nuova voce `/live` usa le vere schede `studio_production.kind=live`, senza duplicare i lavori né imporre un progetto. Ogni live è collegato all'artista, direttamente o attraverso un progetto. Campi per data, venue, organico, scaletta, prove, band run, contatti, orari, checklist, logistica e sincronizzazioni. Preventivi già esistenti restano disponibili.

POST/PATCH artisti, creazione artista inline nel progetto e POST/PATCH produzione live avviano la sincronizzazione dopo il salvataggio del lavoro. Finché l'archivio non è attivato, i salvataggi restano validi e le cartelle possono essere completate dalla scheda. Un errore Google non annulla il lavoro già salvato. Le API restituiscono l'esito Drive separato dal salvataggio (artista/live).

Per le schede preesistenti usare «Crea / completa cartelle». Nomi aggiornati conservano gli stessi ID. Riassegnare un live e sincronizzarlo sposta la sua cartella nell'artista corretto. Se cambia l'artista di un progetto a cui è legato il live, sincronizzare la scheda live per riallinearne la posizione.

I file si caricano in Drive, raggiungibile dalle schede. Questa fase non implementa upload, anteprima dei file, Google Picker o import di cartelle preesistenti. Le sottocartelle organizzano i materiali: non inventano documenti, rider o accordi per lo spettacolo. Nessuna condivisione/invito viene inviato automaticamente. I permessi del portale e quelli Drive sono distinti: condividere manualmente con il team le aree appropriate; documenti economici e accordi possono richiedere permessi separati.

## Affidabilità e sicurezza

- Schema additivo `012-drive-archive.sql`, solo Emme, nessuna modifica al portale Accademia.
- Registry `studio_drive_folders` per owner/chiave soggetto; ID generato con Google `files.generateIds` e salvato **prima** della creazione esterna.
- Lock advisory per workspace su connessione dedicata; conflitti restituiscono 409. Non si tiene aperta una transazione DB durante operazioni Google.
- Retry sullo stesso ID anche dopo timeout/process crash: non vengono generate nuove cartelle duplicate.
- Cartella confermata ma eliminata/non accessibile: richiede ripristino su Drive; non viene ricreata silenziosamente. Cartella nel cestino: nessun ripristino automatico.
- API authenticate per workspace; root/configurazione solo titolare; sincronizzazione admin/editor; viewer consulta i collegamenti. Origin check per tutte le mutazioni. Nessun token esposto al client.
- Il cestino e la cancellazione definitiva di schede nel portale non eliminano cartelle o file Drive. Il registro resta per conservare riferimenti agli archivi.
- Export v4 include gli ID e collegamenti Drive, **non i file Drive**. Ripristino locale supporta v1-v4; i vecchi export hanno registro Drive vuoto. Nessun backup reale o cron attivato.
- Nessuna cancellazione, download, upload o condivisione di file da parte di questa integrazione.

## Verifiche

- `node test/drive-archive.integration.mjs`: DB PGlite e API Google simulate, timeout ambiguo, ID stabili, rinomina, spostamento artista, permessi/origin/tenant, errori Drive con salvataggio conservato, cestino e conservazione file.
- `node test/production-finance.integration.mjs`: regressioni preventivi, incassi, scadenze, atomicità, export/ripristino.
- `node test/drive-archive.visual.mjs`: componenti effettivi, HTTP locale simulato, 1440/390 px; attivazione archivio, errore/riprova, link, artista, campi live, overflow e errori JS. Chromium locale `/tmp/emme-chromium`.
- `npm run build`: TypeScript e build di produzione.

La creazione in un Drive reale e il consenso OAuth non sono certificati dai test simulati: completare il consenso del titolare ed eseguire una prima creazione reale autorizzata dal portale.
