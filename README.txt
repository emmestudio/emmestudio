
EMME STUDIO – Sito statico (tutto locale)
=========================================

Struttura:
- index.html (Home)
- servizi.html
- listino.html
- portfolio.html
- prenota.html
- styles.css
- assets/ (immagini e icone locali)
- .nojekyll (per GitHub Pages)
- 404.html

Pubblicazione su **GitHub Pages**
---------------------------------
1. Crea un account su https://github.com (se non lo hai).
2. Clicca **New repository** → nome: `emmestudio-site` → **Public** → Create.
3. Clicca **Add file → Upload files** e trascina TUTTO il contenuto della cartella (non solo singoli file).
4. Vai su **Settings → Pages**.
   - *Build and deployment* → **Source: Deploy from a branch**
   - *Branch*: `main` e */root* → **Save**
5. Dopo ~30s il sito è online: `https://TUO-UTENTE.github.io/emmestudio-site/`

Personalizzazioni
-----------------
- Cambia l'email in `prenota.html` (attributo `action="mailto:info@emmestudio.it"`).
- Per un modulo vero (senza aprire l'email), integra un **Google Form** e sostituisci la sezione con l'iframe di embed.
- Sostituisci le immagini in `assets/` con le tue foto/cover.
