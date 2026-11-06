# Gestione della pagina Partner — Emme Studio

La pagina `partner.html` usa il tema Cinematic Dark del sito pubblico.
L'elenco dei partner è gestito dal file `partners.json`, senza modificare HTML, CSS o JavaScript.

## Aggiungere un partner
1. Apri `partners.json` nel branch che pubblica il sito (`production-cinematic-2026` dopo l'approvazione di questa modifica).
2. Aggiungi un nuovo oggetto tra `[ ... ]`, separandolo dal precedente con una virgola.
3. Compila questi campi:
   - `id`: identificatore breve e unico, per esempio `nome-partner`.
   - `name`: denominazione pubblica.
   - `category`: ambito della collaborazione, es. Formazione musicale.
   - `description`: descrizione reale e sintetica.
   - `benefits`: eventuali agevolazioni o vantaggi; lascia `""` se non previsti.
   - `logo`: percorso di un file caricato nella repository, ad esempio `assets/partners/nome-partner.png`; lascia `""` per mostrare il nome in un riquadro tipografico.
   - `website`: URL completo che inizia con `https://`; lascia `""` se non vuoi un collegamento.
   - `published`: `true` per renderlo visibile, `false` per nasconderlo.

## Ordine, aggiornamento e rimozione
- Per cambiare l'ordine, sposta gli oggetti all'interno di `partners.json`. Il primo viene mostrato per primo.
- Per aggiornare testi, link o logo, modifica solo il relativo campo.
- Per nascondere temporaneamente un partner, imposta `"published": false`.
- Per eliminarlo definitivamente, rimuovi il suo oggetto dal file JSON.
- Non pubblicare organizzazioni senza autorizzazione all'uso del logo e conferma della collaborazione.
- Conserva il formato JSON valido: virgolette doppie, virgole tra gli oggetti, nessuna virgola dopo l'ultimo campo.

## Modifiche del sito tramite GitHub
1. Visita la repository `emmestudio/emmestudio`.
2. Seleziona il branch corretto (`production-cinematic-2026`, non `main`).
3. Apri il file, clicca l'icona della matita, salva con **Commit changes**.
4. Il sito GitHub Pages si aggiornerà dopo la pubblicazione automatica.

**Nota:** Questa è una gestione semplice basata su GitHub, non ancora un pannello editoriale del Portale Studio.
Per inserimento, modifica, eliminazione e riordino direttamente dal portale servirebbe un'integrazione dedicata con autenticazione e database.
