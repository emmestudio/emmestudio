'use strict';
(() => {
  const roster = document.getElementById('roster-grid');
  const profile = document.getElementById('artist-profile');
  const catalogue = document.getElementById('release-grid');
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };

  function secureLink(value) {
    try {
      const url = new URL(value, location.href);
      return url.protocol === 'https:' || url.origin === location.origin ? url.href : null;
    } catch { return null; }
  }

  function external(label, href, cls = 'site-link-button') {
    const a = el('a', label, cls);
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function photo(url, alt) {
    if (!url) return null;
    const src = secureLink(url);
    if (!src) return null;
    const img = el('img');
    img.src = src;
    img.alt = alt;
    img.loading = 'lazy';
    return img;
  }

  function links(artist, className) {
    const wrap = el('div', '', className);
    const icons = new Set(['instagram', 'facebook', 'tiktok', 'spotify', 'youtube', 'soundcloud', 'x']);
    for (const entry of artist.links || []) {
      const href = secureLink(entry.url);
      if (!href) continue;
      const icon = entry.label.toLowerCase();
      const a = external(icons.has(icon) ? '' : entry.label, href, icons.has(icon) ? 'social-circle' : 'button outline');
      if (icons.has(icon)) {
        const img = el('img');
        img.src = `assets/social-outline/${icon}.svg`;
        img.alt = '';
        img.width = img.height = 20;
        a.append(img);
      }
      a.title = entry.label;
      a.setAttribute('aria-label', `${entry.label} — ${artist.name} (nuova scheda)`);
      wrap.append(a);
    }
    return wrap;
  }

  function addPlayer(button, slot, path, title) {
    button.addEventListener('click', () => {
      const frame = el('iframe');
      frame.src = 'https://open.spotify.com/embed/' + path + '?theme=0';
      frame.title = title + ' — Player Spotify';
      frame.width = '100%';
      frame.height = path.startsWith('track/') ? '152' : '352';
      frame.allow = 'encrypted-media; fullscreen; picture-in-picture';
      frame.style.border = '0';
      frame.style.borderRadius = '16px';
      slot.replaceChildren(frame);
      button.hidden = true;
    }, { once: true });
  }

  document.querySelectorAll('[data-load-spotify]').forEach(button => {
    const box = button.closest('[data-spotify]');
    if (/^[A-Za-z0-9]{22}$/.test(box?.dataset.spotify)) {
      addPlayer(button, box.querySelector('.spotify-player-slot'), 'artist/' + box.dataset.spotify, 'Moody');
    }
  });

  function rosterCards(artists) {
    document.getElementById('roster-empty').hidden = artists.length > 0;
    for (const artist of artists) {
      const card = el('article', '', 'roster-card');
      const a = el('a');
      a.href = artist.page || `label-artista.html?artista=${encodeURIComponent(artist.slug)}`;
      const img = photo(artist.photo, artist.name);
      if (img) a.append(img);
      const copy = el('div', '', 'roster-card-copy');
      copy.append(el('h3', artist.name), el('p', artist.tagline), el('span', 'Scopri l’artista', 'text-link'));
      a.append(copy);
      card.append(a, links(artist, 'artist-card-links'));
      roster.append(card);
    }
  }

  function artistProfile(artist) {
    if (!artist) {
      profile.replaceChildren(el('h1', 'Scheda artista non disponibile.'), el('p', 'Torna al roster per vedere gli artisti pubblicati.'));
      document.querySelector('.label-listen')?.remove();
      return;
    }
    document.title = artist.name + ' — Emme Label';
    document.querySelector('meta[name="description"]').content = artist.tagline;
    const layout = el('div', '', 'profile-grid');
    const img = photo(artist.photo, artist.name);
    if (img) {
      img.loading = 'eager';
      layout.append(img);
    }
    const copy = el('div', '', 'artist-bio');
    copy.append(el('p', 'EMME LABEL · ROSTER', 'eyebrow'), el('h1', artist.name), el('p', artist.tagline, 'lead'));
    for (const paragraph of artist.bio || []) copy.append(el('p', paragraph));
    copy.append(links(artist, 'profile-links'));
    layout.append(copy);
    profile.replaceChildren(layout);
  }

  function releaseCards(releases, slug) {
    const items = releases.filter(release => release.published && (!slug || release.artistSlug === slug))
      .sort((a, b) => b.date.localeCompare(a.date));
    const section = catalogue.closest('.label-releases');
    if (section.dataset.hideEmpty !== undefined) section.hidden = !items.length;
    document.getElementById('releases-empty').hidden = items.length > 0;
    for (const release of items) {
      const card = el('article', '', 'release-card');
      card.id = 'uscita-' + release.slug;
      const image = photo(release.cover, 'Copertina di ' + release.title);
      if (image) card.append(image);
      card.append(el('h3', release.title));
      const date = new Date(release.date + 'T12:00:00').toLocaleDateString('it-IT');
      card.append(el('p', [release.artistName, release.type, date].filter(Boolean).join(' · ')));
      if (release.body) {
        const copy = el('div', '', 'release-copy');
        for (const paragraph of release.body.split(/\n\s*\n/)) copy.append(el('p', paragraph));
        card.append(copy);
      }
      const spotify = /^https:\/\/open\.spotify\.com\/(track|album)\/([A-Za-z0-9]{22})$/.exec(release.spotify || '');
      if (spotify) {
        const actions = el('div', '', 'release-actions');
        const button = el('button', 'Attiva il player Spotify', 'button outline');
        button.type = 'button';
        const slot = el('div', '', 'release-player');
        addPlayer(button, slot, spotify[1] + '/' + spotify[2], release.title);
        actions.append(button, external('Apri su Spotify', spotify[0]));
        card.append(actions, slot);
      }
      for (const link of release.links || []) {
        const href = secureLink(link.url);
        if (href) card.append(external(link.label, href));
      }
      catalogue.append(card);
    }
    if (location.hash.startsWith('#uscita-')) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }

  async function json(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) throw Error('Catalogo non disponibile');
    return response.json();
  }

  if (!roster && !profile && !catalogue) return;
  (async () => {
    let data;
    try {
      data = await json('https://portal.emmestudioproduction.it/api/public/label', { signal: AbortSignal.timeout(7000) });
    } catch {
      const [artists, releases] = await Promise.all([json('label-artists.json'), json('label-releases.json')]);
      data = { artists, releases };
    }
    const artists = data.artists.filter(artist => artist.published === true && artist.slug && artist.name);
    const slug = profile?.dataset.artist || new URLSearchParams(location.search).get('artista');
    if (roster) rosterCards(artists);
    if (profile) artistProfile(artists.find(artist => artist.slug === slug));
    if (catalogue && (!profile || slug)) releaseCards(data.releases, slug);
  })().catch(() => {
    const notice = document.getElementById('releases-empty');
    if (notice) notice.textContent = 'Il catalogo non è disponibile in questo momento. Riprova tra poco.';
  });
})();
