# Attività collegate ai progetti

Bacheca persistente con stati Da fare/In corso/Completata; titolo, progetto, responsabile testuale, priorità, scadenza e note. Ricerca e filtro per progetto, indicazione delle attività scadute e riepilogo in dashboard. I progetti archiviati mantengono le attività consultabili dal filtro, con modifica sospesa fino alla riattivazione del progetto.

Il responsabile è un riferimento organizzativo, non un nuovo account. Nessuna email o notifica viene inviata. Gli accessi del team richiedono ancora una fase dedicata. Le scadenze sono interne; sessioni, riunioni e live restano appuntamenti da inserire nel calendario Google.

API protette da sessione amministratore e controllo Origin. Il proprietario deriva dal server. Il vincolo composito nel database impedisce di collegare un'attività al progetto di un altro proprietario. Creazioni con UUID e impronta della richiesta, aggiornamenti con versione per prevenire sovrascritture concorrenti.

Migrazione additiva `db/003-tasks.sql`, eseguita esplicitamente da `scripts/migrate-tasks.mjs` solo sul progetto Emme Studio Production. Nessun seed o dato Accademia. Il comando standard di build resta `npm run build`.

Verifica: test locali per dati obbligatori, stati, priorità, scadenze e ritardi; TypeScript e compilazione. Il salvataggio e la resa visiva nell'interfaccia autenticata restano da collaudare con l'amministratore.
