# Gestione operativa e cestino Emme Studio

## Uso quotidiano

In Progetti sono disponibili Bacheca, Elenco, Settimana e, per gli amministratori, Cestino.
La bacheca raggruppa gli stati esistenti: Pianificazione → Da pianificare, In produzione/Attivo → In lavorazione, In uscita → Da consegnare, Completato/Archiviato → Completati. Un motivo di attesa sposta un progetto attivo in In attesa. La ricerca e il filtro restano applicati alle viste.

Nella scheda progetto, la Cabina di regia raccoglie referente, collaboratori, fase, prossima azione, motivo di attesa e data di ricontatto. Tutti i dati della scheda si salvano insieme con Salva progetto, in una transazione che comprende anche l’eventuale preventivo. I percorsi delle fasi differiscono per Singolo, Album, Live e Percorso artistico. Le fasi sono dichiarazioni del team, non certificazioni automatiche del lavoro completato.

Il riepilogo mostra attività completate, ore effettivamente registrate, checklist e, solo all'amministratore, incassi e residuo del preventivo confermato. La matrice dei brani riporta lo stato del brano e il rapporto sessioni completate / pianificate per strumenti, voce, editing, mix e mastering. L'assenza di sessioni non equivale a completamento.

In Attività, Dipendenze permette di selezionare attività dello stesso progetto. Il server impedisce cicli e l'avvio/completamento prima dei prerequisiti. Una attività completata non può essere riaperta se ci sono lavori dipendenti già avviati: occorre riportarli prima a Da fare. Per spostare o eliminare un prerequisito ancora referenziato occorre prima rimuovere le dipendenze.

Settimana mostra i prossimi sette giorni e le scadenze arretrate, le attese, le verifiche di consegna e il carico in numero di attività e schede aperte. I conteggi non sono stime di durata. Gli appuntamenti sono letti da Google Calendar; le sessioni di produzione restano distinguibili dagli appuntamenti sincronizzati. In Calendario si può associare un progetto e annotare partecipanti/musicisti, conservando luogo e inizio/fine. Le annotazioni non inviano inviti e non aprono accessi agli artisti.

## Eliminazione e ripristino

Solo gli amministratori possono eliminare e ripristinare progetti, artisti, attività e schede di produzione (brani, registrazioni, materiali, revisioni, show). È richiesta la conferma del titolo esatto.
L'eliminazione usa un cestino, senza distruzione del record. Eliminare un progetto nasconde i suoi contenuti operativi; eliminare un brano nasconde anche le schede collegate. Non vengono cancellati file Drive, appuntamenti Google, preventivi, scadenze, pagamenti, costi o ore storiche. La contabilità conserva il progetto rimosso. Le schede eliminate separatamente restano nel cestino anche quando il progetto viene ripristinato.

Ripristinare nell'ordine artista → progetto → brano → altre schede. Un artista con progetti non eliminati non è eliminabile. I riferimenti alle persone disabilitate restano conservati; nuove assegnazioni richiedono persone abilitate. Se un brano da ripristinare contiene checklist obbligatorie aperte in un progetto completato, occorre prima riattivare il progetto.

I controlli di accesso, appartenenza allo studio, versione e origine sono eseguiti sul server. Modifiche ed eliminazioni concorrenti non sovrascrivono versioni nuove. Operazioni e cestino sono registrati in studio_work_history.

## Schema e verifica

008-operations-trash.sql è una migrazione additiva e ripetibile: operations e deleted_at sui progetti, deleted_at su artisti/produzione/attività, blocked_by sulle attività. Il runner migrate-operations.mjs verifica esclusivamente il progetto Vercel Emme Studio e una whitelist delle tabelle, con transazione e lock; rifiuta database con tabelle estranee. Non esegue seed né cancellazioni. Anche i database locali di ripristino devono applicare la migrazione 008.

Verifiche: TypeScript e build Next; test unitari; servizi/API reali su PostgreSQL WASM isolato; assegnazioni, conflitti, dipendenze/cicli, eliminazione/ripristino, contabilità preservata, export/ripristino, permessi e origine. Test browser desktop e mobile con salvataggio organizzazione, eliminazione e ripristino, controlli di overflow e screenshot.
I test Google usano un provider simulato: nessun appuntamento operativo è creato o cancellato per il collaudo. Login Google e sessione reali del team non sono simulabili come prova end-to-end di produzione. Il backup reale e il cron rimangono disattivati in attesa dell'autorizzazione specifica già richiesta.
