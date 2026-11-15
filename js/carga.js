/* FILTPRODUC · página de carga */
(function () {
  'use strict';
  const zona = document.getElementById('zona');
  const input = document.getElementById('archivo');
  const progreso = document.getElementById('progreso');
  const caja = document.getElementById('error');

  // pdf.js se carga como módulo: esperar a que esté listo (máx. 15 s)
  const pdfListo = new Promise(resolve => {
    if (window.pdfjsLib) return resolve(window.pdfjsLib);
    window.addEventListener('pdfjs-listo', () => resolve(window.pdfjsLib), { once: true });
    setTimeout(() => resolve(window.pdfjsLib || null), 15000);
  });

  const espera = ms => new Promise(r => setTimeout(r, ms));

  function paso(nombre, estado) {
    const el = progreso.querySelector(`[data-paso="${nombre}"]`);
    el.classList.remove('activo', 'hecho');
    if (estado) el.classList.add(estado);
  }

  function mostrarError(msg) {
    caja.innerHTML = msg;
    caja.classList.add('visible');
  }

  async function procesar(bytes, nombreArchivo) {
    caja.classList.remove('visible');
    progreso.classList.add('visible');
    ['leer', 'extraer', 'analizar'].forEach(p => paso(p, null));
    try {
      paso('leer', 'activo');
      const lib = await pdfListo;
      if (!lib) throw new Error('No se pudo cargar el lector de PDF. Recarga la página; si persiste, usa Chrome o Edge actualizados.');
      const { paginas, texto, numPaginas } = await PdfTexto.extraer(lib, bytes);
      paso('leer', 'hecho');

      const lineas = paginas.flat();
      if (lineas.join('').replace(/\s/g, '').length < 40) {
        throw new Error('El PDF no contiene texto legible (parece una imagen escaneada). Descarga el reporte directamente desde Sentinel en PDF, no una foto o escaneo.');
      }

      paso('extraer', 'activo');
      const cliente = SentinelParser.analizar(lineas);
      await espera(250);
      paso('extraer', 'hecho');

      paso('analizar', 'activo');
      await espera(250);
      const registro = { cliente, texto, archivo: nombreArchivo, paginas: numPaginas, cargado: new Date().toISOString() };
      sessionStorage.setItem('filtproduc:reporte', JSON.stringify(registro));
      paso('analizar', 'hecho');
      await espera(200);
      location.href = 'panel.html';
    } catch (e) {
      console.error(e);
      progreso.classList.remove('visible');
      mostrarError('<b>No se pudo leer el reporte.</b> ' + (e && e.message ? e.message : 'Verifica que sea un PDF válido.'));
    }
  }

  async function desdeArchivo(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      mostrarError('El archivo debe ser un PDF.');
      return;
    }
    const buf = await file.arrayBuffer();
    procesar(new Uint8Array(buf), file.name);
  }

  input.addEventListener('change', () => desdeArchivo(input.files[0]));
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.add('arrastrando'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, e => { e.preventDefault(); zona.classList.remove('arrastrando'); }));
  zona.addEventListener('drop', e => desdeArchivo(e.dataTransfer.files[0]));

  // PDF compartido desde Android ("Compartir → FILTPRODUC"): lo deja el service worker en el caché local
  async function desdeCompartido() {
    const p = new URLSearchParams(location.search).get('compartido');
    if (p === null) return;
    history.replaceState(null, '', location.pathname);
    if (p !== '1' || !('caches' in window)) {
      mostrarError('No se recibió el PDF. Vuelve a compartir el <b>Reporte 1</b> descargado de Sentinel, o elígelo con el botón de abajo.');
      return;
    }
    try {
      const cache = await caches.open('filtproduc-compartido');
      const req = new Request('reporte-compartido');
      const r = await cache.match(req);
      if (!r) throw new Error('sin archivo');
      const nombre = decodeURIComponent(r.headers.get('X-Nombre') || 'reporte.pdf');
      const bytes = new Uint8Array(await r.arrayBuffer());
      await cache.delete(req);
      procesar(bytes, nombre);
    } catch (e) {
      mostrarError('No se pudo abrir el PDF compartido. Elígelo con el botón de abajo.');
    }
  }
  desdeCompartido();

  document.getElementById('btnEjemplo').addEventListener('click', async () => {
    try {
      const r = await fetch('ejemplos/reporte-sentinel-ficticio.pdf');
      if (!r.ok) throw new Error();
      procesar(new Uint8Array(await r.arrayBuffer()), 'reporte-sentinel-ficticio.pdf');
    } catch (e) {
      mostrarError('No se pudo abrir el reporte de prueba.');
    }
  });
})();
