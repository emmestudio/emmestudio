'use strict';
// One navigation controller for the Cinematic pages. No third-party dependencies.
const menu = document.querySelector('.menu');
const navigation = document.getElementById('links');
if (menu && navigation) {
  const setOpen = (open) => {
    navigation.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
    menu.querySelector('span').textContent = open ? '×' : '☰';
  };
  menu.addEventListener('click', () => setOpen(menu.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      menu.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!navigation.contains(event.target) && !menu.contains(event.target)) setOpen(false);
  });
  // Reset on desktop so returning to mobile never unexpectedly opens the menu.
  const desktop = window.matchMedia('(min-width: 1301px)');
  desktop.addEventListener('change', () => setOpen(false));
}

// Short, one-time entrances. The reading flow always uses native browser scrolling.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
const revealItems = [...document.querySelectorAll('.section-heading, .cards article, .split-copy, .studio-photo, .live-grid > div, .work-links > a, .playlist-panel, .contact > h2, .contact > .actions, .contact-details, .team-card, .contact-info, .map-card, .artist-feature, .artist-area-grid article, .process-list li, .artist-audience, .artist-gallery figure, .live-art')];
function revealAll() {
  revealObserver?.disconnect();
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  try {
    revealObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0, rootMargin: '0px 0px -24px 0px' });
    revealItems.forEach((item) => {
      // Stagger siblings rather than delaying whole sections.
      if (item.matches('.cards article, .work-links > a, .artist-area-grid article')) {
        item.style.setProperty('--reveal-delay', `${[...item.parentElement.children].indexOf(item) * 70}ms`);
      }
      item.classList.add('reveal-pending');
      revealObserver.observe(item);
    });
    document.documentElement.classList.add('motion-ready');
  } catch {
    revealAll();
  }
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    document.documentElement.classList.remove('motion-ready');
    revealAll();
  }
});
// A keyboard user can jump to any section without waiting for its reveal.
revealItems.forEach((item) => item.addEventListener('focusin', () => item.classList.add('is-visible')));

const header = document.querySelector('.nav');
const sectionLinks = [...document.querySelectorAll('#links a')];
const linkedSections = sectionLinks.map((link) => ({
  link, section:link.hash && new URL(link.href).pathname === window.location.pathname ? document.getElementById(decodeURIComponent(link.hash.slice(1))) : null
})).filter((item) => item.section);
let scrollFrame = 0;
function updateScrollState() {
  scrollFrame = 0;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
  document.documentElement.style.setProperty('--scroll-progress', String(progress));
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
  let current;
  const threshold = (header?.getBoundingClientRect().height || 88) + 130;
  for (const item of linkedSections) {
    if (item.section.getBoundingClientRect().top <= threshold) current = item;
  }
  linkedSections.forEach((item) => {
    if (item === current) item.link.setAttribute('aria-current', 'location');
    else item.link.removeAttribute('aria-current');
  });
}
function scheduleScrollState() {
  if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScrollState);
}
window.addEventListener('scroll', scheduleScrollState, {passive:true});
window.addEventListener('resize', scheduleScrollState, {passive:true});
window.addEventListener('load', scheduleScrollState, {once:true});
updateScrollState();

// Explicit scene controls: no autoplay video or sound, no animation timers.
const experienceHero = document.querySelector('.hero-experience');
const sceneButtons = [...document.querySelectorAll('[data-scene]')];
sceneButtons.forEach(button => button.addEventListener('click', () => {
  experienceHero?.classList.toggle('is-live', button.dataset.scene === 'live');
  sceneButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
}));
// Progressive enhancement: all five chapters remain readable without JS.
const journey = document.querySelector('.artist-journey');
if (journey) {
  const steps = [...journey.querySelectorAll('.journey-step')];
  const panels = [...journey.querySelectorAll('.journey-panel')];
  journey.classList.add('journey-enhanced');
  journey.querySelector('.journey-steps').setAttribute('role', 'tablist');
  function selectStep(index, focus = false) {
    steps.forEach((step, i) => {
      step.setAttribute('aria-selected', String(i === index));
      step.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) { steps[index].focus({preventScroll:true}); steps[index].scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'}); }
  }
  steps.forEach((step, index) => {
    step.setAttribute('role', 'tab');
    step.setAttribute('aria-controls', panels[index].id);
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', step.id);
    panels[index].tabIndex = 0;
    step.addEventListener('click', event => {event.preventDefault();selectStep(index);});
    step.addEventListener('keydown', event => {
      const keys = ['ArrowRight','ArrowLeft','ArrowDown','ArrowUp','Home','End',' '];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? steps.length - 1 : event.key === ' ' ? index : (index + (['ArrowRight','ArrowDown'].includes(event.key) ? 1 : -1) + steps.length) % steps.length;
      selectStep(next, true);
    });
  });
  const deepLink = panels.findIndex(panel => '#' + panel.id === window.location.hash);
  selectStep(deepLink < 0 ? 0 : deepLink);
}

// Studio gallery: native touch scrolling, with optional keyboard/button controls.
document.querySelectorAll('[data-studio-gallery]').forEach(gallery => {
  const track = gallery.querySelector('.gallery-track');
  const slides = [...gallery.querySelectorAll('.gallery-slide')];
  const previous = gallery.querySelector('.gallery-prev');
  const next = gallery.querySelector('.gallery-next');
  const status = gallery.parentElement.querySelector('.gallery-status');
  if (!track || !slides.length || !previous || !next || !status) return;
  let current = 0;
  let frame = 0;
  const offset = index => slides[index].offsetLeft - slides[0].offsetLeft;
  const render = () => {
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    const text = `Foto ${current + 1} di ${slides.length}`;
    if (status.textContent !== text) status.textContent = text;
  };
  const sync = () => {
    frame = 0;
    current = slides.reduce((closest, slide, index) =>
      Math.abs(offset(index) - track.scrollLeft) < Math.abs(offset(closest) - track.scrollLeft) ? index : closest, 0);
    render();
  };
  const go = index => {
    current = Math.max(0, Math.min(slides.length - 1, index));
    render();
    track.scrollTo({left: offset(current), behavior: reducedMotion.matches ? 'instant' : 'smooth'});
  };
  previous.hidden = false;
  next.hidden = false;
  previous.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  track.addEventListener('scroll', () => { if (!frame) frame = requestAnimationFrame(sync); }, {passive: true});
  track.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    go(event.key === 'Home' ? 0 : event.key === 'End' ? slides.length - 1 : current + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => {track.scrollTo({left: offset(current), behavior: 'instant'}); render();}).observe(track);
  }
  render();
});
