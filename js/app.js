/*
 * FILTPRODUC · App instalable (PWA)
 * Registra el service worker y muestra el botón "Instalar app" cuando el navegador lo permite.
 */
(function () {
  'use strict';
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js', { scope: './' }).catch(e => console.warn('Service worker no registrado:', e));
    });
  }

  const instalada = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (instalada()) document.documentElement.classList.add('modo-app');

  let aviso = null;
  const botones = () => document.querySelectorAll('[data-instalar]');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    aviso = e;
    botones().forEach(b => { b.hidden = false; });
  });
  window.addEventListener('appinstalled', () => {
    aviso = null;
    botones().forEach(b => { b.hidden = true; });
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-instalar]');
    if (!b || !aviso) return;
    aviso.prompt();
    try { await aviso.userChoice; } catch (err) { /* cancelado */ }
    aviso = null;
    botones().forEach(x => { x.hidden = true; });
  });
})();
