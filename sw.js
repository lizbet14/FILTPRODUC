/*
 * FILTPRODUC · Service worker
 * Solo hace dos cosas:
 *  1. Recibe el PDF que el asesor comparte desde Android ("Compartir → FILTPRODUC"),
 *     lo guarda un instante en el caché DEL PROPIO CELULAR y abre la página de carga.
 *  2. Permite instalar la web como app.
 * No guarda páginas en caché (así siempre se ve la última versión publicada)
 * y el PDF nunca se envía a ningún servidor.
 */
const CACHE_COMPARTIDO = 'filtproduc-compartido';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.endsWith('/compartir')) return;

  if (event.request.method !== 'POST') {
    event.respondWith(Response.redirect('./index.html', 303));
    return;
  }

  event.respondWith((async () => {
    try {
      const datos = await event.request.formData();
      const archivos = datos.getAll('reporte').filter(f => f && typeof f === 'object' && 'size' in f);
      const pdf = archivos.find(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '')) || archivos[0];
      if (!pdf) return Response.redirect('./index.html?compartido=0', 303);
      const cache = await caches.open(CACHE_COMPARTIDO);
      await cache.put(new Request('./reporte-compartido'), new Response(pdf, {
        headers: { 'Content-Type': 'application/pdf', 'X-Nombre': encodeURIComponent(pdf.name || 'reporte.pdf') }
      }));
      return Response.redirect('./index.html?compartido=1', 303);
    } catch (e) {
      return Response.redirect('./index.html?compartido=0', 303);
    }
  })());
});
