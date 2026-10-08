/*
 * FILTPRODUC · Lector del reporte Sentinel
 * Recibe las líneas de texto del PDF y devuelve un objeto "cliente" con los
 * datos que se usan para calificar productos y campañas.
 *
 * Es heurístico: busca etiquetas típicas del reporte (Score, Semáforo, N° de
 * entidades, RUC, Tipo de contribuyente, historial mensual...). Cuando
 * tengamos un reporte real se afinan las etiquetas en ETIQUETAS.
 * Funciona en navegador (window.SentinelParser) y en Node (pruebas).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SentinelParser = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- utilidades ----------
  const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => sinTildes(String(s || '')).toUpperCase().replace(/[ºª°]/g, '°');

  const MESES = { ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6, JUL: 7, AGO: 8, SET: 9, SEP: 9, OCT: 10, NOV: 11, DIC: 12 };
  const MES_TXT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

  const RE_MONTO = /(?:S\/\.?\s*)?-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|(?:S\/\.?\s*)?-?\d+\.\d{2}\b/g;
  const RE_FECHA = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/;
  const RE_PERIODO = /\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SET|SEP|OCT|NOV|DIC)[A-Z]*\.?[\s\-\/.]*(\d{4}|\d{2})\b|\b(0?[1-9]|1[0-2])[\/\-](20\d{2})\b|\b(20\d{2})[\/\-](0?[1-9]|1[0-2])\b/g;
  const COLORES = ['VERDE', 'AMARILLO', 'ROJO', 'GRIS'];
  const RE_COLOR = /\b(VERDE|AMARILLO|ROJO|GRIS)\b/g;
  const CALIFICACIONES = [
    { clave: 'NORMAL', re: /\b(NORMAL|NOR)\b/ },
    { clave: 'CPP', re: /\b(CPP|C\.P\.P\.?|PROBLEMAS POTENCIALES)\b/ },
    { clave: 'DEFICIENTE', re: /\b(DEFICIENTE|DEF)\b/ },
    { clave: 'DUDOSO', re: /\b(DUDOSO|DUD)\b/ },
    { clave: 'PERDIDA', re: /\b(PERDIDA|PER)\b/ }
  ];
  const ORDEN_CALIF = ['NORMAL', 'CPP', 'DEFICIENTE', 'DUDOSO', 'PERDIDA'];

  function aMonto(txt) {
    if (txt == null) return null;
    const limpio = String(txt).replace(/S\/\.?/i, '').replace(/,/g, '').trim();
    const n = parseFloat(limpio);
    return isNaN(n) ? null : n;
  }

  function montosEn(linea) {
    const m = norm(linea).match(RE_MONTO) || [];
    return m.map(aMonto).filter(v => v !== null);
  }

  function fechaISO(txt) {
    const m = RE_FECHA.exec(txt || '');
    if (!m) return null;
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // ---------- etiquetas que se buscan en el reporte ----------
  const ETIQUETAS = {
    nombre: ['APELLIDOS Y NOMBRES', 'NOMBRES Y APELLIDOS', 'NOMBRE O RAZON SOCIAL', 'RAZON SOCIAL', 'TITULAR', 'CLIENTE', 'NOMBRE'],
    score: ['SENTINEL SCORE', 'SCORE SENTINEL', 'SCORE CREDITICIO', 'PUNTAJE SCORE', 'SCORE', 'PUNTAJE'],
    semaforo: ['SEMAFORO ACTUAL', 'SEMAFORO DEL MES', 'SEMAFORO'],
    entidades: ['N° DE ENTIDADES', 'NRO. DE ENTIDADES', 'NRO DE ENTIDADES', 'NUMERO DE ENTIDADES', 'CANTIDAD DE ENTIDADES', 'ENTIDADES QUE REPORTAN', 'ENTIDADES REPORTANTES', 'ENTIDADES REPORTADAS', 'N° ENTIDADES', 'NRO. ENTIDADES', 'N° DE IFIS', 'NRO. DE IFIS', 'IFIS'],
    deudaTotal: ['DEUDA TOTAL SBS', 'DEUDA TOTAL', 'TOTAL DEUDA', 'DEUDA SBS', 'SALDO TOTAL', 'DEUDA ACTUAL'],
    deudaVencida: ['DEUDA VENCIDA', 'MONTO VENCIDO', 'TOTAL VENCIDO'],
    deudaCastigada: ['DEUDA CASTIGADA', 'CASTIGADO'],
    deudaJudicial: ['COBRANZA JUDICIAL', 'DEUDA JUDICIAL'],
    lineaNoUtilizada: ['LINEA DE CREDITO NO UTILIZADA', 'LINEA NO UTILIZADA', 'LINEA DISPONIBLE'],
    calificacion: ['CALIFICACION SBS', 'CALIFICACION ACTUAL', 'CALIFICACION', 'CLASIFICACION SBS', 'CLASIFICACION'],
    tipoContribuyente: ['TIPO DE CONTRIBUYENTE', 'TIPO CONTRIBUYENTE'],
    estadoRuc: ['ESTADO DEL CONTRIBUYENTE', 'ESTADO CONTRIBUYENTE', 'ESTADO RUC', 'ESTADO DEL RUC', 'ESTADO'],
    condicionRuc: ['CONDICION DEL CONTRIBUYENTE', 'CONDICION DEL DOMICILIO', 'CONDICION'],
    actividad: ['ACTIVIDAD ECONOMICA PRINCIPAL', 'ACTIVIDAD ECONOMICA', 'ACTIVIDAD PRINCIPAL', 'CIIU', 'GIRO DEL NEGOCIO', 'GIRO'],
    inicioActividades: ['FECHA DE INICIO DE ACTIVIDADES', 'INICIO DE ACTIVIDADES', 'FECHA INICIO ACTIVIDADES', 'FECHA DE INICIO'],
    fechaReporte: ['FECHA DE CONSULTA', 'FECHA CONSULTA', 'FECHA DE REPORTE', 'FECHA DEL REPORTE', 'FECHA DE EMISION', 'FECHA DE PROCESO', 'FECHA']
  };

  /**
   * Busca una etiqueta y devuelve el texto que la sigue (misma línea o la siguiente).
   * validar(valor) permite descartar coincidencias que no tienen el formato esperado.
   */
  function buscar(lineasN, etiquetas, validar) {
    for (const et of etiquetas) {
      const reEt = new RegExp('(^|[^A-Z])' + et.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Z])');
      for (let i = 0; i < lineasN.length; i++) {
        const m = reEt.exec(lineasN[i]);
        if (!m) continue;
        const resto = lineasN[i].slice(m.index + m[0].length).replace(/^[\s:.\-=]+/, '');
        const candidatos = [resto];
        if (lineasN[i + 1]) candidatos.push(lineasN[i + 1].trim());
        for (const c of candidatos) {
          if (!c) continue;
          const v = validar ? validar(c) : c.split(/\s{2,}/)[0].trim();
          if (v !== null && v !== undefined && v !== '') return { valor: v, linea: i };
        }
      }
    }
    return null;
  }

  // ---------- extractores de campos ----------
  function extraerDocumentos(textoN) {
    const r = { dni: null, ruc: null };
    const mRuc = /\bR\.?\s?U\.?\s?C\.?\b[^\d\n]{0,25}((?:10|15|16|17|20)\d{9})\b/.exec(textoN)
      || /\b((?:10|20)\d{9})\b/.exec(textoN);
    if (mRuc) r.ruc = mRuc[1];
    const mDni = /\bD\.?\s?N\.?\s?I\.?\b[^\d\n]{0,25}(\d{8})\b/.exec(textoN)
      || /\bDOC(?:UMENTO)?(?:\s+DE\s+IDENTIDAD)?\b[^\d\n]{0,25}(\d{8})\b/.exec(textoN);
    if (mDni) r.dni = mDni[1];
    if (!r.dni && r.ruc && r.ruc.startsWith('10')) r.dni = r.ruc.slice(2, 10);
    return r;
  }

  const valEntero = (min, max) => c => {
    const m = /^(?:[^\d\n]{0,12})(\d{1,4})(?![\d.,\/%-])/.exec(c);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    return n >= min && n <= max ? n : null;
  };
  const valMonto = c => {
    const m = norm(c).match(RE_MONTO);
    if (m) return aMonto(m[0]);
    const m2 = /^(?:S\/\.?\s*)?(\d+)\b(?![\/\-])/.exec(c);
    return m2 ? parseFloat(m2[1]) : null;
  };
  const valColor = c => { const m = /\b(VERDE|AMARILLO|ROJO|GRIS)\b/.exec(c); return m ? m[1] : null; };
  const valFecha = c => fechaISO(c);
  const valTexto = c => {
    const v = c.split(/\s{2,}/)[0].replace(/^[:\-\s]+/, '').trim();
    return v.length >= 2 && /[A-Z]/.test(v) ? v : null;
  };
  const valCalif = c => {
    for (const k of CALIFICACIONES) if (k.re.test(c.split(/\s{2,}/)[0])) return k.clave;
    return null;
  };

  function distribucionCalificacion(textoN) {
    const dist = {};
    const re = /\b(NORMAL|NOR|CPP|DEFICIENTE|DEF|DUDOSO|DUD|PERDIDA|PER)\b\s*[:\-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g;
    let m;
    while ((m = re.exec(textoN))) {
      const clave = { NOR: 'NORMAL', DEF: 'DEFICIENTE', DUD: 'DUDOSO', PER: 'PERDIDA' }[m[1]] || m[1];
      if (dist[clave] === undefined) dist[clave] = parseFloat(m[2].replace(',', '.'));
    }
    return Object.keys(dist).length ? dist : null;
  }

  function periodoDe(m) {
    let mes, anio;
    if (m[1]) { mes = MESES[m[1]]; anio = +m[2]; }
    else if (m[3]) { mes = +m[3]; anio = +m[4]; }
    else { anio = +m[5]; mes = +m[6]; }
    if (anio < 100) anio += 2000;
    if (!mes || anio < 2000 || anio > 2100) return null;
    return { clave: `${anio}-${String(mes).padStart(2, '0')}`, etiqueta: `${MES_TXT[mes]} ${anio}` };
  }

  function periodosEn(lineaN) {
    const out = [];
    RE_PERIODO.lastIndex = 0;
    let m;
    while ((m = RE_PERIODO.exec(lineaN))) {
      // descartar fechas completas dd/mm/aaaa
      const antes = lineaN.slice(Math.max(0, m.index - 3), m.index);
      if (m[3] && /\d[\/\-.]$/.test(antes)) continue;
      const p = periodoDe(m);
      if (p) out.push({ ...p, idx: m.index, fin: m.index + m[0].length });
    }
    return out;
  }

  function califEn(txt) {
    for (const k of CALIFICACIONES) if (k.re.test(txt)) return k.clave;
    return null;
  }

  /** Historial mensual: soporta tabla vertical (un mes por fila) y horizontal (meses en columnas). */
  function extraerHistorial(lineasN) {
    const porPeriodo = new Map();
    const agregar = (p, datos) => {
      const prev = porPeriodo.get(p.clave) || { periodo: p.clave, etiqueta: p.etiqueta, deuda: null, semaforo: null, calificacion: null, entidades: null };
      for (const k of Object.keys(datos)) if (prev[k] === null && datos[k] !== null && datos[k] !== undefined) prev[k] = datos[k];
      porPeriodo.set(p.clave, prev);
    };

    for (let i = 0; i < lineasN.length; i++) {
      const l = lineasN[i];
      const ps = periodosEn(l);
      if (ps.length >= 3) {
        // Formato horizontal: encabezado de meses, valores en las filas siguientes
        for (let j = i + 1; j <= Math.min(i + 5, lineasN.length - 1); j++) {
          const sig = lineasN[j];
          if (periodosEn(sig).length >= 3) break;
          const colores = sig.match(RE_COLOR) || [];
          const montos = montosEn(sig);
          if (colores.length >= ps.length - 1) {
            const off = colores.length - ps.length;
            ps.forEach((p, k) => agregar(p, { semaforo: colores[k + Math.max(0, off)] || null }));
          } else if (montos.length >= ps.length - 1 && montos.length >= 3) {
            const off = montos.length - ps.length;
            ps.forEach((p, k) => agregar(p, { deuda: montos[k + Math.max(0, off)] ?? null }));
          }
        }
      } else if (ps.length === 1 || ps.length === 2) {
        // Formato vertical: "SET-2026   VERDE   12,500.00   NOR"
        const p = ps[0];
        const resto = l.slice(p.fin);
        if (fechaISO(l) && !/^\s*(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SET|SEP|OCT|NOV|DIC|\d)/.test(l.trim())) continue;
        const montos = montosEn(resto);
        const color = (resto.match(RE_COLOR) || [])[0] || null;
        const calif = califEn(resto);
        const mEnt = /\b(\d{1,2})\s+(?:ENT|IFI)/.exec(resto);
        if (montos.length || color || calif) {
          agregar(p, { deuda: montos.length ? montos[0] : null, semaforo: color, calificacion: calif, entidades: mEnt ? +mEnt[1] : null });
        }
      }
    }
    return [...porPeriodo.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)).slice(-24);
  }

  // Entidades financieras más comunes en Perú (para reconocer el detalle por entidad)
  const IFIS = [
    'CAJA PIURA', 'CAJA AREQUIPA', 'CAJA HUANCAYO', 'CAJA TRUJILLO', 'CAJA SULLANA', 'CAJA CUSCO', 'CAJA ICA', 'CAJA TACNA',
    'CAJA MAYNAS', 'CAJA DEL SANTA', 'CAJA METROPOLITANA', 'CAJA PAITA', 'CAJA LOS ANDES', 'CAJA RAIZ', 'CAJA INCASUR', 'CAJA CENTRO',
    'CMAC PIURA', 'CMAC AREQUIPA', 'CMAC HUANCAYO', 'CMAC TRUJILLO', 'CMAC SULLANA', 'CMAC CUSCO', 'CMAC ICA', 'CMAC TACNA', 'CMAC MAYNAS',
    'CREDITO DEL PERU', 'BCP', 'INTERBANK', 'BBVA', 'SCOTIABANK', 'BANBIF', 'BANCO PICHINCHA', 'PICHINCHA', 'MIBANCO', 'BANCO GNB',
    'BANCO FALABELLA', 'FALABELLA', 'BANCO RIPLEY', 'RIPLEY', 'BANCO DE LA NACION', 'AGROBANCO', 'ALFIN', 'BANCO AZTECA', 'COMPARTAMOS',
    'FINANCIERA CONFIANZA', 'CONFIANZA', 'CREDISCOTIA', 'FINANCIERA OH', 'FINANCIERA EFECTIVA', 'EFECTIVA', 'PROEMPRESA', 'QAPAQ',
    'CREDINKA', 'SANTANDER', 'MITSUI', 'FINANCIERA ACCESO', 'ACCESO CREDITICIO', 'SURGIR', 'CAJA PRYMERA', 'COOPAC', 'EDPYME'
  ];

  function extraerEntidades(lineasN) {
    const vistos = new Map();
    for (const l of lineasN) {
      if (periodosEn(l).length >= 2) continue;
      for (const ifi of IFIS) {
        const idx = l.indexOf(ifi);
        if (idx === -1) continue;
        // nombre completo de la entidad = el bloque de texto donde aparece
        const bloque = l.slice(0, l.length).split(/\s{2,}/).find(b => b.includes(ifi)) || ifi;
        const nombre = bloque.replace(/[\d,.%]+$/, '').trim();
        const montos = montosEn(l.slice(idx + ifi.length));
        if (!montos.length) break;
        const clave = nombre;
        if (!vistos.has(clave)) {
          vistos.set(clave, { entidad: nombre, deuda: montos[0], calificacion: califEn(l.slice(idx + ifi.length)) });
        }
        break;
      }
    }
    return [...vistos.values()];
  }

  // ---------- función principal ----------
  /**
   * @param {string[]|string} entrada  líneas (o texto completo) extraídas del PDF
   * @returns {object} cliente
   */
  function analizar(entrada) {
    const lineas = Array.isArray(entrada) ? entrada : String(entrada).split(/\r?\n/);
    const lineasN = lineas.map(norm);
    const textoN = lineasN.join('\n');

    // Formato real "Reporte de Crédito" Sentinel/Experian → lector especializado
    const Experian = (typeof SentinelExperian !== 'undefined' && SentinelExperian) ||
      (typeof require === 'function' ? (() => { try { return require('./sentinel-experian.js'); } catch (e) { return null; } })() : null);
    if (Experian && Experian.esExperian(textoN)) return Experian.analizar(lineas);

    const hallados = {};
    const val = (campo, etiquetas, validador) => {
      const r = buscar(lineasN, etiquetas, validador);
      hallados[campo] = !!r;
      return r ? r.valor : null;
    };

    const docs = extraerDocumentos(textoN);
    const cliente = {
      fuente: 'Sentinel',
      nombre: val('nombre', ETIQUETAS.nombre, c => {
        const v = valTexto(c);
        return v && !/\d{8}/.test(v) && v.split(' ').length >= 2 ? v : null;
      }),
      dni: docs.dni,
      ruc: docs.ruc,
      fechaReporte: val('fechaReporte', ETIQUETAS.fechaReporte, valFecha),
      score: val('score', ETIQUETAS.score, valEntero(0, 9999)),
      semaforo: val('semaforo', ETIQUETAS.semaforo, valColor),
      numEntidades: val('numEntidades', ETIQUETAS.entidades, valEntero(0, 60)),
      deudaTotal: val('deudaTotal', ETIQUETAS.deudaTotal, valMonto),
      deudaVencida: val('deudaVencida', ETIQUETAS.deudaVencida, valMonto),
      deudaCastigada: val('deudaCastigada', ETIQUETAS.deudaCastigada, valMonto),
      deudaJudicial: val('deudaJudicial', ETIQUETAS.deudaJudicial, valMonto),
      lineaNoUtilizada: val('lineaNoUtilizada', ETIQUETAS.lineaNoUtilizada, valMonto),
      calificacion: val('calificacion', ETIQUETAS.calificacion, valCalif),
      distribucionCalificacion: distribucionCalificacion(textoN),
      tipoContribuyente: val('tipoContribuyente', ETIQUETAS.tipoContribuyente, valTexto),
      estadoRuc: val('estadoRuc', ETIQUETAS.estadoRuc, c => { const m = /\b(ACTIVO|BAJA DE OFICIO|BAJA DEFINITIVA|BAJA PROVISIONAL|BAJA|SUSPENSION TEMPORAL|SUSPENDIDO|INACTIVO)\b/.exec(c); return m ? m[1] : null; }),
      condicionRuc: val('condicionRuc', ETIQUETAS.condicionRuc, c => { const m = /\b(NO HABIDO|NO HALLADO|HABIDO|PENDIENTE)\b/.exec(c); return m ? m[1] : null; }),
      actividad: val('actividad', ETIQUETAS.actividad, valTexto),
      inicioActividades: val('inicioActividades', ETIQUETAS.inicioActividades, valFecha),
      historial: extraerHistorial(lineasN),
      detalleEntidades: extraerEntidades(lineasN),
      menciones: {
        castigo: /CASTIGAD/.test(textoN),
        judicial: /COBRANZA JUDICIAL|EN JUDICIAL|\bJUDICIAL\b/.test(textoN),
        protestos: /PROTEST/.test(textoN),
        morosidad: /MOROS|VENCID/.test(textoN)
      }
    };

    // Si no se halló la calificación principal, tomar la peor de la distribución
    if (!cliente.calificacion && cliente.distribucionCalificacion) {
      const presentes = ORDEN_CALIF.filter(k => (cliente.distribucionCalificacion[k] || 0) > 0);
      cliente.calificacion = presentes.length ? presentes[presentes.length - 1] : null;
    }
    // Si no se halló el semáforo actual, usar el del último mes del historial
    if (!cliente.semaforo && cliente.historial.length) {
      cliente.semaforo = cliente.historial[cliente.historial.length - 1].semaforo;
    }
    // N° de entidades: si no está explícito, se estima con el detalle por entidad
    cliente.numEntidadesEstimado = false;
    if (cliente.numEntidades === null && cliente.detalleEntidades.length) {
      cliente.numEntidades = cliente.detalleEntidades.length;
      cliente.numEntidadesEstimado = true;
    }
    if (cliente.deudaTotal === null && cliente.detalleEntidades.length) {
      cliente.deudaTotal = +cliente.detalleEntidades.reduce((s, e) => s + (e.deuda || 0), 0).toFixed(2);
    }

    cliente.camposHallados = hallados;
    return cliente;
  }

  return { analizar, norm, aMonto, fechaISO, ORDEN_CALIF, COLORES };
});
