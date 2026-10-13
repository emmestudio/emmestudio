# Google Calendar — specifica di integrazione
Stato: progettazione approvata per sincronizzazione bidirezionale; integrazione reale NON attiva.
Il prototipo resta statico. Non contiene credenziali e non crea eventi esterni.

## Ambito
Calendario dedicato proposto: Emme Studio — Appuntamenti, da creare/selezionare durante configurazione.
Non importare automaticamente calendari personali, Produzione o Prove band.
Portale → Google: creazione, modifica, cancellazione dello stesso evento.
Google → portale: nuove sessioni, modifiche e cancellazioni nel solo calendario selezionato.
Fuso Europe/Rome, date con offset corretto e supporto ora legale.
Eventi giornalieri con date e fine esclusiva; ricorrenze conservate senza appiattire la serie.
Inviti ai partecipanti solo con comando esplicito; nessuna email durante test.

## Backend richiesto
Servizio HTTPS separato da GitHub Pages, database persistente, login e permessi server.
OAuth web server con state, callback autorizzata, refresh token cifrato lato server.
Credenziali solo in variabili segrete server, mai nel repository o localStorage.
Il collegamento Google Calendar di ChatGPT non fornisce credenziali riutilizzabili al sito.

## Sincronizzazione
Tabella collegamenti: calendario selezionato, credenziali cifrate, syncToken, canale watch e scadenza.
Appuntamenti: id interno, projectId opzionale, titolo, descrizione, luogo, inizio/fine, timezone,
googleEventId, etag, versione locale, stato sincronizzazione e cancellazione.
Outbox persistente: idempotenza per creazione e retry; nessun duplicato in caso di timeout.
Google watch HTTPS segnala modifiche; worker legge changes con syncToken, incluse cancellazioni.
Gestire paginazione, token invalidato (410) con riallineamento, rinnovo watch e recupero periodico.
Notifiche webhook validate con token/canale/risorsa; non contengono il contenuto dell'evento.
Aggiornamenti concorrenti controllati con etag: conflitto visibile, non sovrascrittura silenziosa.
Errori di autorizzazione mostrano “Da ricollegare”; errori temporanei “In attesa di sincronizzazione”.
Eventi importati privi di progetto restano non assegnati fino a scelta del team.
L'accesso al calendario dello studio non implica accesso ai dettagli di tutti i progetti:
eventi di progetti riservati visibili nel portale solo agli utenti autorizzati.

## Verifica prima dell'attivazione
Calendario di test: crea dal portale, modifica da Google, cancella da entrambi,
riavvio e retry senza duplicati, concorrenza, ricorrenze, cambio ora, revoca autorizzazione.
Mai trasferire i dati inventati della demo al calendario reale.

## Passo di configurazione
Definire ambiente backend e database; registrare client OAuth Google Cloud,
abilitare Calendar API e configurare callback HTTPS. Autorizzare account e scegliere calendario.
Solo dopo test end-to-end dichiarare la sincronizzazione operativa.

Riferimenti ufficiali:
https://developers.google.com/workspace/calendar/api/guides/sync
https://developers.google.com/workspace/calendar/api/guides/push
https://developers.google.com/identity/protocols/oauth2/web-server
