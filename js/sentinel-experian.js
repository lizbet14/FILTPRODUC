/*
 * FILTPRODUC · Lector del "Reporte de Crédito" de Sentinel / Experian
 * (formato real calibrado con reportes de octubre 2026).
 *
 * Secciones que se leen:
 *  - Cabecera: DNI, nombre, score Experian y su texto ("Buen Puntaje")
 *  - Consulta Rápida: semáforo (valor numérico) y deuda total del DNI y del RUC
 *  - Indicadores ("Línea de Crédito", "Está Avalado"...) e Ingreso Estimado
 *  - Detalle de la deuda SBS/Microfinanzas por entidad
 *  - Detalle de vencidos (documentos impagos)
 *  - Utilización de líneas de crédito
 *  - Información General (SUNAT): tipo de contribuyente, actividad, etc.
 *  - Posición Histórica (24 meses): entidades, deuda SBS, % normal, vencidos...
 *  - Protestos y Deudores Alimentarios Morosos
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SentinelExperian = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const sinTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => sinTildes(String(s || '')).toUpperCase().replace(/[ºª]/g, '°');
  const monto = t => { const n = parseFloat(String(t).replace(/,/g, '')); return isNaN(n) ? null : n; };
  const RE_MONTO_G = /-?\d{1,3}(?:,\d{3})*\.\d{2}\b/g;
  const RE_FECHA = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
  const iso = (d, m, y) => `${y}-${m}-${d}`;
  const MESES_LARGOS = { ENERO: 1, FEBRERO: 2, MARZO: 3, ABRIL: 4, MAYO: 5, JUNIO: 6, JULIO: 7, AGOSTO: 8, SETIEMBRE: 9, SEPTIEMBRE: 9, OCTUBRE: 10, NOVIEMBRE: 11, DICIEMBRE: 12 };
  const MES_TXT = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];
  const CALIF = { NOR: 'NORMAL', CPP: 'CPP', DEF: 'DEFICIENTE', DUD: 'DUDOSO', PER: 'PERDIDA', SCAL: 'SIN CALIFICACION' };
  const ORDEN_CALIF = ['NORMAL', 'CPP', 'DEFICIENTE', 'DUDOSO', 'PERDIDA'];

  /** Semáforo según la regla del reporte: Verde 0<=s<0.001 · Amarillo 0.001<=s<=2 · Rojo 2<s<=6 */
  function colorSemaforo(valor, sinDeuda) {
    if (valor === null || valor === undefined || isNaN(valor)) return null;
    if (sinDeuda) return 'GRIS';
    if (valor < 0.001) return 'VERDE';
    if (valor <= 2) return 'AMARILLO';
    return 'ROJO';
  }

  /**
   * Semáforo FILTPRODUC según calificación SBS (definido por el asesor):
   * NOR Verde · CPP Amarillo · DEF Naranja · DUD Rojo · PER Negro (orden de gravedad SBS) · sin calificación Gris
   */
  const SEMAFORO_CALIF = { NORMAL: 'VERDE', CPP: 'AMARILLO', DEFICIENTE: 'NARANJA', DUDOSO: 'ROJO', PERDIDA: 'NEGRO', 'SIN CALIFICACION': 'GRIS' };
  function semaforoDeCalificacion(calif, sinDeuda) {
    if (sinDeuda) return 'GRIS';
    return calif ? (SEMAFORO_CALIF[calif] || null) : null;
  }

  function esExperian(textoN) {
    return /EXPERIAN/.test(textoN) && /(POSICION HISTORICA|CONSULTA RAPIDA|REPORTE DE CREDITO)/.test(textoN);
  }

  // Líneas de encabezado/pie que se repiten en cada página y deben ignorarse en las tablas
  const RE_RUIDO = /^(USUARIO:|EL PRESENTE REPORTE|NO SE HA UTILIZADO|DNI\s+\d{8}\s+INFORMACION ACTUALIZADA|REPORTE DE CREDITO$|MONTOS EXPRESADOS)/;

  // Líneas originales (en mayúsculas, con tildes y Ñ) para mostrar los textos tal cual
  let ORIG = [];
  /** Devuelve el texto original equivalente a 'valorN' encontrado en la línea i. */
  function original(i, valorN) {
    if (!valorN || i < 0 || !ORIG[i]) return valorN;
    const ln = sinTildes(ORIG[i]).toUpperCase();
    const o = ORIG[i].toUpperCase();
    if (ln.length !== o.length) return valorN;
    const pos = ln.indexOf(valorN);
    return pos >= 0 ? o.substr(pos, valorN.length) : valorN;
  }

  function indice(lineasN, re, desde = 0) {
    for (let i = desde; i < lineasN.length; i++) if (re.test(lineasN[i])) return i;
    return -1;
  }

  /** Valor que sigue a una etiqueta "Etiqueta:  valor" en la MISMA línea (hasta el siguiente bloque). */
  function valorDe(lineasN, reEtiqueta) {
    for (let i = 0; i < lineasN.length; i++) {
      const l = lineasN[i];
      const m = reEtiqueta.exec(l);
      if (!m) continue;
      const resto = l.slice(m.index + m[0].length).replace(/^[\s:]+/, '');
      const v = resto.split(/\s{2,}/)[0].trim();
      return v && !/:$/.test(v) ? original(i, v) : null;
    }
    return null;
  }

  // ---------- secciones ----------
  function cabecera(lineasN) {
    const r = { dni: null, nombre: null, score: null, scoreTexto: null };
    // "DNI 12345678 - APELLIDOS NOMBRES" (la del cliente, no la del usuario que consulta)
    for (let i = 0; i < lineasN.length; i++) {
      const l = lineasN[i];
      const m = /^(DNI|CE|PAS|RUC)\s+(\d{8,11})\s+-\s+(.+)$/.exec(l.trim());
      if (m && !/^USUARIO/.test(l)) { r.dni = m[1] === 'DNI' ? m[2] : null; r.nombre = original(i, m[3].trim()); r.tipoDocumento = m[1]; r.numeroDocumento = m[2]; break; }
    }
    if (!r.dni) { const m = /^DNI\s+(\d{8})\b/.exec(lineasN[0] || ''); if (m) r.dni = m[1]; }

    const iScore = indice(lineasN, /^SCORE$/);
    const iPuntaje = indice(lineasN, /PUNTAJE/, Math.max(0, iScore));
    if (iScore >= 0) {
      const fin = iPuntaje > iScore ? iPuntaje : Math.min(lineasN.length, iScore + 12);
      for (let i = iScore + 1; i < fin; i++) {
        const m = /^\s*(\d{1,4})\s*$/.exec(lineasN[i]);
        if (m) { r.score = parseInt(m[1], 10); break; }
      }
    }
    if (iPuntaje >= 0 && iPuntaje - iScore < 15) r.scoreTexto = lineasN[iPuntaje].trim().replace(/^(.)(.*)$/, (_, a, b) => a + b.toLowerCase());
    return r;
  }

  /** Filas "dd/mm/aaaa  DNI|RUC  número  [nombre]  semáforo  deuda" de la Consulta Rápida. */
  function consultaRapida(lineasN) {
    const docs = {};
    for (const l of lineasN) {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(DNI|RUC|CE|PAS)\s+(\d{8,11})\b(.*)$/.exec(l.trim());
      if (!m) continue;
      const resto = m[6];
      const sem = /(?:^|\s)(\d+\.\d{3})(?=\s)/.exec(resto);
      const montos = resto.match(RE_MONTO_G) || [];
      const deuda = montos.length ? monto(montos[montos.length - 1]) : null;
      const clave = m[4];
      if (!docs[clave]) {
        docs[clave] = {
          tipo: clave, numero: m[5], fechaProceso: iso(m[1], m[2], m[3]),
          semaforoValor: sem ? parseFloat(sem[1]) : null, deudaTotal: deuda
        };
      }
    }
    return docs;
  }

  function indicadores(lineasN) {
    const i = indice(lineasN, /LA PERSONA CONSULTADA CUENTA CON/);
    if (i < 0) return [];
    const out = [];
    for (let j = i + 1; j < lineasN.length && j < i + 12; j++) {
      if (/OTROS PRODUCTOS|INGRESO ESTIMADO|CONSULTA RAPIDA/.test(lineasN[j])) break;
      const t = lineasN[j].trim();
      if (t) out.push(...t.split(/\s{2,}/).map(x => original(j, x.trim())).filter(Boolean));
    }
    return out;
  }

  function ingresoEstimado(lineasN) {
    for (const l of lineasN) {
      const m = /S\/\s*\[\s*([\d,]+)\s*-\s*([\d,]+)\s*\]/.exec(l);
      if (m) return { min: monto(m[1]), max: monto(m[2]), texto: `S/ ${m[1]} – ${m[2]}` };
      const m2 = /S\/\s*\[\s*(MAS DE|MAYOR A|>)\s*([\d,]+)\s*\]/.exec(l);
      if (m2) return { min: monto(m2[2]), max: null, texto: `Más de S/ ${m2[2]}` };
    }
    return null;
  }

  /** Detalle de la deuda SBS/Microfinanzas (una tabla por documento: DNI y luego RUC). */
  function detalleDeuda(lineasN) {
    const entidades = [];
    let periodoActual = null;
    let doc = 'DNI';
    for (let i = 0; i < lineasN.length; i++) {
      if (/OTROS DOCUMENTOS DE IDENTIFICACION RELACIONADOS/.test(lineasN[i])) doc = 'RUC';
      if (!/DETALLE DE LA DEUDA SBS/.test(lineasN[i])) continue;
      for (let j = i + 1; j < lineasN.length; j++) {
        const l = lineasN[j].trim();
        if (/^\(1\) VER DETALLE|SE MUESTRA INFORMACION HASTA|DETALLE DE VENCIDOS/.test(l)) { i = j; break; }
        const mPer = /DEUDA A\s+([A-Z]{3})\s+(\d{4})/.exec(l);
        if (mPer) periodoActual = `${mPer[1]} ${mPer[2]}`;
        if (RE_RUIDO.test(l) || /^TOTAL\b/.test(l)) continue;
        const m = /^([A-Z][A-Z0-9 .&'\-\/]*?[A-Z.])\s{2,}(.+)$/.exec(l);
        if (!m) continue;
        if (/^(DEUDA ANTERIOR|RECT\.|ENTIDAD|MAR|ABR|MAY|JUN|JUL|AGO|SET|OCT|NOV|DIC|ENE|FEB|MICROF)/.test(m[1])) continue;
        const resto = m[2];
        const f = RE_FECHA.exec(resto);
        let anteriores, actual = null, calif = null, dias = null, fechaInf = null;
        if (f) {
          fechaInf = iso(f[1], f[2], f[3]);
          anteriores = (resto.slice(0, f.index).match(RE_MONTO_G) || []).map(monto);
          const despues = resto.slice(f.index + f[0].length);
          const mc = /\b(NOR|CPP|DEF|DUD|PER|SCAL)\b/.exec(despues);
          if (mc) calif = CALIF[mc[1]];
          const ms = despues.match(RE_MONTO_G) || [];
          if (ms.length) actual = monto(ms[0]);
          const md = /\.\d{2}\s+(\d{1,5})\b(?!\.)/.exec(despues);
          if (md) dias = parseInt(md[1], 10);
        } else {
          anteriores = (resto.match(RE_MONTO_G) || []).map(monto);
        }
        if (!anteriores.length && actual === null && !calif) continue;
        const maxAnt = anteriores.length ? Math.max(...anteriores) : null;
        entidades.push({
          entidad: original(j, m[1].trim()), documento: doc, fechaInforme: fechaInf, calificacion: calif,
          deuda: actual, diasVencido: dias, anteriores, maxAnterior: maxAnt,
          vigente: !!f,
          estado: f ? (actual > 0 ? 'CON_DEUDA' : 'SIN_SALDO') : (maxAnt > 0 ? 'YA_NO_REPORTA' : 'SIN_SALDO')
        });
      }
    }
    return { entidades, periodoActual };
  }

  function detalleVencidos(lineasN) {
    const out = [];
    for (let i = 0; i < lineasN.length; i++) {
      if (!/^DETALLE DE VENCIDOS/.test(lineasN[i].trim())) continue;
      let tipo = null;
      for (let j = i + 1; j < lineasN.length && j < i + 30; j++) {
        const l = lineasN[j].trim();
        if (/^(UTILIZACION DE LINEAS|OTROS DOCUMENTOS|INFORMACION GENERAL|DETALLE DE LA DEUDA|USUARIO:)/.test(l)) break;
        const mt = /^([A-Z][A-Z .]+?)\s{2,}([\d,]+\.\d{2})$/.exec(l);
        if (mt && !/^#/.test(l)) { tipo = mt[1].trim(); continue; }
        const m = /^(\d+)\s+(.+?)\s{2,}([\d,]+\.\d{2})(?:\s+(\d+))?$/.exec(l);
        if (m) out.push({ tipo, documentos: +m[1], acreedor: original(j, m[2].trim()), monto: monto(m[3]), diasVencido: m[4] ? +m[4] : null });
      }
    }
    return out;
  }

  function lineasCredito(lineasN) {
    const i = indice(lineasN, /UTILIZACION DE LINEAS DE CREDITO/);
    if (i < 0) return [];
    const out = [];
    for (let j = i + 1; j < lineasN.length && j < i + 25; j++) {
      const l = lineasN[j].trim();
      if (/^\*\*|OTROS DOCUMENTOS|INFORMACION GENERAL|USUARIO:/.test(l)) break;
      if (/^(INSTITUCIONES|TOTAL)\b/.test(l)) continue;
      const m = /^([A-Z][A-Z0-9 .&\-]*?)\s{2,}([A-Z]{2,4})\s+(.+)$/.exec(l);
      if (!m) continue;
      const nums = (m[3].match(RE_MONTO_G) || []).map(monto);
      if (!nums.length) continue;
      const aprobada = nums[0];
      const noUtilizada = nums[1] ?? null;
      const utilizada = nums[2] ?? (noUtilizada !== null ? +(aprobada - noUtilizada).toFixed(2) : null);
      out.push({ institucion: m[1].trim(), tipo: m[2], aprobada, noUtilizada, utilizada });
    }
    return out;
  }

  function sunat(lineasN) {
    const r = {
      razonSocial: valorDe(lineasN, /RAZON SOCIAL:/),
      nombreComercial: valorDe(lineasN, /NOMBRE COMERCIAL:/),
      tipoContribuyente: valorDe(lineasN, /TIPO DE CONTRIBUYENTE:/),
      estadoRuc: valorDe(lineasN, /ESTADO DE(L)? CONTRIBUYENTE:/),
      condicionRuc: valorDe(lineasN, /CONDICION DE(L)? CONTRIBUYENTE:/),
      tamano: valorDe(lineasN, /TAMANO CONTRIBUYENTE:/),
      inicioActividades: null, actividad: null, ciiu: null, actividadSecundaria: null
    };
    const ini = valorDe(lineasN, /INICIO DE ACTIVIDADES:/);
    const f = ini && RE_FECHA.exec(ini);
    if (f) r.inicioActividades = iso(f[1], f[2], f[3]);
    const act = valorDe(lineasN, /ACTIVIDAD ECONOMICA PRINCIPAL:?/);
    if (act) {
      const m = /^(\d{4,5})\s*-\s*(.+)$/.exec(act);
      if (m) { r.ciiu = m[1]; r.actividad = m[2].replace(/\.$/, '').trim(); } else r.actividad = act;
    }
    const sec = valorDe(lineasN, /ACTIVIDAD ECONOMICA SECUNDARIA 1:?/);
    if (sec && /\d{4}\s*-/.test(sec)) r.actividadSecundaria = sec;
    return r;
  }

  /** Posición Histórica: una fila por fecha de proceso (24 meses). Se lee de derecha a izquierda. */
  function posicionHistorica(lineasN) {
    const filas = [];
    const ini = indice(lineasN, /^POSICION HISTORICA/);
    if (ini < 0) return filas;
    for (let i = ini + 1; i < lineasN.length; i++) {
      const l = lineasN[i].trim();
      if (/^(GRAFICOS|DOCUMENTOS PROTESTADOS|COMERCIO EXTERIOR)/.test(l)) break;
      const m = /^(\d{2})\/(\d{2})\/(\d{4})\s+(.+)$/.exec(l);
      if (!m) continue;
      const tok = m[4].split(/\s+/);
      const peor = tok.find(t => /^(NOR|CPP|DEF|DUD|PER|SCAL)$/.test(t)) || null;
      const nums = tok.filter(t => /^-?[\d,]*\d(\.\d+)?$/.test(t));
      if (nums.length < 10) continue;
      // Al final: 3 conteos enteros + 5 montos (vencida, protestos, impagos, tributaria, laboral)
      const n = nums.length;
      const conteos = nums.slice(n - 3).map(x => parseInt(x, 10));
      const [vencida, protestos, impagos, tributaria, laboral] = nums.slice(n - 8, n - 3).map(monto);
      const cab = nums.slice(0, n - 8); // semáforo, # entidades, deuda total, % normal (puede faltar)
      const semIdx = cab.findIndex(x => /^\d+\.\d{3}$/.test(x));
      const semaforoValor = semIdx >= 0 ? parseFloat(cab[semIdx]) : null;
      const resto = cab.slice(semIdx + 1);
      const entidades = resto.length && /^\d+$/.test(resto[0]) ? parseInt(resto[0], 10) : null;
      const deuda = resto.length > 1 ? monto(resto[1]) : null;
      const pctNormal = resto.length > 2 ? monto(resto[2]) : null;
      const sinDeuda = (entidades === 0 || entidades === null) && !deuda;
      const califMes = sinDeuda ? null : (peor ? CALIF[peor] : (pctNormal === 100 ? 'NORMAL' : null));
      filas.push({
        fecha: iso(m[1], m[2], m[3]), periodo: `${m[3]}-${m[2]}`, etiqueta: `${MES_TXT[+m[2]]} ${m[3]}`,
        semaforoValor, semaforoSentinel: colorSemaforo(semaforoValor, sinDeuda),
        semaforo: semaforoDeCalificacion(califMes, sinDeuda),
        entidades, deuda, pctNormal,
        calificacion: califMes,
        deudaVencida: vencida, protestos, docsImpagos: impagos, deudaTributaria: tributaria, deudaLaboral: laboral,
        ctasCerradas: conteos[0], otrosCreditos: conteos[1], reportesNegativos: conteos[2]
      });
    }
    return filas.sort((a, b) => b.fecha.localeCompare(a.fecha)); // más reciente primero
  }

  /** Un punto por mes (la fecha de proceso más reciente de cada mes), en orden cronológico. */
  function historialMensual(filas) {
    const porMes = new Map();
    for (const f of filas) if (!porMes.has(f.periodo)) porMes.set(f.periodo, f);
    return [...porMes.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)).map(f => ({
      periodo: f.periodo, etiqueta: f.etiqueta, fecha: f.fecha, deuda: f.deuda, semaforo: f.semaforo,
      semaforoValor: f.semaforoValor, semaforoSentinel: f.semaforoSentinel, entidades: f.entidades, calificacion: f.calificacion, pctNormal: f.pctNormal,
      deudaVencida: f.deudaVencida, docsImpagos: f.docsImpagos
    }));
  }

  function protestosYDam(lineasN, textoN) {
    let protestos = null;
    const i = indice(lineasN, /DOCUMENTOS PROTESTADOS SIN REGULARIZAR/);
    if (i >= 0) for (let j = i; j < i + 6 && j < lineasN.length; j++) {
      const m = /TOTAL:\s*([\d,]+\.\d{2})/.exec(lineasN[j]);
      if (m) { protestos = monto(m[1]); break; }
    }
    let dam = false;
    const d = indice(lineasN, /DEUDORES ALIMENTARIOS MOROSOS/);
    if (d >= 0) for (let j = d + 2; j < d + 8 && j < lineasN.length; j++) {
      if (/POSICION HISTORICA|GRAFICOS|USUARIO:/.test(lineasN[j])) break;
      if (RE_MONTO_G.test(lineasN[j])) { dam = true; break; }
      RE_MONTO_G.lastIndex = 0;
    }
    return { protestosSinRegularizar: protestos, deudorAlimentario: dam };
  }

  function datosGenerales(lineasN) {
    const r = { genero: null, fechaNacimiento: null };
    const i = indice(lineasN, /FECHA (DE )?NACIMIENTO/);
    if (i < 0) return r;
    for (let j = i; j < Math.min(lineasN.length, i + 3); j++) {
      const g = /\b(MASCULINO|FEMENINO)\b/.exec(lineasN[j]);
      if (g && !r.genero) r.genero = g[1];
      const f = j > i && RE_FECHA.exec(lineasN[j]);
      if (f && !r.fechaNacimiento) r.fechaNacimiento = iso(f[1], f[2], f[3]);
    }
    return r;
  }

  function fechaActualizada(textoN) {
    const m = /INFORMACION ACTUALIZADA AL:\s*(\d{1,2}) DE ([A-Z]+) DEL? (\d{4})/.exec(textoN);
    if (m && MESES_LARGOS[m[2]]) return `${m[3]}-${String(MESES_LARGOS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return null;
  }

  // ---------- principal ----------
  function analizar(lineas) {
    ORIG = lineas.map(l => String(l || ''));
    const lineasN = lineas.map(norm);
    const textoN = lineasN.join('\n');
    const cab = cabecera(lineasN);
    const cr = consultaRapida(lineasN);
    const su = sunat(lineasN);
    const det = detalleDeuda(lineasN);
    const filas = posicionHistorica(lineasN);
    const ultima = filas[0] || null;
    const pd = protestosYDam(lineasN, textoN);
    const dg = datosGenerales(lineasN);
    const fCreacion = /FECHA Y HORA DE CREACION:\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(textoN);

    const dniRow = cr.DNI || null;
    const rucRow = cr.RUC || null;
    const semValor = dniRow ? dniRow.semaforoValor : (ultima ? ultima.semaforoValor : null);
    const sinDeuda = dniRow ? !dniRow.deudaTotal : false;
    const califActual = ultima ? (ultima.pctNormal === 100 ? 'NORMAL' : (ultima.calificacion || null)) : null;

    let maxDeuda = null;
    for (const f of filas) if (f.deuda !== null && (!maxDeuda || f.deuda > maxDeuda.monto)) maxDeuda = { monto: f.deuda, fecha: f.fecha, etiqueta: f.etiqueta, entidades: f.entidades };
    const maxEntidades = filas.reduce((mx, f) => Math.max(mx, f.entidades || 0), 0) || null;

    const entidadesDNI = det.entidades.filter(e => e.documento === 'DNI');
    const vigentes = det.entidades.filter(e => e.vigente);
    const peorActual = vigentes.map(e => e.calificacion).filter(c => ORDEN_CALIF.includes(c))
      .sort((a, b) => ORDEN_CALIF.indexOf(b) - ORDEN_CALIF.indexOf(a))[0] || null;

    const cliente = {
      fuente: 'Sentinel · Reporte de Crédito (Experian)',
      formato: 'EXPERIAN',
      nombre: cab.nombre || su.razonSocial,
      dni: cab.dni,
      genero: dg.genero,
      fechaNacimiento: dg.fechaNacimiento,
      ruc: rucRow ? rucRow.numero : (/\b(10\d{9}|20\d{9})\b/.exec(textoN) || [])[1] || null,
      fechaReporte: fechaActualizada(textoN) || (dniRow && dniRow.fechaProceso) || null,
      fechaCreacion: fCreacion ? iso(fCreacion[1], fCreacion[2], fCreacion[3]) : null,
      score: cab.score,
      scoreTexto: cab.scoreTexto,
      semaforoValor: semValor,
      semaforoSentinel: colorSemaforo(semValor, sinDeuda),
      semaforo: null, // se completa abajo con la calificación SBS
      numEntidades: ultima ? ultima.entidades : (vigentes.length || null),
      numEntidadesEstimado: !ultima,
      maxEntidades,
      deudaTotal: dniRow ? dniRow.deudaTotal : (ultima ? ultima.deuda : null),
      deudaSBS: ultima ? ultima.deuda : null,
      deudaRuc: rucRow ? rucRow.deudaTotal : null,
      semaforoRucValor: rucRow ? rucRow.semaforoValor : null,
      deudaVencida: ultima ? ultima.deudaVencida : null,
      docsImpagos: ultima ? ultima.docsImpagos : null,
      deudaTributaria: ultima ? ultima.deudaTributaria : null,
      deudaLaboral: ultima ? ultima.deudaLaboral : null,
      deudaCastigada: null,
      deudaJudicial: null,
      protestos: ultima ? ultima.protestos : pd.protestosSinRegularizar,
      reportesNegativos: ultima ? ultima.reportesNegativos : null,
      deudorAlimentario: pd.deudorAlimentario,
      porcentajeNormal: ultima ? ultima.pctNormal : null,
      calificacion: califActual || peorActual,
      endeudamientoMaximo: maxDeuda,
      ingresoEstimado: ingresoEstimado(lineasN),
      indicadores: indicadores(lineasN),
      tipoContribuyente: su.tipoContribuyente,
      estadoRuc: su.estadoRuc,
      condicionRuc: su.condicionRuc,
      actividad: su.actividad,
      ciiu: su.ciiu,
      actividadSecundaria: su.actividadSecundaria,
      nombreComercial: su.nombreComercial,
      tamanoContribuyente: su.tamano,
      inicioActividades: su.inicioActividades,
      periodoDetalle: det.periodoActual,
      detalleEntidades: entidadesDNI.length ? det.entidades : det.entidades,
      lineasCredito: lineasCredito(lineasN),
      vencidos: detalleVencidos(lineasN),
      posicionHistorica: filas,
      historial: historialMensual(filas),
      menciones: { castigo: false, judicial: /COBRANZA JUDICIAL\s+[\d]/.test(textoN), protestos: (pd.protestosSinRegularizar || 0) > 0, morosidad: false },
      camposHallados: {
        nombre: !!cab.nombre, fechaReporte: !!fechaActualizada(textoN), score: cab.score !== null, semaforo: semValor !== null,
        numEntidades: !!ultima, deudaTotal: !!dniRow, deudaVencida: !!ultima, calificacion: !!ultima,
        tipoContribuyente: !!su.tipoContribuyente, estadoRuc: !!su.estadoRuc, condicionRuc: !!su.condicionRuc,
        actividad: !!su.actividad, inicioActividades: !!su.inicioActividades
      }
    };
    cliente.semaforo = semaforoDeCalificacion(cliente.calificacion, sinDeuda && !cliente.calificacion);
    return cliente;
  }

  return { esExperian, analizar, colorSemaforo, semaforoDeCalificacion, SEMAFORO_CALIF, norm };
});
