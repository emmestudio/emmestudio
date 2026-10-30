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
    const response = await fetch('label-artists.json?v=20261030-complete');
    if (!response.ok) throw new Error('Roster unavailable');
    const data = await response.json();
    const artists = data.filter(a => a.published === true && a.slug && a.name);
    if (grid) {
      document.getElementById('roster-empty').hidden = artists.length > 0;
      for (const artist of artists) {
        const card = el('article', '', 'roster-card');
        const a = el('a'); a.href = artist.page || `label-artista.html?artista=${encodeURIComponent(artist.slug)}`;
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
      if (artist.page) { location.replace(artist.page); return; }
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

// External audio stays unloaded until an explicit visitor action.
document.querySelectorAll('[data-load-spotify]').forEach(button => button.addEventListener('click', () => {
 const box = button.closest('[data-spotify]');
 if (!/^[A-Za-z0-9]{22}$/.test(box.dataset.spotify)) return;
 const frame = document.createElement('iframe');
 frame.src = `https://open.spotify.com/embed/artist/${box.dataset.spotify}?theme=0`;
 frame.title = 'Moody — Player Spotify'; frame.width = '100%'; frame.height = '352';
 frame.allow = 'encrypted-media; fullscreen; picture-in-picture'; frame.style.border = '0'; frame.style.borderRadius = '20px';
 box.querySelector('.spotify-player-slot').replaceChildren(frame);
 box.querySelector('.player-status').textContent = 'Player attivato. Se non è disponibile, puoi ascoltare dalla pagina Spotify dell’artista.'; button.hidden = true;
}));
(async () => {
 const grid = document.getElementById('release-grid'); if (!grid) return;
 try {
 const response = await fetch('label-releases.json?v=20261030-complete'); if (!response.ok) throw new Error();
 const data = await response.json();
 const artist = document.querySelector('[data-artist-releases]')?.dataset.artistReleases;
 const releases = data.filter(r => r.published === true && (!artist || r.artistSlug === artist)).sort((a,b) => b.date.localeCompare(a.date));
 document.getElementById('releases-empty').hidden = releases.length > 0;
 for (const release of releases) {
  const card = document.createElement('article'); card.className = 'release-card';
  const img = document.createElement('img'); img.src = release.cover; img.alt = `Copertina di ${release.title}`; img.loading = 'lazy'; card.append(img);
  const h = document.createElement('h3'); h.textContent = release.title; card.append(h);
  const info = document.createElement('p'); info.textContent = `${release.artistName} · ${release.type} · ${new Date(release.date + 'T12:00:00').toLocaleDateString('it-IT')}`; card.append(info);
  for (const link of release.links || []) {
   const url = new URL(link.url); if (url.protocol !== 'https:') continue;
   const a = document.createElement('a'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'site-link-button'; a.textContent = link.label; card.append(a);
  }
  grid.append(card);
 }
 } catch { document.getElementById('releases-empty').textContent = 'Il catalogo non è disponibile in questo momento. Riprova tra poco o segui le novità su Instagram.'; }
})();
