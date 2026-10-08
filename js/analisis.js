/*
 * FILTPRODUC · Análisis del cliente
 * A partir de los datos leídos del reporte calcula:
 *  - perfil del RUC (negocio, sin negocio/servicios, empresa, sin RUC)
 *  - comportamiento del endeudamiento (24 meses): actual, máximo, tendencia,
 *    nuevos créditos, entidades que dejaron de reportar
 *  - alertas para el asesor
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Analisis = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ORDEN_CALIF = ['NORMAL', 'CPP', 'DEFICIENTE', 'DUDOSO', 'PERDIDA'];
  const S = n => 'S/ ' + Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function mesesEntre(isoDesde, isoHasta) {
    if (!isoDesde) return null;
    const a = new Date(isoDesde + 'T00:00:00');
    const b = isoHasta ? new Date(isoHasta + 'T00:00:00') : new Date();
    if (isNaN(a) || isNaN(b)) return null;
    return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0));
  }

  // Actividad económica que indica servicios profesionales / independientes
  const RE_SERVICIOS = /(ACTIVIDADES PROFESIONALES|ASESORIA|CONSULTORIA|ABOGAD|JURIDIC|CONTABIL|AUDITORIA|ARQUITECT|INGENIERIA|MEDIC|ODONTOLOG|ENFERMER|PSICOLOG|DOCENTE|ENSENANZA|EDUCACION|PROFESOR|PROGRAMACION INFORMATICA|DISENO|PUBLICIDAD|INVESTIGACION|TRADUCC|SERVICIOS DE APOYO|CUARTA CATEGORIA|4TA|RENTA DE CUARTA)/;

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
    r.tipoPersona = { '10': 'Persona natural con RUC 10', '15': 'Persona natural no domiciliada / otros', '16': 'Otros', '17': 'Persona natural (extranjero)', '20': 'Persona jurídica (RUC 20)' }[pref] || 'Otro';
    r.rucActivo = c.estadoRuc ? c.estadoRuc === 'ACTIVO' : null;

    const tipo = (c.tipoContribuyente || '').toUpperCase();
    const act = (c.actividad || '').toUpperCase();

    if (pref === '20') {
      r.perfil = 'EMPRESA';
      r.perfilTexto = 'Empresa (persona jurídica)';
      r.motivo = 'RUC 20: persona jurídica.';
    } else if (/SIN NEGOCIO/.test(tipo) || /CUARTA|4TA/.test(tipo)) {
      r.perfil = 'SERVICIOS';
      r.perfilTexto = 'Sin negocio · presta servicios';
      r.motivo = `SUNAT lo registra como "${c.tipoContribuyente}": no tiene un negocio inscrito; normalmente es dependiente o emite recibos por honorarios (4ta categoría).`;
    } else if (/CON NEGOCIO|EMPRESA INDIVIDUAL|E\.I\.R\.L/.test(tipo)) {
      r.perfil = 'NEGOCIO';
      r.perfilTexto = 'Persona con negocio';
      r.motivo = `SUNAT lo registra como "${c.tipoContribuyente}"${c.nombreComercial ? `, nombre comercial "${c.nombreComercial}"` : ''}.`;
    } else if (act && RE_SERVICIOS.test(act)) {
      r.perfil = 'SERVICIOS';
      r.perfilTexto = 'Presta servicios (por actividad)';
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

  function variacion(desde, hasta) {
    if (desde === null || hasta === null || desde === undefined || hasta === undefined) return null;
    if (desde === 0) return hasta > 0 ? null : 0;
    return (hasta - desde) / desde;
  }

  function analizarDeuda(c) {
    const hist = (c.historial || []);
    const h = hist.filter(x => x.deuda !== null && x.deuda !== undefined);
    const ult = h.length ? h[h.length - 1] : null;
    const r = {
      meses: hist.length,
      deudaActual: c.deudaSBS ?? (ult ? ult.deuda : c.deudaTotal),
      maximo: null, fechaMaximo: null, promedio: null,
      desdeMaximo: null,
      deuda12m: null, variacion: null, tendencia: 'SIN_DATOS', tendenciaTexto: 'Sin historial suficiente',
      mesesSemaforoNoVerde: 0, mesesAmarillo: 0, mesesRojo: 0,
      entidadesActual: c.numEntidades, entidadesMax: c.maxEntidades ?? null,
      peorCalificacion: null,
      eventos: [],
      yaNoReportan: (c.detalleEntidades || []).filter(e => e.estado === 'YA_NO_REPORTA')
    };

    if (c.endeudamientoMaximo) {
      r.maximo = c.endeudamientoMaximo.monto; r.fechaMaximo = c.endeudamientoMaximo.etiqueta;
    } else if (h.length) {
      const mx = h.reduce((a, b) => (b.deuda > a.deuda ? b : a));
      r.maximo = mx.deuda; r.fechaMaximo = mx.etiqueta;
    }
    if (h.length) r.promedio = h.reduce((s, x) => s + x.deuda, 0) / h.length;
    if (r.maximo && r.deudaActual !== null && r.deudaActual !== undefined) r.desdeMaximo = variacion(r.maximo, r.deudaActual);
    if (!r.entidadesMax && hist.length) r.entidadesMax = Math.max(...hist.map(x => x.entidades || 0)) || null;

    // Tendencia: últimos 12 meses (o todo el historial si es más corto)
    if (h.length >= 2) {
      const base = h.length > 12 ? h[h.length - 13] : h[0];
      r.deuda12m = base.deuda;
      r.baseEtiqueta = base.etiqueta;
      r.variacion = variacion(base.deuda, ult.deuda);
      if (r.variacion === null) { r.tendencia = 'NUEVO'; r.tendenciaTexto = 'Empezó a endeudarse en el periodo'; }
      else if (r.variacion > 0.15) { r.tendencia = 'SUBE'; r.tendenciaTexto = 'Endeudamiento en aumento'; }
      else if (r.variacion < -0.15) { r.tendencia = 'BAJA'; r.tendenciaTexto = 'Endeudamiento en descenso'; }
      else { r.tendencia = 'ESTABLE'; r.tendenciaTexto = 'Endeudamiento estable'; }

      // Eventos: saltos fuertes de un mes a otro (nuevo crédito / cancelación)
      for (let i = 1; i < h.length; i++) {
        const a = h[i - 1], b = h[i], dif = b.deuda - a.deuda;
        if (dif >= 2000 && (a.deuda === 0 || dif / a.deuda >= 0.3)) r.eventos.push({ tipo: 'SUBE', etiqueta: b.etiqueta, monto: dif, texto: `Nuevo endeudamiento en ${b.etiqueta}: +${S(dif)}` + (b.entidades !== null && a.entidades !== null && b.entidades !== a.entidades ? ` (entidades ${a.entidades} → ${b.entidades})` : '') });
        else if (-dif >= 5000 && -dif / a.deuda >= 0.3) r.eventos.push({ tipo: 'BAJA', etiqueta: b.etiqueta, monto: -dif, texto: `Redujo su deuda en ${b.etiqueta}: −${S(-dif)}` + (b.entidades !== null && a.entidades !== null && b.entidades !== a.entidades ? ` (entidades ${a.entidades} → ${b.entidades})` : '') });
      }
    } else if (ult) {
      r.promedio = ult.deuda;
    }

    for (const m of hist) {
      if (m.semaforo && m.semaforo !== 'VERDE' && m.semaforo !== 'GRIS') r.mesesSemaforoNoVerde++;
      if (m.semaforo === 'AMARILLO') r.mesesAmarillo++;
      if (['NARANJA', 'ROJO', 'NEGRO'].includes(m.semaforo)) r.mesesRojo++;
    }
    const califs = [c.calificacion, ...hist.map(m => m.calificacion), ...(c.detalleEntidades || []).map(e => e.calificacion)]
      .filter(x => ORDEN_CALIF.includes(x));
    if (c.distribucionCalificacion) for (const k of Object.keys(c.distribucionCalificacion)) if (c.distribucionCalificacion[k] > 0) califs.push(k);
    if (califs.length) r.peorCalificacion = califs.sort((a, b) => ORDEN_CALIF.indexOf(b) - ORDEN_CALIF.indexOf(a))[0];
    return r;
  }

  function alertas(c, ruc, deuda) {
    const a = [];
    const add = (nivel, texto) => a.push({ nivel, texto });
    if (c.score === null || c.score === undefined) add('info', 'No se encontró el score en el reporte. Revísalo y corrígelo manualmente.');
    const SEM_ALERTA = { AMARILLO: ['medio', 'CPP (con problemas potenciales)'], NARANJA: ['alto', 'Dudoso'], ROJO: ['alto', 'Deficiente'], NEGRO: ['alto', 'Pérdida'] };
    if (SEM_ALERTA[c.semaforo]) add(SEM_ALERTA[c.semaforo][0], `Semáforo actual en ${c.semaforo}: calificación ${SEM_ALERTA[c.semaforo][1]}.`);
    if (c.semaforoSentinel === 'ROJO') add('alto', 'Semáforo de riesgo Sentinel en rojo: deudas con atraso significativo.');
    else if (c.semaforoSentinel === 'AMARILLO') add('medio', 'Semáforo de riesgo Sentinel en amarillo: deudas con poco atraso.');
    if (deuda.peorCalificacion && deuda.peorCalificacion !== 'NORMAL') add(deuda.peorCalificacion === 'CPP' ? 'medio' : 'alto', `Registra calificación ${deuda.peorCalificacion} en el periodo.`);
    if (c.porcentajeNormal !== null && c.porcentajeNormal !== undefined && c.porcentajeNormal < 100) add('alto', `Solo el ${c.porcentajeNormal}% de su deuda está en calificación Normal.`);
    if (c.deudaVencida > 0) add('alto', `Deuda vencida en el sistema financiero: ${S(c.deudaVencida)}.`);
    for (const v of (c.vencidos || [])) add(v.diasVencido > 90 ? 'alto' : 'medio', `${v.tipo ? v.tipo.charAt(0) + v.tipo.slice(1).toLowerCase() : 'Deuda vencida'}: ${S(v.monto)} con ${v.acreedor}${v.diasVencido ? ` (${v.diasVencido} días de atraso)` : ''}.`);
    if (c.docsImpagos > 0 && !(c.vencidos || []).length) add('medio', `Documentos impagos por ${S(c.docsImpagos)}.`);
    if (c.deudaTributaria > 0) add('alto', `Deuda tributaria (SUNAT): ${S(c.deudaTributaria)}.`);
    if (c.deudaLaboral > 0) add('alto', `Deuda laboral: ${S(c.deudaLaboral)}.`);
    if (c.protestos > 0) add('alto', `Protestos: ${S(c.protestos)}.`);
    if (c.deudorAlimentario) add('alto', 'Figura en el registro de Deudores Alimentarios Morosos (DAM).');
    if (c.reportesNegativos > 0) add('medio', `${c.reportesNegativos} reporte(s) negativo(s) de otras fuentes.`);
    if (c.deudaCastigada > 0 || (c.menciones && c.menciones.castigo)) add('alto', 'El reporte menciona deuda castigada.');
    if (c.deudaJudicial > 0 || (c.menciones && c.menciones.judicial)) add('alto', 'El reporte menciona cobranza judicial.');
    if (deuda.mesesRojo > 0) add('alto', `${deuda.mesesRojo} mes(es) con calificación Deficiente, Dudoso o Pérdida en el historial.`);
    if (c.numEntidades !== null && c.numEntidades >= 4) add('medio', `Reportado por ${c.numEntidades} entidades: posible sobreendeudamiento.`);
    for (const e of deuda.eventos.filter(x => x.tipo === 'SUBE').slice(-2)) add('info', e.texto + '.');
    if (deuda.yaNoReportan.length) add('info', `Ya no reporta deuda con: ${deuda.yaNoReportan.map(e => e.entidad).join(', ')} (últimos 6 meses).`);
    if (ruc.tieneRuc && ruc.rucActivo === false) add('alto', `RUC en estado ${c.estadoRuc}.`);
    if (c.condicionRuc && c.condicionRuc !== 'HABIDO') add('alto', `Domicilio fiscal ${c.condicionRuc}.`);
    if (ruc.perfil === 'INDETERMINADO') add('info', 'No se pudo determinar si el RUC es de negocio o de servicios. Verificar en SUNAT.');
    const orden = { alto: 0, medio: 1, info: 2 };
    return a.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
  }

  function analizarCliente(c) {
    const ruc = analizarRUC(c);
    const deuda = analizarDeuda(c);
    return { ruc, deuda, alertas: alertas(c, ruc, deuda) };
  }

  return { analizarCliente, analizarRUC, analizarDeuda, mesesEntre };
});
