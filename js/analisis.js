/*
 * FILTPRODUC · Análisis del cliente
 * A partir de los datos leídos del reporte calcula:
 *  - perfil del RUC (negocio, solo servicios, empresa, sin RUC)
 *  - comportamiento del endeudamiento en el historial
 *  - alertas para el asesor
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Analisis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ORDEN_CALIF = ['NORMAL', 'CPP', 'DEFICIENTE', 'DUDOSO', 'PERDIDA'];

  function mesesEntre(isoDesde, isoHasta) {
    if (!isoDesde) return null;
    const a = new Date(isoDesde + 'T00:00:00');
    const b = isoHasta ? new Date(isoHasta + 'T00:00:00') : new Date();
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0));
  }

  // Palabras en la actividad económica que indican servicios profesionales / independientes
  const RE_SERVICIOS = /(ACTIVIDADES PROFESIONALES|ASESORIA|CONSULTORIA|ABOGAD|JURIDIC|CONTABIL|AUDITORIA|ARQUITECT|INGENIERIA|MEDIC|ODONTOLOG|ENFERMER|PSICOLOG|DOCENTE|ENSENANZA|EDUCACION|PROFESOR|PROGRAMACION INFORMATICA|DISENO|PUBLICIDAD|INVESTIGACION|TRADUCC|CUARTA CATEGORIA|4TA|RENTA DE CUARTA)/;

  function analizarRUC(c) {
    const r = {
      tieneRuc: !!c.ruc,
      tipoPersona: null,
      perfil: 'SIN_RUC',
      perfilTexto: 'Sin RUC',
      motivo: 'El reporte no muestra un RUC asociado. Se evalúa como persona natural dependiente o informal.',
      antiguedadMeses: mesesEntre(c.inicioActividades, c.fechaReporte),
      rucActivo: null
    };
    if (!c.ruc) return r;

    const pref = c.ruc.slice(0, 2);
    r.tipoPersona = { '10': 'Persona natural', '15': 'Persona natural no domiciliada / otros', '16': 'Otros', '17': 'Persona natural (extranjero)', '20': 'Persona jurídica' }[pref] || 'Otro';
    r.rucActivo = c.estadoRuc ? c.estadoRuc === 'ACTIVO' : null;

    const tipo = (c.tipoContribuyente || '').toUpperCase();
    const act = (c.actividad || '').toUpperCase();

    if (pref === '20') {
      r.perfil = 'EMPRESA';
      r.perfilTexto = 'Empresa (persona jurídica)';
      r.motivo = 'RUC 20: persona jurídica.';
    } else if (/SIN NEGOCIO/.test(tipo) || /CUARTA|4TA/.test(tipo)) {
      r.perfil = 'SERVICIOS';
      r.perfilTexto = 'Solo presta servicios';
      r.motivo = `Tipo de contribuyente: "${c.tipoContribuyente}".`;
    } else if (/CON NEGOCIO|EMPRESA INDIVIDUAL|E\.I\.R\.L/.test(tipo)) {
      r.perfil = 'NEGOCIO';
      r.perfilTexto = 'Persona con negocio';
      r.motivo = `Tipo de contribuyente: "${c.tipoContribuyente}".`;
    } else if (act && RE_SERVICIOS.test(act)) {
      r.perfil = 'SERVICIOS';
      r.perfilTexto = 'Solo presta servicios (por actividad)';
      r.motivo = `La actividad económica ("${c.actividad}") corresponde a servicios profesionales o independientes.`;
    } else if (act) {
      r.perfil = 'NEGOCIO';
      r.perfilTexto = 'Persona con negocio (por actividad)';
      r.motivo = `La actividad económica ("${c.actividad}") corresponde a un giro comercial/productivo.`;
    } else {
      r.perfil = 'INDETERMINADO';
      r.perfilTexto = 'RUC 10 sin detalle';
      r.motivo = 'Tiene RUC de persona natural, pero el reporte no indica tipo de contribuyente ni actividad. Verificar en SUNAT.';
    }
    return r;
  }

  function analizarDeuda(c) {
    const h = (c.historial || []).filter(x => x.deuda !== null);
    const r = {
      meses: (c.historial || []).length,
      mesesConDeuda: h.length,
      deudaInicial: null, deudaFinal: null, variacion: null, tendencia: 'SIN_DATOS', tendenciaTexto: 'Sin historial suficiente',
      maximo: null, promedio: null,
      mesesSemaforoNoVerde: 0, mesesRojo: 0,
      peorCalificacion: null
    };
    if (h.length >= 2) {
      r.deudaInicial = h[0].deuda;
      r.deudaFinal = h[h.length - 1].deuda;
      r.maximo = Math.max(...h.map(x => x.deuda));
      r.promedio = h.reduce((s, x) => s + x.deuda, 0) / h.length;
      r.variacion = r.deudaInicial > 0 ? (r.deudaFinal - r.deudaInicial) / r.deudaInicial : null;
      if (r.variacion === null) { r.tendencia = 'NUEVO'; r.tendenciaTexto = 'Empezó a endeudarse en el periodo'; }
      else if (r.variacion > 0.15) { r.tendencia = 'SUBE'; r.tendenciaTexto = 'Endeudamiento en aumento'; }
      else if (r.variacion < -0.15) { r.tendencia = 'BAJA'; r.tendenciaTexto = 'Endeudamiento en descenso'; }
      else { r.tendencia = 'ESTABLE'; r.tendenciaTexto = 'Endeudamiento estable'; }
    } else if (h.length === 1) {
      r.deudaFinal = h[0].deuda; r.maximo = h[0].deuda; r.promedio = h[0].deuda;
    }
    for (const m of c.historial || []) {
      if (m.semaforo && m.semaforo !== 'VERDE' && m.semaforo !== 'GRIS') r.mesesSemaforoNoVerde++;
      if (m.semaforo === 'ROJO') r.mesesRojo++;
    }
    const califs = [c.calificacion, ...(c.historial || []).map(m => m.calificacion), ...(c.detalleEntidades || []).map(e => e.calificacion)]
      .filter(Boolean);
    if (c.distribucionCalificacion) for (const k of Object.keys(c.distribucionCalificacion)) if (c.distribucionCalificacion[k] > 0) califs.push(k);
    if (califs.length) r.peorCalificacion = califs.sort((a, b) => ORDEN_CALIF.indexOf(b) - ORDEN_CALIF.indexOf(a))[0];
    return r;
  }

  function alertas(c, ruc, deuda) {
    const a = [];
    const add = (nivel, texto) => a.push({ nivel, texto });
    if (c.score === null) add('info', 'No se encontró el score en el reporte. Revísalo y corrígelo manualmente.');
    if (c.semaforo === 'ROJO') add('alto', 'Semáforo actual en ROJO.');
    else if (c.semaforo === 'AMARILLO') add('medio', 'Semáforo actual en AMARILLO.');
    if (deuda.peorCalificacion && deuda.peorCalificacion !== 'NORMAL') add(deuda.peorCalificacion === 'CPP' ? 'medio' : 'alto', `Registra calificación ${deuda.peorCalificacion} en el periodo.`);
    if (c.deudaVencida > 0) add('alto', `Tiene deuda vencida: S/ ${c.deudaVencida.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.`);
    if (c.deudaCastigada > 0 || (c.menciones && c.menciones.castigo && c.deudaCastigada === null)) add('alto', 'El reporte menciona deuda castigada.');
    if (c.deudaJudicial > 0 || (c.menciones && c.menciones.judicial && c.deudaJudicial === null)) add('alto', 'El reporte menciona cobranza judicial.');
    if (c.menciones && c.menciones.protestos) add('medio', 'El reporte menciona protestos.');
    if (deuda.mesesRojo > 0) add('medio', `${deuda.mesesRojo} mes(es) con semáforo rojo en el historial.`);
    if (c.numEntidades !== null && c.numEntidades >= 4) add('medio', `Reportado por ${c.numEntidades} entidades: posible sobreendeudamiento.`);
    if (deuda.tendencia === 'SUBE' && deuda.variacion > 0.5) add('medio', `La deuda creció ${(deuda.variacion * 100).toFixed(0)}% en el periodo.`);
    if (ruc.tieneRuc && ruc.rucActivo === false) add('alto', `RUC en estado ${c.estadoRuc}.`);
    if (c.condicionRuc && c.condicionRuc !== 'HABIDO') add('alto', `Domicilio fiscal ${c.condicionRuc}.`);
    if (ruc.perfil === 'INDETERMINADO') add('info', 'No se pudo determinar si el RUC es de negocio o de servicios. Verificar en SUNAT.');
    return a;
  }

  function analizarCliente(c) {
    const ruc = analizarRUC(c);
    const deuda = analizarDeuda(c);
    return { ruc, deuda, alertas: alertas(c, ruc, deuda) };
  }

  return { analizarCliente, analizarRUC, analizarDeuda, mesesEntre };
});
