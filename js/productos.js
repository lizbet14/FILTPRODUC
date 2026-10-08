/*
 * FILTPRODUC · Catálogo de productos y campañas de Caja Piura + motor de reglas
 *
 * El catálogo se irá llenando con la información que proporcione el asesor.
 * Cada producto/campaña se define con requisitos simples sobre los datos del
 * cliente. Ejemplo de la forma (NO es un producto real):
 *
 *   {
 *     id: 'ejemplo',
 *     nombre: 'Nombre de la campaña',
 *     tipo: 'campaña',              // 'campaña' | 'producto'
 *     vigencia: { desde: '2026-10-01', hasta: '2026-12-31' },
 *     descripcion: 'Texto corto para el asesor',
 *     requisitos: [
 *       { campo: 'score',        op: '>=', valor: 600,  texto: 'Score mínimo 600' },
 *       { campo: 'numEntidades', op: '<=', valor: 3,    texto: 'Máximo 3 entidades' },
 *       { campo: 'perfil',       op: 'in', valor: ['NEGOCIO'], texto: 'Debe tener negocio' }
 *     ]
 *   }
 *
 * Campos disponibles para los requisitos:
 *   score, semaforo, numEntidades, deudaTotal, deudaVencida, peorCalificacion,
 *   perfil (NEGOCIO | SERVICIOS | EMPRESA | SIN_RUC | INDETERMINADO),
 *   tieneRuc, rucActivo, antiguedadMeses, tendenciaDeuda (SUBE | BAJA | ESTABLE | NUEVO),
 *   mesesSemaforoNoVerde, mesesRojo
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Productos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ⬇️ Aquí se cargarán los productos y campañas reales de Caja Piura.
  const CATALOGO = [];

  /** Aplana cliente + análisis en los campos que usan las reglas. */
  function hechos(cliente, analisis) {
    return {
      score: cliente.score,
      semaforo: cliente.semaforo,
      numEntidades: cliente.numEntidades,
      deudaTotal: cliente.deudaTotal,
      deudaVencida: cliente.deudaVencida,
      peorCalificacion: analisis.deuda.peorCalificacion,
      perfil: analisis.ruc.perfil,
      tieneRuc: analisis.ruc.tieneRuc,
      rucActivo: analisis.ruc.rucActivo,
      antiguedadMeses: analisis.ruc.antiguedadMeses,
      tendenciaDeuda: analisis.deuda.tendencia,
      mesesSemaforoNoVerde: analisis.deuda.mesesSemaforoNoVerde,
      mesesRojo: analisis.deuda.mesesRojo
    };
  }

  const OPS = {
    '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '<': (a, b) => a < b,
    '==': (a, b) => a === b, '!=': (a, b) => a !== b,
    'in': (a, b) => b.includes(a), 'notIn': (a, b) => !b.includes(a)
  };

  function vigente(p, hoy) {
    if (!p.vigencia) return true;
    const d = hoy || new Date().toISOString().slice(0, 10);
    return (!p.vigencia.desde || d >= p.vigencia.desde) && (!p.vigencia.hasta || d <= p.vigencia.hasta);
  }

  /** Evalúa todo el catálogo. Estado: CALIFICA | REVISAR (faltan datos) | NO_CALIFICA */
  function evaluar(cliente, analisis, catalogo) {
    const h = hechos(cliente, analisis);
    return (catalogo || CATALOGO).filter(p => vigente(p)).map(p => {
      const detalle = (p.requisitos || []).map(r => {
        const v = h[r.campo];
        if (v === null || v === undefined) return { ...r, cumple: null };
        const f = OPS[r.op];
        return { ...r, cumple: f ? !!f(v, r.valor) : null };
      });
      const estado = detalle.some(d => d.cumple === false) ? 'NO_CALIFICA'
        : detalle.some(d => d.cumple === null) ? 'REVISAR' : 'CALIFICA';
      return { producto: p, estado, detalle };
    }).sort((a, b) => ['CALIFICA', 'REVISAR', 'NO_CALIFICA'].indexOf(a.estado) - ['CALIFICA', 'REVISAR', 'NO_CALIFICA'].indexOf(b.estado));
  }

  return { CATALOGO, evaluar, hechos };
});
