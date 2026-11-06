'use strict';
(async () => {
  const grid = document.getElementById('partners-grid');
  const status = document.getElementById('partners-status');

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function https(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  try {
    const response = await fetch('https://portal.emmestudioproduction.it/api/public/partners', {
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw Error('Partner non disponibili');
    const { partners } = await response.json();
    for (const partner of partners) {
      const card = element('article', '', 'partner-card');
      card.id = 'partner-' + partner.slug;
      const photo = https(partner.photo);
      if (photo) {
        const logo = element('img', '', 'partner-logo');
        logo.src = photo;
        logo.alt = '';
        logo.loading = 'lazy';
        card.append(logo);
      }
      if (partner.tagline) card.append(element('p', partner.tagline, 'eyebrow'));
      card.append(element('h2', partner.name));
      for (const paragraph of partner.body.split(/\n\s*\n/)) card.append(element('p', paragraph));
      const links = element('div', '', 'partner-links');
      for (const [label, value] of Object.entries(partner.links)) {
        const href = https(value);
        if (!href) continue;
        const link = element('a', label === 'Sito' ? 'Visita il sito' : label, 'site-link-button');
        link.href = href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        links.append(link);
      }
      if (links.childElementCount) card.append(links);
      grid.append(card);
    }
    status.hidden = partners.length > 0;
    status.textContent = 'Le collaborazioni di Emme Studio saranno pubblicate qui.';
    if (location.hash.startsWith('#partner-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch {
    status.textContent = 'Le collaborazioni sono temporaneamente non disponibili. Riprova tra poco.';
  }
})();
