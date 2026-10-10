/*
 * FILTPRODUC · Motor de calificación de productos y campañas
 * Cruza los datos del cliente (reporte Sentinel + análisis + tipo de cliente)
 * con los criterios del catálogo (js/campanas.js).
 *
 * Resultado por campaña:
 *   CALIFICA     → cumple todos los criterios automáticos (quedan los "verificar")
 *   REVISAR      → falta algún dato en el reporte para decidir
 *   NO_CALIFICA  → incumple al menos un criterio
 * Y la oferta: monto máximo y TEA mínima según el score, con los topes que
 * correspondan a la situación del cliente (paralelo, vivienda, sin score...).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./campanas.js'));
  else root.Productos = factory(root.Campanas);
})(typeof self !== 'undefined' ? self : this, function (Campanas) {
  'use strict';

  const RE_CAJA_PIURA = /\b(CMAC[\s-]*PIURA|CAJA[\s-]*PIURA)\b/i;
  const RE_COMPETENCIA = /\b(CUSCO|HUANCAYO|AREQUIPA)\b/i; // competencia directa según ficha de Compra de Deuda

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
    if (!det.length) return { tiene: null, tuvo: null, deudaOtras: null, competencia: [] };
    const cp = det.filter(e => RE_CAJA_PIURA.test(e.entidad));
    const tiene = cp.some(e => e.vigente && (e.deuda > 0 || e.calificacion));
    const tuvo = cp.some(e => e.estado === 'YA_NO_REPORTA' || e.maxAnterior > 0);
    const deudaOtras = det.filter(e => e.vigente && !RE_CAJA_PIURA.test(e.entidad)).reduce((s, e) => s + (e.deuda || 0), 0);
    const competencia = det.filter(e => e.vigente && e.deuda > 0 && RE_COMPETENCIA.test(e.entidad)).map(e => e.entidad);
    return { tiene, tuvo, deudaOtras: +deudaOtras.toFixed(2), competencia };
  }

  /** Tipo de cliente sugerido a partir del reporte (el asesor puede cambiarlo). */
  function sugerirTipoCliente(cliente) {
    const cp = cajaPiura(cliente);
    if (cp.tiene) return { tipo: 'VIGENTE', motivo: 'Caja Piura le reporta deuda vigente.' };
    if (cp.tuvo) return { tipo: 'REACTIVADO', motivo: 'Tuvo deuda con Caja Piura en los últimos meses, pero hoy no le reporta.' };
    return { tipo: 'NUEVO', motivo: 'Caja Piura no le reporta deuda. Si fue cliente antes, cámbialo a Reactivado.' };
  }

  /** Aplana cliente + análisis en los campos que usan las reglas. */
  /** VIGENTE = recurrente con crédito vigente en Caja Piura. */
  function normalizarTipo(t) {
    return t === 'VIGENTE' ? { tipo: 'RECURRENTE', creditoVigente: true } : { tipo: t, creditoVigente: false };
  }

  function hechos(cliente, analisis, tipoElegido, vivienda) {
    const { tipo: tipoCliente, creditoVigente } = normalizarTipo(tipoElegido);
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
      vivienda: vivienda || null,
      score: cliente.score ?? null,
      semaforo: cliente.semaforo ?? null,
      numEntidades: nEnt ?? null,
      entidadesSinCajaPiura: nEnt === null || nEnt === undefined || cp.tiene === null ? null : nEnt - (cp.tiene ? 1 : 0),
      tieneCajaPiura: cp.tiene,
      creditoVigente,
      paralelo: creditoVigente,
      competenciaDirecta: cp.tiene === null ? null : cp.competencia.length > 0,
      entidadesCompetencia: cp.competencia,
      sinScore: cliente.score === null || cliente.score === undefined,
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

  function cumpleTodas(conds, h) {
    return (conds || []).every(c => {
      const v = h[c.campo];
      if (v === null || v === undefined) return false;
      const f = OPS[c.op];
      return f ? !!f(v, c.valor) : false;
    });
  }

  /**
   * Oferta del cliente en una campaña:
   *  montoMax / teaMin del tramo de su score, luego los topes que le apliquen.
   */
  function calcularOferta(p, h) {
    const o = p.oferta;
    if (!o || !(o.tramos || []).length) return null;
    const tramos = o.tramos;
    let idx = -1, referencial = false, notaScore = null;

    if (h.sinScore) {
      if (tramos.length === 1 && tramos[0].scoreMin === 0) idx = 0;
      else if (o.sinScore && o.sinScore.tramo !== null && o.sinScore.tramo !== undefined) {
        idx = o.sinScore.tramo; referencial = true; notaScore = o.sinScore.nota;
      } else notaScore = 'Sin score: no se puede ubicar en un tramo.';
    } else {
      idx = tramos.findIndex(t => h.score >= t.scoreMin && h.score <= t.scoreMax);
      if (idx < 0 && h.score < tramos[0].scoreMin) notaScore = `Score ${h.score} por debajo del mínimo del cuadro (${tramos[0].scoreMin}).`;
    }
    const base = idx >= 0 ? tramos[idx] : null;

    const topesAplicados = (o.topes || []).filter(t => cumpleTodas(t.cuando, h));
    let montoMax = base ? base.montoMax : null;
    let plazo = o.plazo;
    for (const t of topesAplicados) {
      if (t.montoMax !== undefined && montoMax !== null) montoMax = Math.min(montoMax, t.montoMax);
      if (t.plazo) plazo = t.plazo;
    }
    const limitadoPorTope = base && montoMax < base.montoMax;

    const ajustes = (o.ajustesTea || []).filter(a => cumpleTodas(a.cuando, h));
    const teaMin = base ? base.teaMin : null;
    const teaNegociable = teaMin !== null && ajustes.length ? Math.max(0, teaMin + ajustes.reduce((s, a) => s + a.pp, 0)) : null;

    // ¿Qué ganaría con un mejor score? (solo si el tope no lo anula)
    let siguiente = null;
    if (base && !h.sinScore) {
      const sig = tramos.slice(idx + 1).find(t => t.montoMax > base.montoMax || t.teaMin < base.teaMin);
      if (sig) {
        const montoSig = topesAplicados.reduce((m, t) => (t.montoMax !== undefined ? Math.min(m, t.montoMax) : m), sig.montoMax);
        if (montoSig > montoMax || sig.teaMin < base.teaMin) siguiente = { scoreMin: sig.scoreMin, montoMax: montoSig, teaMin: sig.teaMin, faltan: sig.scoreMin - h.score };
      }
    }

    return {
      montoMin: o.montoMin, montoMax, montoMaxTramo: base ? base.montoMax : null,
      teaMin, teaMax: o.teaMax ?? null, teaNegociable, ajustes,
      plazo, tramoIdx: idx, tramos, referencial, notaScore,
      topesAplicados, limitadoPorTope, siguiente,
      referencias: o.referencias || []
    };
  }

  /**
   * @param {object} cliente
   * @param {object} analisis
   * @param {object} opciones { tipoCliente, vivienda, region, hoy }
   */
  function evaluar(cliente, analisis, opciones = {}) {
    const tipoElegido = opciones.tipoCliente || sugerirTipoCliente(cliente).tipo;
    const tipoCliente = normalizarTipo(tipoElegido).tipo;
    const hoy = opciones.hoy || new Date().toISOString().slice(0, 10);
    const vivienda = opciones.vivienda || null;
    const h = hechos(cliente, analisis, tipoElegido, vivienda);
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
      const oferta = calcularOferta(p, h);
      return { producto: p, estado, detalle, oferta, verificar: p.verificar || [] };
    }).sort((a, b) => (orden[a.estado] - orden[b.estado])
      || ((b.oferta && b.oferta.montoMax || 0) - (a.oferta && a.oferta.montoMax || 0))
      || ((a.oferta && a.oferta.teaMin || 99) - (b.oferta && b.oferta.teaMin || 99)));
  }

  /** Mejor monto y mejor tasa entre las campañas que califican. */
  function resumenOfertas(evals) {
    const ok = evals.filter(e => e.estado === 'CALIFICA' && e.oferta && e.oferta.montoMax !== null);
    if (!ok.length) return null;
    const mejorMonto = ok.reduce((a, b) => (b.oferta.montoMax > a.oferta.montoMax ? b : a));
    const mejorTasa = ok.reduce((a, b) => (b.oferta.teaMin < a.oferta.teaMin ? b : a));
    return { mejorMonto, mejorTasa };
  }

  return { evaluar, hechos, sugerirTipoCliente, normalUltimos, calcularOferta, resumenOfertas };
});
