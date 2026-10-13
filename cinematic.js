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
  const desktop = window.matchMedia('(min-width: 901px)');
  desktop.addEventListener('change', () => setOpen(false));
}

// Short, one-time entrances. The reading flow always uses native browser scrolling.
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let revealObserver;
const revealItems = [...document.querySelectorAll('.section-heading, .cards article, .split-copy, .studio-photo, .live-grid > div, .work-links > a, .contact > h2, .contact > .actions, .contact-details, .team-card, .contact-info, .map-card')];
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
      if (item.matches('.cards article, .work-links > a')) {
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
  link, section:link.hash ? document.getElementById(decodeURIComponent(link.hash.slice(1))) : null
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
