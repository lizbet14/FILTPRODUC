/*
 * FILTPRODUC · Catálogo de campañas y productos de Caja Piura
 *
 * Los DATOS viven en js/campanas-data.js (window.FILTPRODUC_CATALOGO) y se
 * editan desde el Panel de administración (admin.html).
 * Si el administrador guardó cambios "en este navegador" (sin publicar),
 * se usan esos cambios en ese navegador.
 *
 * ── Requisitos (¿califica?) ─────────────────────────────────────────────
 *   { campo, op, valor, texto, soloPara?: ['NUEVO','REACTIVADO','RECURRENTE'], siFalta?: 'revisar'|'cumple' }
 *   Tipo de cliente: NUEVO | REACTIVADO | RECURRENTE (sin crédito vigente) | VIGENTE (con crédito vigente).
 *   VIGENTE cuenta como RECURRENTE para los requisitos y activa creditoVigente = true.
 *   'verificar': requisitos que el asesor confirma fuera del reporte.
 *
 * ── Oferta (¿cuánto y a qué tasa?) ──────────────────────────────────────
 *   oferta: {
 *     montoMin, plazo,
 *     tramos:  [{ scoreMin, scoreMax, montoMax, teaMin }]      ← según score del cliente
 *     sinScore: { tramo: índice|null, nota }                    ← cliente sin score
 *     topes:   [{ id, cuando: [cond...], montoMax?, plazo?, texto }] ← se aplican solos
 *     ajustesTea: [{ cuando: [cond...], pp, texto }]            ← TEA negociable
 *     referencias: [{ texto, montoMax? }]                       ← dependen del sustento (informativo)
 *   }
 *   cond = { campo, op, valor } sobre los mismos campos que los requisitos.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    if (!g.FILTPRODUC_CATALOGO) {
      try {
        // En Node (pruebas): cargar el archivo de datos
        const fs = require('fs'), path = require('path'), vm = require('vm');
        const ctx = { window: {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'campanas-data.js'), 'utf8'), ctx);
        g.FILTPRODUC_CATALOGO = ctx.window.FILTPRODUC_CATALOGO;
      } catch (e) { /* sin datos */ }
    }
    module.exports = factory(g);
  } else root.Campanas = factory(root);
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const CLAVE_LOCAL = 'filtproduc:catalogo-local';

  function publicado() {
    return root.FILTPRODUC_CATALOGO || { version: 1, region: 'CENTRO', agencia: 'Satipo', campanas: [] };
  }

  /** Cambios guardados por el administrador en este navegador (sin publicar), o null. */
  function local() {
    try {
      const t = root.localStorage && root.localStorage.getItem(CLAVE_LOCAL);
      if (!t) return null;
      const d = JSON.parse(t);
      if (!d || !Array.isArray(d.campanas)) return null;
      // Copia temporal de lo recién publicado: se borra cuando la web ya sirve esa versión
      const pub = publicado();
      if (d.publicadoDesdePanel && pub.actualizado && Date.parse(pub.actualizado) >= Date.parse(d.actualizado)) {
        root.localStorage.removeItem(CLAVE_LOCAL);
        return null;
      }
      return d;
    } catch (e) { return null; }
  }

  function datos() { return local() || publicado(); }
  const clonar = o => JSON.parse(JSON.stringify(o));

  const CONFIG = {
    get region() { return datos().region || 'CENTRO'; },
    get agencia() { return datos().agencia || 'Satipo'; }
  };

  /** Campañas activas (copia, para que nadie modifique los datos por accidente). */
  function catalogo() {
    return clonar(datos().campanas || []).filter(p => p.activa !== false);
  }

  /** Todas las campañas, incluidas las desactivadas (para el panel de administración). */
  function todas() { return clonar(datos().campanas || []); }

  function usaCambiosLocales() { const l = local(); return !!l && !l.publicadoDesdePanel; }

  return { CONFIG, catalogo, todas, datos, publicado, local, usaCambiosLocales, CLAVE_LOCAL };
});
