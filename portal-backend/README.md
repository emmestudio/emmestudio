# Emme Studio — backend del portale

Applicazione Next.js separata dal sito GitHub Pages, accesso Google riservato al proprietario verificato e ai collaboratori abilitati, token OAuth cifrati nel database e pagine escluse dall'indicizzazione.

Dashboard e archivio persistente dei progetti; calendario dedicato con lettura e scrittura dirette su Google. Lo scope Calendar è autorizzato separatamente dall'identità. Accessi del team con ruoli Consultazione e Modifica, abilitati dall’amministratore. Gli account artista limitati a singoli progetti non sono ancora disponibili. Specifiche e limiti: `../docs/CALENDAR-APPOINTMENTS.md` e `../docs/PROJECT-MANAGEMENT.md`.

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

## Migrazioni delle nuove funzionalità
La tabella progetti è descritta in `db/002-projects.sql`; `scripts/migrate-projects.mjs` è un comando esplicito di configurazione sul progetto Emme Studio. Il build ordinario resta `npm run build`, senza seed, test su eventi esterni o migrazioni automatiche.

## Fasi successive
Permessi per artisti e singoli progetti, brani/versioni, revisioni e archivio file. Il calendario usa Google come unico archivio degli eventi: non occorre un outbox o un mirror nel database in questa prima versione. Un eventuale mirror con webhook richiederà una fase separata.

## Artisti e controllo economico

Profili artista collegati ai progetti, direzione artistica e panoramica dei lavori. I progetti includono servizio e preventivo; il registro Guadagni gestisce rate, incassi parziali e storni, con accesso riservato all’amministratore. Dettagli operativi, migrazione e verifiche: [ARTISTS-AND-FINANCE](../docs/ARTISTS-AND-FINANCE.md).
