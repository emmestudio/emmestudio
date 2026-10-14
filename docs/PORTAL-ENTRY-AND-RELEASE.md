# Ingresso dal sito e rifinitura del portale

Il sito pubblico usa il branch production-cinematic-2026; il portale Vercel usa restyling-cinematic-2026. Main resta invariato.

Il menu e il footer delle pagine Cinematic contengono Portale studio, con pagina di ingresso portale.html coerente con l'identità Emme Studio. La pagina non è indicizzata e distingue l'accesso interno dalle richieste degli artisti.

Il sottodominio portal.emmestudioproduction.it è già verificato su Vercel. Il login Google attualmente configurato usa https://emme-studio-portale.vercel.app. Il proxy Next reindirizza solo tra questi due host esatti verso BETTER_AUTH_URL, conservando percorso e query, senza generare sessioni separate. Non cambia credenziali Google, redirect URI OAuth, domini email, DNS o impostazioni dell'Accademia. Per una futura migrazione del login Google al sottodominio occorre configurare prima il relativo redirect URI in Google Cloud, poi aggiornare la base URL.

Rifiniture: navigazione compatta con menu mobile, collegamento al sito, Costi per l'amministratore, gerarchia più compatta nelle pagine operative, intestazioni dei dialoghi visibili durante lo scorrimento, pagine di benvenuto e accesso dedicate, accesso già autenticato diretto alla dashboard.

La scheda progetto usa un solo Salva progetto per dati, organizzazione e preventivo: validazione, assegnazioni, storico e salvataggio avvengono nella stessa transazione. I campi restano modificabili nel dialogo in caso di errore; una versione concorrente non viene sovrascritta.

In questa fase, su richiesta dell'utente, le suite funzionali non sono eseguite nuovamente: il collaudo operativo completo viene rimandato. Sono eseguite compilazione/build e revisione visiva delle schermate di ingresso desktop/mobile. La disponibilità della pubblicazione e il collegamento al dominio sono controlli di rilascio, non certificano da soli tutti i flussi di lavoro. Il portale non è dichiarato collaudato al 100% prima della fase operativa.

I backup reali e il cron restano disattivati, come già stabilito in attesa dell'autorizzazione specifica al trasferimento dei dati.
