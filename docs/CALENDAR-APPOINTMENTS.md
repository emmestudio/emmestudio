# Appuntamenti — prima versione operativa

Il calendario dedicato creato dal portale è l'archivio degli appuntamenti. Non viene mantenuta una seconda copia degli eventi nel database: il server legge e scrive direttamente Google Calendar, evitando divergenze fra due archivi.

Il portale mostra un mese alla volta, segue tutte le pagine della risposta e aggiorna gli eventi all'apertura, al ritorno nella scheda e ogni 60 secondi mentre la pagina è visibile. A pagina chiusa gli eventi restano su Google; i cambiamenti si vedono alla riapertura. Questa versione non usa webhook né sincronizzazione offline di un archivio separato.

Creazione, modifica e cancellazione riguardano solo il calendario collegato al proprietario autenticato. Il client non può scegliere un calendarId diverso. Controlli server per sessione, email verificata e Origin sulle scritture. Credenziali e token OAuth non sono esposti nel frontend.

Creazione idempotente con ID UUID compatibile con Google e impronta della richiesta. Retry con lo stesso ID non duplica l'evento; cambio dati dopo una risposta ambigua genera un conflitto. Modifiche e cancellazioni usano If-Match/etag. Un conflitto richiede riapertura dell'evento aggiornato. Le operazioni fallite restano visibili all'utente e non sono accodate offline.

Fuso Europe/Rome, eventi giornalieri con ultimo giorno incluso nell'interfaccia e fine esclusiva nell'API. Conversione esplicita estate/inverno. Orari inesistenti o ambigui al cambio dell'ora sono rifiutati e spiegati. Eventi ricorrenti e con invitati vengono mostrati con link Google, senza modifica nel portale; nessun invito automatico.

Verifica: 12 test locali per paginazione, cancellati, conflitti, retry, date e ora legale; typecheck e build. La prova automatica sul calendario reale non è stata eseguita: la revisione automatica ha respinto il comando di verifica nel deploy perché avrebbe potuto ripetere mutazioni esterne durante le build. La pubblicazione esegue soltanto `npm run build`. Il collaudo finale con OAuth e un appuntamento reale rimane da completare nell'interfaccia autenticata.

Fasi successive: utenti team e permessi, collegamento eventi ai progetti, eventuali ricorrenze e inviti espliciti. Il progetto e database Accademia non sono coinvolti.
