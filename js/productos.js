/*
 * FILTPRODUC · Motor de calificación de productos y campañas
 * Cruza los datos del cliente (reporte Sentinel + análisis + tipo de cliente)
 * con los criterios del catálogo (js/campanas.js).
 *
 * Resultado por campaña:
 *   CALIFICA     → cumple todos los criterios automáticos (quedan los "verificar")
 *   REVISAR      → falta algún dato en el reporte para decidir
 *   NO_CALIFICA  → incumple al menos un criterio
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./campanas.js'));
  else root.Productos = factory(root.Campanas);
})(typeof self !== 'undefined' ? self : this, function (Campanas) {
  'use strict';

  const RE_CAJA_PIURA = /\b(CMAC[\s-]*PIURA|CAJA[\s-]*PIURA)\b/i;

  /** ¿Toda la deuda estuvo en Normal en los últimos n meses? (meses sin calificación cuentan como válidos) */
  function normalUltimos(historial, n) {
    const h = (historial || []).slice(-n);
    if (!h.length) return null;
    return h.every(m => {
      if (m.pctNormal !== null && m.pctNormal !== undefined) return m.pctNormal >= 100;
      if (m.calificacion) return m.calificacion === 'NORMAL' || m.calificacion === 'SIN CALIFICACION';
      return true;
    });
  }

  function cajaPiura(cliente) {
    const det = cliente.detalleEntidades || [];
    if (!det.length) return { tiene: null, tuvo: null, deudaOtras: null };
    const cp = det.filter(e => RE_CAJA_PIURA.test(e.entidad));
    const tiene = cp.some(e => e.vigente && (e.deuda > 0 || e.calificacion));
    const tuvo = cp.some(e => e.estado === 'YA_NO_REPORTA' || e.maxAnterior > 0);
    const deudaOtras = det.filter(e => e.vigente && !RE_CAJA_PIURA.test(e.entidad)).reduce((s, e) => s + (e.deuda || 0), 0);
    return { tiene, tuvo, deudaOtras: +deudaOtras.toFixed(2) };
  }

  /** Tipo de cliente sugerido a partir del reporte (el asesor puede cambiarlo). */
  function sugerirTipoCliente(cliente) {
    const cp = cajaPiura(cliente);
    if (cp.tiene) return { tipo: 'RECURRENTE', motivo: 'Caja Piura le reporta deuda vigente.' };
    if (cp.tuvo) return { tipo: 'REACTIVADO', motivo: 'Tuvo deuda con Caja Piura en los últimos meses, pero hoy no le reporta.' };
    return { tipo: 'NUEVO', motivo: 'Caja Piura no le reporta deuda. Si fue cliente antes, cámbialo a Reactivado.' };
  }

  /** Aplana cliente + análisis en los campos que usan las reglas. */
  function hechos(cliente, analisis, tipoCliente) {
    const cp = cajaPiura(cliente);
    const ciiu = cliente.ciiu ? String(cliente.ciiu).padStart(4, '0') : null;
    const sinDeuda = cliente.numEntidades === 0;
    let normalActual = null;
    if (sinDeuda) normalActual = true;
    else if (cliente.porcentajeNormal !== null && cliente.porcentajeNormal !== undefined) normalActual = cliente.porcentajeNormal >= 100;
    else if (cliente.calificacion) normalActual = cliente.calificacion === 'NORMAL';
    const nEnt = cliente.numEntidades;
    return {
      tipoCliente,
      score: cliente.score ?? null,
      semaforo: cliente.semaforo ?? null,
      numEntidades: nEnt ?? null,
      entidadesSinCajaPiura: nEnt === null || nEnt === undefined || cp.tiene === null ? null : nEnt - (cp.tiene ? 1 : 0),
      tieneCajaPiura: cp.tiene,
      deudaOtrasIfis: cp.deudaOtras,
      deudaTotal: cliente.deudaTotal ?? null,
      deudaVencida: cliente.deudaVencida ?? null,
      normalActual,
      normal3m: normalUltimos(cliente.historial, 3) ?? normalActual,
      normal6m: normalUltimos(cliente.historial, 6) ?? null,
      normal12m: normalUltimos(cliente.historial, 12) ?? null,
      peorCalificacion: analisis.deuda.peorCalificacion,
      perfil: analisis.ruc.perfil,
      tieneRuc: analisis.ruc.tieneRuc,
      rucActivo: analisis.ruc.rucActivo,
      esPersonaNatural: cliente.ruc ? !String(cliente.ruc).startsWith('20') : true,
      esAgroPesca: ciiu ? /^0[1-3]/.test(ciiu) : null,
      antiguedadMeses: analisis.ruc.antiguedadMeses,
      genero: cliente.genero ?? null,
      ingresoEstimadoMin: cliente.ingresoEstimado ? cliente.ingresoEstimado.min : null,
      deudaMaxima: analisis.deuda.maximo,
      maxEntidades: analisis.deuda.entidadesMax,
      tendenciaDeuda: analisis.deuda.tendencia,
      docsImpagos: cliente.docsImpagos ?? null,
      deudaTributaria: cliente.deudaTributaria ?? null,
      protestos: cliente.protestos ?? null
    };
  }

  const OPS = {
    '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b,
    '==': (a, b) => a === b, '!=': (a, b) => a !== b,
    'in': (a, b) => b.includes(a), 'notIn': (a, b) => !b.includes(a)
  };

  function vigente(p, hoy) {
    if (!p.vigencia) return true;
    return (!p.vigencia.desde || hoy >= p.vigencia.desde) && (!p.vigencia.hasta || hoy <= p.vigencia.hasta);
  }

  function tramoPara(p, score) {
    const ts = p.tramos || [];
    if (!ts.length) return null;
    if (score === null || score === undefined) return ts.length === 1 && ts[0].scoreMin === 0 ? ts[0] : null;
    return ts.find(t => score >= t.scoreMin && score <= t.scoreMax) || null;
  }

  /**
   * @param {object} cliente
   * @param {object} analisis
   * @param {object} opciones { tipoCliente, region, hoy }
   */
  function evaluar(cliente, analisis, opciones = {}) {
    const tipoCliente = opciones.tipoCliente || sugerirTipoCliente(cliente).tipo;
    const hoy = opciones.hoy || new Date().toISOString().slice(0, 10);
    const h = hechos(cliente, analisis, tipoCliente);
    const cat = Campanas.catalogo(opciones.region || Campanas.CONFIG.region);
    const orden = { CALIFICA: 0, REVISAR: 1, NO_CALIFICA: 2 };

    return cat.filter(p => vigente(p, hoy)).map(p => {
      const detalle = [];
      for (const r of p.requisitos || []) {
        if (r.soloPara && !r.soloPara.includes(tipoCliente)) continue;
        const valor = h[r.campo];
        if (valor === null || valor === undefined) {
          detalle.push({ ...r, valorCliente: null, cumple: r.siFalta === 'cumple' ? true : null, sinDato: true });
          continue;
        }
        const f = OPS[r.op];
        detalle.push({ ...r, valorCliente: valor, cumple: f ? !!f(valor, r.valor) : null });
      }
      const estado = detalle.some(d => d.cumple === false) ? 'NO_CALIFICA'
        : detalle.some(d => d.cumple === null) ? 'REVISAR' : 'CALIFICA';
      return { producto: p, estado, detalle, tramo: tramoPara(p, h.score), verificar: p.verificar || [] };
    }).sort((a, b) => (orden[a.estado] - orden[b.estado]) || ((b.tramo ? b.tramo.montoMax : 0) - (a.tramo ? a.tramo.montoMax : 0)));
  }

  return { evaluar, hechos, sugerirTipoCliente, normalUltimos };
});
