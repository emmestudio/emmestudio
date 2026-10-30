'use strict';
(async () => {
  const grid = document.getElementById('roster-grid');
  const profile = document.getElementById('artist-profile');
  if (!grid && !profile) return;
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const safeLink = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; }
    catch { return null; }
  };
  const links = (artist, className) => {
    const wrap = el('div', '', className);
    for (const entry of artist.links || []) {
      const href = safeLink(entry.url);
      if (!href) continue;
      const a = el('a', '', 'social-circle');
      const icons = {instagram:'instagram',facebook:'facebook',tiktok:'tiktok',spotify:'spotify',youtube:'youtube',soundcloud:'soundcloud',x:'x'};
      const icon = icons[entry.label.toLowerCase()];
      if (icon) { const img = el('img'); img.src = `assets/social-outline/${icon}.svg`; img.alt = ''; img.width = 20; img.height = 20; a.append(img); } else { a.textContent = entry.label; a.className = 'button outline'; }
      a.title = entry.label;
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', `${entry.label} — ${artist.name} (nuova scheda)`);
      wrap.append(a);
    }
    return wrap;
  };
  try {
    const response = await fetch('label-artists.json?v=20261030-spotify');
    if (!response.ok) throw new Error('Roster unavailable');
    const data = await response.json();
    const artists = data.filter(a => a.published === true && a.slug && a.name);
    if (grid) {
      document.getElementById('roster-empty').hidden = artists.length > 0;
      for (const artist of artists) {
        const card = el('article', '', 'roster-card');
        const a = el('a'); a.href = `label-artista.html?artista=${encodeURIComponent(artist.slug)}`;
        if (artist.photo) {
          const img = el('img'); img.src = artist.photo; img.alt = artist.name; img.loading = 'lazy'; a.append(img);
        }
        const copy = el('div', '', 'roster-card-copy');
        copy.append(el('h3', artist.name), el('p', artist.tagline || ''), el('span', 'Scopri l’artista', 'text-link'));
        a.append(copy); card.append(a, links(artist, 'artist-card-links')); grid.append(card);
      }
    }
    if (profile) {
      const slug = new URLSearchParams(location.search).get('artista');
      const artist = artists.find(a => a.slug === slug);
      if (!artist) return;
      document.title = `${artist.name} — Emme Label`;
      document.querySelector('meta[name="description"]').content = artist.tagline || `${artist.name} — Emme Label`;
      const layout = el('div', '', 'profile-grid');
      if (artist.photo) { const img = el('img'); img.src = artist.photo; img.alt = artist.name; layout.append(img); }
      const copy = el('div', '', 'artist-bio');
      copy.append(el('p', 'EMME LABEL · ROSTER', 'eyebrow'), el('h1', artist.name), el('p', artist.tagline || '', 'lead'));
      for (const paragraph of artist.bio || []) copy.append(el('p', paragraph));
      copy.append(links(artist, 'profile-links')); layout.append(copy); profile.replaceChildren(layout);
    }
  } catch {
    // Keep the server-rendered introduction and roster notice available on failure.
  }
})();
