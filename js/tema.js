/*
 * FILTPRODUC · Tema claro / oscuro
 * Se carga en el <head> para aplicar el tema antes de pintar la página.
 * Guarda la elección en este navegador; si no hay elección, sigue al dispositivo.
 */
(function () {
  'use strict';
  var CLAVE = 'filtproduc:tema';
  var raiz = document.documentElement;
  var medio = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function guardado() {
    try { var t = localStorage.getItem(CLAVE); return t === 'dark' || t === 'light' ? t : null; } catch (e) { return null; }
  }
  function actual() {
    return guardado() || (medio && medio.matches ? 'dark' : 'light');
  }
  function aplicar() {
    var g = guardado();
    if (g) raiz.setAttribute('data-theme', g); else raiz.removeAttribute('data-theme');
    raiz.setAttribute('data-tema-actual', actual());
    var b = document.getElementById('btnTema');
    if (b) {
      var texto = actual() === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
      b.setAttribute('title', texto);
      b.setAttribute('aria-label', texto);
    }
  }
  function alternar() {
    var nuevo = actual() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(CLAVE, nuevo); } catch (e) { /* sin almacenamiento: solo esta visita */ raiz.setAttribute('data-theme', nuevo); }
    aplicar();
    if (!guardado()) { raiz.setAttribute('data-theme', nuevo); raiz.setAttribute('data-tema-actual', nuevo); }
  }

  aplicar();
  if (medio && medio.addEventListener) medio.addEventListener('change', aplicar);
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('btnTema');
    if (b) b.addEventListener('click', alternar);
    aplicar();
  });
})();
