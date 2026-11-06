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

  const icons = new Map([
    ['Instagram', 'instagram'], ['Spotify', 'spotify'], ['Facebook', 'facebook'],
    ['TikTok', 'tiktok'], ['YouTube', 'youtube'], ['SoundCloud', 'soundcloud'],
    ['X', 'x'], ['Sito', 'website'],
  ]);

  try {
    const response = await fetch('https://portal.emmestudioproduction.it/api/public/partners', {
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw Error('Partner non disponibili');
    const { partners } = await response.json();
    for (const partner of partners) {
      const card = element('article', '', 'roster-card partner-card');
      card.id = 'partner-' + partner.slug;
      const photo = https(partner.photo);
      if (photo) {
        const logo = element('img', '', 'partner-logo');
        logo.src = photo;
        logo.alt = '';
        logo.loading = 'lazy';
        const media = element('div', '', 'partner-media');
        media.append(logo);
        card.append(media);
      }
      const copy = element('div', '', 'roster-card-copy');
      if (partner.tagline) copy.append(element('p', partner.tagline, 'eyebrow'));
      copy.append(element('h2', partner.name));
      for (const paragraph of partner.body.split(/\n\s*\n/)) copy.append(element('p', paragraph));
      card.append(copy);
      const links = element('div', '', 'artist-card-links');
      for (const [label, value] of Object.entries(partner.links)) {
        const href = https(value);
        const iconName = icons.get(label);
        if (!href || !iconName) continue;
        const link = element('a', '', 'social-circle');
        const icon = element('img');
        icon.src = `assets/social-outline/${iconName}.svg`;
        icon.alt = '';
        icon.width = icon.height = 20;
        link.append(icon);
        link.title = label === 'Sito' ? 'Visita il sito' : label;
        link.setAttribute('aria-label', `${link.title} — ${partner.name} (nuova scheda)`);
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
