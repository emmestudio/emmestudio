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
