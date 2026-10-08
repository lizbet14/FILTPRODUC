/*
 * FILTPRODUC · Extracción de texto de PDF
 * Usa pdf.js para leer el PDF en el navegador (el archivo NUNCA sale del equipo).
 * Reconstruye las líneas agrupando los fragmentos por su posición vertical,
 * para que las tablas del reporte Sentinel conserven sus filas.
 * Funciona en navegador (window.PdfTexto) y en Node (module.exports) para pruebas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PdfTexto = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Convierte los items de una página en líneas de texto ordenadas. */
  function itemsALineas(items) {
    const piezas = items
      .filter(it => it.str && it.str.trim() !== '')
      .map(it => ({
        texto: it.str,
        x: it.transform[4],
        y: it.transform[5],
        ancho: it.width || 0,
        alto: Math.abs(it.transform[3]) || 10
      }));

    // Orden: de arriba hacia abajo, de izquierda a derecha
    piezas.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    const lineas = [];
    for (const p of piezas) {
      const tolerancia = Math.max(2, p.alto * 0.45);
      let linea = lineas.find(l => Math.abs(l.y - p.y) <= tolerancia);
      if (!linea) {
        linea = { y: p.y, piezas: [] };
        lineas.push(linea);
      }
      linea.piezas.push(p);
    }

    lineas.sort((a, b) => b.y - a.y);
    return lineas.map(l => {
      l.piezas.sort((a, b) => a.x - b.x);
      let out = '';
      let finAnterior = null;
      for (const p of l.piezas) {
        if (finAnterior !== null) {
          const hueco = p.x - finAnterior;
          // hueco grande = separación de columna (dos espacios), pequeño = un espacio
          if (hueco > p.alto * 1.2) out += '  ';
          else if (hueco > 0.5 && !out.endsWith(' ') && !p.texto.startsWith(' ')) out += ' ';
        }
        out += p.texto;
        finAnterior = p.x + p.ancho;
      }
      return out.replace(/\s+$/, '');
    });
  }

  /**
   * Lee un PDF y devuelve { paginas: [[líneas]], texto, numPaginas }.
   * @param {object} pdfjsLib  la librería pdf.js ya cargada
   * @param {ArrayBuffer|Uint8Array} datos  bytes del PDF
   */
  async function extraer(pdfjsLib, datos) {
    const doc = await pdfjsLib.getDocument({ data: datos }).promise;
    const paginas = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const contenido = await pagina.getTextContent();
      paginas.push(itemsALineas(contenido.items));
    }
    const texto = paginas.map((lineas, i) => `--- Página ${i + 1} ---\n` + lineas.join('\n')).join('\n');
    return { paginas, texto, numPaginas: doc.numPages };
  }

  return { extraer, itemsALineas };
});
