# Emme Studio — backend del portale

Prima fase: applicazione Next.js separata dal sito GitHub Pages, accesso Google riservato al proprietario verificato, token OAuth cifrati nel database, stato di configurazione esplicito e pagine escluse dall'indicizzazione.

La sincronizzazione Calendar e gli accessi del team NON sono ancora attivi. Nessun evento reale viene scritto. Il client OAuth iniziale richiede solo identità; lo scope Calendar sarà richiesto separatamente al collegamento del calendario.

## Configurazione
Progetto Vercel dedicato, root directory `portal-backend`. Non cambiare il progetto Accademia né il branch main.
Impostare le sei variabili di `.env.example` sul progetto Vercel. Generare BETTER_AUTH_SECRET casuale di almeno 32 caratteri, non copiarlo in chat o nel repository.
Creare un client OAuth Google di tipo Applicazione web con callback esatta:
`https://<indirizzo-tecnico-verificato>/api/auth/callback/google`.
Non usare un indirizzo ipotetico o quello di htmlpreview.

Provisionare un database Postgres separato. Dopo linking e verifica ambiente, generare e applicare lo schema Better Auth con la CLI ufficiale della versione installata, includendo rateLimit. Nessuna migrazione automatica al build e nessun seed demo.

## Verifica
`npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
Solo dopo configurazione e migrazione: avviare e verificare OAuth, rifiuto account diversi e revoca sessioni. GET `/api/health` espone soltanto lo stato, senza valori delle variabili.

## Fasi successive
Collegamento calendario dedicato con scope minimo; archivio persistente appuntamenti/outbox; sincronizzazione bidirezionale con etag, watch, syncToken e recupero errori; test end-to-end; permessi per team e progetti. Specifica: `../docs/GOOGLE-CALENDAR-INTEGRATION.md`.
