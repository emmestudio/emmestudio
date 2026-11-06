/* Le schede partner sono configurate in partners.json.
   Aggiungi, rimuovi o riordina gli oggetti per aggiornare la pagina.
   'published': false nasconde una scheda senza cancellarla. */
(() => {
  const grid = document.querySelector('[data-partner-grid]');
  const status = document.querySelector('[data-partner-status]');
  if (!grid) return;

  function safeUrl(value, kind) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const raw = value.trim();
      if (kind === 'logo' && /^assets\/[a-z0-9/_ .-]+\.(png|jpg|jpeg|webp|svg)$/i.test(raw)) return raw;
      if (kind === 'website' && /^https:\/\//i.test(raw)) return new URL(raw).href;
    } catch (_) { /* ignore invalid links */ }
    return '';
  }

  function node(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = String(value);
    return el;
  }

  function renderCard(item) {
    const article = node('article', 'partner-card');
    const mark = node('div', 'partner-mark');
    const imgUrl = safeUrl(item.logo, 'logo');
    if (imgUrl) {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.alt = 'Logo di ' + item.name;
      img.loading = 'lazy';
      img.decoding = 'async';
      mark.append(img);
    } else {
      mark.classList.add('partner-mark-text');
      mark.textContent = item.name;
    }
    const content = node('div', 'partner-card-copy');
    const type = node('p', 'eyebrow', item.category || 'COLLABORAZIONE');
    const heading = node('h2', '', item.name);
    const description = node('p', 'partner-description', item.description || '');
    content.append(type, heading, description);
    if (item.benefits) {
      const benefits = node('p', 'partner-benefits', item.benefits);
      content.append(benefits);
    }
    const website = safeUrl(item.website, 'website');
    if (website) {
      const link = node('a', 'partner-link site-link-button', 'Scopri il partner');
      link.href = website;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', 'Visita il sito di ' + item.name + ' (nuova scheda)');
      content.append(link);
    }
    article.append(mark, content);
    return article;
  }

  fetch('partners.json', {cache:'no-store'})
    .then(response => {
      if (!response.ok) throw new Error('Dati partner non disponibili');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data)) throw new Error('Formato partner non valido');
      const entries = data.filter(item => item && item.published !== false && typeof item.name === 'string' && item.name.trim());
      grid.replaceChildren();
      entries.forEach(item => grid.append(renderCard(item)));
      if (status) status.textContent = entries.length ? '' : 'Le nuove collaborazioni saranno presentate qui.';
    })
    .catch(() => {
      // Conserva il contenuto HTML iniziale quando il file JSON non è disponibile.
      if (status) status.textContent = 'Alcune collaborazioni potrebbero non essere ancora visualizzate.';
    });
})();
