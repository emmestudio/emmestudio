# Accessi del team — prima fase

Ruoli: amministratore (email Google verificata configurata), Modifica (editor) e Consultazione (viewer). Questi accessi coprono tutti i dati operativi del workspace Emme Studio: gli artisti non hanno account o accesso al portale.

L'amministratore abilita una precisa email Google, nome, ruolo e stato. Il default è Consultazione. Nessun account è abilitato automaticamente e nessuna email viene inviata. Dopo il primo login autorizzato il profilo è creato da Better Auth; non si gestiscono password locali.

Google Cloud è ancora in modalità test: ogni nuova email deve essere aggiunta dal proprietario agli utenti di test di Emme Studio Portal. È un passaggio distinto dall'abilitazione nel portale.

Consultazione: dashboard/artisti/progetti/produzione/attività/calendario in lettura. Modifica: anche creazione e aggiornamento di artisti, progetti, schede produttive e attività, creazione/modifica/cancellazione degli appuntamenti consentiti. Solo amministratore: gestione accessi, preventivi, incassi, costi, esportazione e scadenze economiche, e collegamento/rinnovo Calendar. Il responsabile testuale delle attività rimane un dato organizzativo e non determina i permessi.

Controlli server a ogni richiesta; una revoca o cambio ruolo si applica anche alle sessioni esistenti. owner_id delle risorse resta quello del workspace: viene ricavato sul server dall'accesso approvato. Il token Calendar del proprietario è letto esclusivamente sul server dopo controllo del ruolo e usato soltanto per il calendario dedicato; non viene trasmesso al collaboratore. I collaboratori non devono autorizzare il proprio calendario personale.

Le pagine/API di gestione accessi verificano ownerSession. La sezione economica verifica workspaceSession con ruolo admin. Le API ordinarie usano workspaceSession; tutti i comandi di scrittura controllano canEdit. Il ruolo admin non può essere assegnato dal form. L'email amministratore non può essere disabilitata o modificata da questa sezione. Modifiche accessi con controllo versione, nessuna cancellazione definitiva.

Migrazione additiva `db/004-members.sql`, eseguita esplicitamente solo sul progetto Emme Studio Production. Il build ordinario rimane `npm run build`. Nessuna modifica al progetto o database Accademia.

Verifiche locali: policy per ruoli sconosciuti/consultazione, impedimento elevazione ad admin e protezione email proprietario; revisione dei controlli su tutte le API; TypeScript e build. Il login con un secondo account e il collaudo delle revoche sono da eseguire dopo che l'amministratore abilita un collaboratore reale.
