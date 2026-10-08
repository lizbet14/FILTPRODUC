/* FILTPRODUC · panel central del cliente */
(function () {
  'use strict';
  const CLAVE = 'filtproduc:reporte';
  const panel = document.getElementById('panel');

  // ---------- formato ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const soles = n => n === null || n === undefined ? '—' : 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const solesCorto = n => n >= 1000000 ? 'S/ ' + (n / 1e6).toLocaleString('es-PE', { maximumFractionDigits: 1 }) + 'M' : n >= 1000 ? 'S/ ' + (n / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 }) + 'k' : 'S/ ' + Math.round(n);
  const fecha = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const v = x => (x === null || x === undefined || x === '') ? '—' : esc(x);
  const pct = x => x === null || x === undefined ? '—' : (x > 0 ? '+' : '') + (x * 100).toFixed(0) + '%';
  const antig = m => m === null || m === undefined ? '—' : (m >= 12 ? `${Math.floor(m / 12)} año(s)${m % 12 ? ' y ' + (m % 12) + ' mes(es)' : ''}` : `${m} mes(es)`);
  const capital = s => s ? s.charAt(0) + s.slice(1).toLowerCase() : '';
  const CALIF_TXT = { NORMAL: 'Normal', CPP: 'CPP', DEFICIENTE: 'Deficiente', DUDOSO: 'Dudoso', PERDIDA: 'Pérdida', 'SIN CALIFICACION': 'Sin calif.' };
  // Semáforo por calificación SBS
  const SEM_TXT = { VERDE: 'NOR · Normal', AMARILLO: 'CPP · Con problemas potenciales', NARANJA: 'DUD · Dudoso', ROJO: 'DEF · Deficiente', NEGRO: 'PER · Pérdida', GRIS: 'Sin calificación (no registra deudas)' };
  const SEM_COLOR = { VERDE: 'var(--verde)', AMARILLO: 'var(--ambar)', NARANJA: 'var(--naranja)', ROJO: 'var(--rojo)', NEGRO: 'var(--negro)', GRIS: 'var(--gris)' };
  const SENTINEL_TXT = { VERDE: 'sin deudas vencidas', AMARILLO: 'deudas con poco atraso', ROJO: 'deudas con atraso significativo', GRIS: 'no registra información' };
  const NOMBRE_ENTIDAD = { MIBCO: 'MIBANCO' };
  const ESTADO_ENT = { CON_DEUDA: ['Con deuda', 'e-CALIFICA'], SIN_SALDO: ['Sin saldo', 'e-REVISAR'], YA_NO_REPORTA: ['Ya no reporta', 'e-INFO'] };
  const NOMBRES_CAMPOS = {
    nombre: 'Nombre', fechaReporte: 'Fecha del reporte', score: 'Score', semaforo: 'Semáforo', numEntidades: 'N° de entidades',
    deudaTotal: 'Deuda total', deudaVencida: 'Deuda vencida', calificacion: 'Calificación SBS', tipoContribuyente: 'Tipo de contribuyente',
    estadoRuc: 'Estado RUC', condicionRuc: 'Condición RUC', actividad: 'Actividad económica', inicioActividades: 'Inicio de actividades'
  };

  const ICONOS = {
    NEGOCIO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9"/><path d="M4 9v11h16V9"/><path d="M3 9h18"/><path d="M9 20v-6h6v6"/></svg>',
    EMPRESA: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/></svg>',
    SERVICIOS: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
    SIN_RUC: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    INDETERMINADO: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/></svg>'
  };

  // ---------- gráfico de historial ----------
  function grafico(historial, maximo) {
    const datos = historial.filter(h => h.deuda !== null && h.deuda !== undefined);
    if (datos.length < 2) return '<div class="vacio">El reporte no trae suficiente historial mensual para graficar.</div>';
    const W = 720, H = 260, mL = 58, mR = 8, mT = 24, mB = 46;
    const max = Math.max(...datos.map(d => d.deuda)) || 1;
    const paso = Math.pow(10, Math.floor(Math.log10(max)));
    const tope = Math.ceil(max / paso) * paso;
    const ancho = (W - mL - mR) / historial.length;
    const y = val => mT + (H - mT - mB) * (1 - val / tope);
    const conEntidades = historial.some(h => h.entidades !== null && h.entidades !== undefined);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deuda SBS por mes">`;
    for (let i = 0; i <= 4; i++) {
      const val = tope * i / 4, yy = y(val);
      s += `<line x1="${mL}" x2="${W - mR}" y1="${yy}" y2="${yy}" stroke="var(--linea)" stroke-width="1"/>`;
      s += `<text x="${mL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--tinta-3)">${solesCorto(val)}</text>`;
    }
    let maxMarcado = false;
    historial.forEach((h, i) => {
      const cx = mL + i * ancho + ancho / 2;
      const bw = Math.min(30, ancho * 0.66);
      if (h.deuda !== null && h.deuda !== undefined) {
        const yy = y(h.deuda);
        const esUlt = i === historial.length - 1;
        const esMax = !maxMarcado && h.deuda === max;
        if (esMax) maxMarcado = true;
        s += `<rect x="${cx - bw / 2}" y="${yy}" width="${bw}" height="${Math.max(1, H - mB - yy)}" rx="3" fill="${esMax ? 'var(--acento)' : 'var(--marca)'}" opacity="${esUlt || esMax ? 1 : 0.45}"><title>${esc(h.etiqueta)}: ${soles(h.deuda)}${h.entidades !== null && h.entidades !== undefined ? ' · ' + h.entidades + ' entidad(es)' : ''}${h.calificacion ? ' · ' + h.calificacion : ''}</title></rect>`;
        if (conEntidades && h.entidades !== null && h.entidades !== undefined) s += `<text x="${cx}" y="${yy - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--tinta-2)">${h.entidades}</text>`;
      }
      const color = SEM_COLOR[h.semaforo] || 'var(--linea)';
      s += `<circle cx="${cx}" cy="${H - mB + 11}" r="4.5" fill="${color}"${h.semaforo === 'NEGRO' ? ' stroke="var(--tinta-3)" stroke-width="1"' : ''}><title>${esc(h.etiqueta)}: ${h.semaforo ? SEM_TXT[h.semaforo] : 'sin dato'}</title></circle>`;
      const [mes, anio] = h.etiqueta.split(' ');
      s += `<text x="${cx}" y="${H - mB + 29}" text-anchor="middle" font-size="10" fill="var(--tinta-2)">${esc(mes)}</text>`;
      if (i === 0 || mes === 'Ene') s += `<text x="${cx}" y="${H - mB + 42}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--tinta-3)">${esc(anio)}</text>`;
    });
    return s + '</svg>';
  }

  function tablaPosicion(filas) {
    if (!filas || !filas.length) return '';
    return `<details class="tecnico sub-detalle"><summary>Ver posición histórica completa (${filas.length} registros)</summary>
      <div class="tabla-scroll"><table class="compacta">
        <thead><tr><th>Fecha</th><th>Sem.</th><th class="der">Entid.</th><th class="der">Deuda SBS</th><th class="der">% Normal</th><th class="der">Vencida</th><th class="der">Doc. impagos</th></tr></thead>
        <tbody>${filas.map(f => `<tr>
          <td class="num">${fecha(f.fecha)}</td>
          <td><span class="luz ${f.semaforo}" title="${f.semaforo ? SEM_TXT[f.semaforo] : 'sin dato'}"></span></td>
          <td class="der num">${v(f.entidades)}</td><td class="der num">${soles(f.deuda)}</td>
          <td class="der num">${f.pctNormal === null ? (f.calificacion ? CALIF_TXT[f.calificacion] || f.calificacion : '—') : f.pctNormal.toFixed(0) + '%'}</td>
          <td class="der num">${f.deudaVencida ? soles(f.deudaVencida) : '—'}</td>
          <td class="der num">${f.docsImpagos ? soles(f.docsImpagos) : '—'}</td></tr>`).join('')}</tbody>
      </table></div></details>`;
  }

  function tablaEntidades(c) {
    const ents = c.detalleEntidades || [];
    if (!ents.length) return '<div class="vacio">No se identificó el detalle por entidad en el reporte.</div>';
    const maxEnt = Math.max(1, ...ents.map(e => Math.max(e.deuda || 0, e.maxAnterior || 0)));
    const conDocs = new Set(ents.map(e => e.documento)).size > 1;
    return `<div class="tabla-scroll"><table>
      <thead><tr><th>Entidad</th><th>Calif.</th><th class="der">Deuda actual</th><th class="der col-opc">Máx. últ. 6m</th><th class="centro">Estado</th></tr></thead>
      <tbody>${ents.map(e => {
        const [txt, cls] = ESTADO_ENT[e.estado] || ['—', ''];
        return `<tr>
          <td><b>${esc(NOMBRE_ENTIDAD[e.entidad] || e.entidad)}</b>${conDocs ? ` <small class="doc-tag">${e.documento}</small>` : ''}
            ${e.deuda > 0 ? `<div class="barra-mini" style="width:${Math.max(3, e.deuda / maxEnt * 100)}%"></div>` : ''}
            ${e.diasVencido ? `<small class="atraso">${e.diasVencido} días de atraso</small>` : ''}</td>
          <td>${e.calificacion ? `<span class="calif-badge ${e.calificacion}">${CALIF_TXT[e.calificacion] || e.calificacion}</span>` : '—'}</td>
          <td class="der num">${e.vigente === false ? '—' : soles(e.deuda)}</td>
          <td class="der num tinta-3 col-opc">${e.maxAnterior ? soles(e.maxAnterior) : '—'}</td>
          <td class="centro"><span class="estado ${cls}">${txt}</span></td></tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function tablaLineas(c) {
    const ls = c.lineasCredito || [];
    if (!ls.length) return '';
    return `<h3 class="subtitulo">Líneas de crédito</h3>
      <table class="compacta"><thead><tr><th>Institución</th><th>Tipo</th><th class="der">Aprobada</th><th class="der">Utilizada</th><th class="der">Disponible</th></tr></thead>
      <tbody>${ls.map(l => `<tr><td>${esc(l.institucion)}</td><td>${esc(l.tipo === 'TCO' ? 'Tarjeta consumo' : l.tipo)}</td>
        <td class="der num">${soles(l.aprobada)}</td><td class="der num">${soles(l.utilizada)}</td><td class="der num">${soles(l.noUtilizada)}</td></tr>`).join('')}</tbody></table>`;
  }

  // ---------- productos y campañas ----------
  const ESTADO_TXT = { CALIFICA: 'Califica', REVISAR: 'Falta un dato', NO_CALIFICA: 'No califica' };
  const TIPOS_CLIENTE = [['NUEVO', 'Nuevo'], ['REACTIVADO', 'Reactivado'], ['RECURRENTE', 'Recurrente']];
  const VIVIENDAS = [['PROPIA', 'Propia'], ['FAMILIAR', 'Familiar'], ['ALQUILADA', 'Alquilada']];
  const pctTxt = n => Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

  function tarjetaProducto(ev) {
    const p = ev.producto;
    const fallan = ev.detalle.filter(q => q.cumple === false);
    const faltan = ev.detalle.filter(q => q.cumple === null);
    const ok = ev.detalle.filter(q => q.cumple === true);
    const li = (q, cls) => `<li class="${cls}">${esc(q.texto)}</li>`;
    return `<article class="prod prod-${ev.estado}">
      <div class="prod-cab">
        <div><span class="seg">${esc(p.segmento)} · ${esc(p.tipo)}</span><h3>${esc(p.nombre)}</h3></div>
        <span class="estado e-${ev.estado}">${ESTADO_TXT[ev.estado]}</span>
      </div>
      ${ev.nota && ev.estado !== 'NO_CALIFICA' ? `<p class="nota-prod">${esc(ev.nota)}</p>` : ''}
      ${ev.estado !== 'NO_CALIFICA' && ev.tramo ? `<div class="oferta">
          <div><small>Monto</small><b class="num">S/ ${ev.tramo.montoMin.toLocaleString('es-PE')} – ${ev.tramo.montoMax.toLocaleString('es-PE')}</b></div>
          <div><small>TEA mínima</small><b class="num">${pctTxt(ev.tramo.teaMin)}</b></div>
        </div>` : ''}
      ${fallan.length ? `<ul class="requisitos">${fallan.map(q => li(q, 'no')).join('')}</ul>` : ''}
      ${faltan.length ? `<ul class="requisitos">${faltan.map(q => li(q, 'falta')).join('')}</ul>` : ''}
      ${ev.estado !== 'NO_CALIFICA' ? `
        <details class="prod-mas"><summary>${ok.length} requisito(s) cumplidos · ${ev.verificar.length} por verificar</summary>
          <ul class="requisitos">${ok.map(q => li(q, 'ok')).join('')}</ul>
          ${ev.verificar.length ? `<p class="verif-tit">Verificar en la evaluación:</p><ul class="requisitos">${ev.verificar.map(t => `<li class="verif">${esc(t)}</li>`).join('')}</ul>` : ''}
          ${(p.condiciones || []).length ? `<p class="verif-tit">Condiciones:</p><ul class="requisitos">${p.condiciones.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          ${p.vigencia ? `<p class="vig">Vigente del ${fecha(p.vigencia.desde)} al ${fecha(p.vigencia.hasta)}</p>` : ''}
        </details>` : ''}
    </article>`;
  }

  function seccionProductos(c, a, reg) {
    const sug = Productos.sugerirTipoCliente(c);
    const tipo = reg.tipoCliente || sug.tipo;
    const vivienda = reg.vivienda || null;
    const evals = Productos.evaluar(c, a, { tipoCliente: tipo, vivienda });
    const califica = evals.filter(e => e.estado === 'CALIFICA');
    const revisar = evals.filter(e => e.estado === 'REVISAR');
    const no = evals.filter(e => e.estado === 'NO_CALIFICA');
    return `<section class="tarjeta productos">
      <div class="prod-top">
        <div>
          <h2>Productos y campañas a los que accede</h2>
          <p class="resumen-prod"><b class="num">${califica.length}</b> de ${evals.length} califican${revisar.length ? ` · <b class="num">${revisar.length}</b> con datos por revisar` : ''} · Región ${esc(Campanas.CONFIG.region)} (agencia ${esc(Campanas.CONFIG.agencia)})</p>
        </div>
        <div class="filtros-cliente">
          <div class="tipo-cliente">
            <span class="etq-tipo">Tipo de cliente en Caja Piura</span>
            <div class="segmentado" role="group" aria-label="Tipo de cliente">
              ${TIPOS_CLIENTE.map(([k, t]) => `<button type="button" data-tipo="${k}" class="${k === tipo ? 'activo' : ''}">${t}</button>`).join('')}
            </div>
            <small>${reg.tipoCliente && reg.tipoCliente !== sug.tipo ? `Elegido por ti (sugerido: ${capital(sug.tipo)})` : 'Sugerido: ' + esc(sug.motivo)}</small>
          </div>
          <div class="tipo-cliente">
            <span class="etq-tipo">Vivienda del cliente</span>
            <div class="segmentado" role="group" aria-label="Vivienda del cliente">
              ${VIVIENDAS.map(([k, t]) => `<button type="button" data-vivienda="${k}" class="${k === vivienda ? 'activo' : ''}">${t}</button>`).join('')}
            </div>
            <small class="${vivienda ? '' : 'pendiente'}">${vivienda ? (vivienda === 'ALQUILADA' ? 'Varias campañas exigen casa propia o familiar.' : 'Cumple domicilio estable.') : 'Elígela: algunas campañas no aceptan vivienda alquilada.'}</small>
          </div>
        </div>
      </div>
      ${califica.length || revisar.length ? `<div class="prod-grid">${[...califica, ...revisar].map(tarjetaProducto).join('')}</div>`
        : '<div class="vacio">Con los datos del reporte no califica a ninguna campaña vigente.</div>'}
      ${no.length ? `<details class="prod-no"><summary>No califica (${no.length}) · ver motivos</summary><div class="prod-grid">${no.map(tarjetaProducto).join('')}</div></details>` : ''}
    </section>`;
  }

  // ---------- render ----------
  function render(reg) {
    const c = reg.cliente;
    const a = Analisis.analizarCliente(c);
    const r = a.ruc, d = a.deuda;
    const faltan = Object.keys(NOMBRES_CAMPOS).filter(k => c.camposHallados && c.camposHallados[k] === false && (c[k] === null || c[k] === undefined));
    const otrasDeudas = c.deudaSBS !== null && c.deudaSBS !== undefined && c.deudaTotal > c.deudaSBS ? +(c.deudaTotal - c.deudaSBS).toFixed(2) : 0;

    panel.innerHTML = `
      <section class="cabecera-cliente">
        <div>
          <h1>${v(c.nombre) === '—' ? 'Cliente sin nombre' : v(c.nombre)}</h1>
          <div class="ids">
            <span>DNI <b class="num">${v(c.dni)}</b></span>
            <span>RUC <b class="num">${v(c.ruc)}</b></span>
            ${c.nombreComercial ? `<span>Negocio <b>${esc(c.nombreComercial)}</b></span>` : ''}
          </div>
        </div>
        <div class="fuente">${esc(c.fuente || 'Sentinel')}<br>Información al <b>${fecha(c.fechaReporte)}</b>${c.fechaCreacion ? ` · consultado el ${fecha(c.fechaCreacion)}` : ''}${reg.editado ? '<br><b>Corregido manualmente</b>' : ''}</div>
      </section>

      <section class="kpis">
        <div class="kpi destacado"><div class="etq">Score Experian</div><div class="valor num">${v(c.score)}</div><div class="sub">${esc(c.scoreTexto || 'Sentinel')}</div></div>
        <div class="kpi"><div class="etq">Semáforo · Calificación SBS</div><div class="valor"><span class="semaforo"><span class="luz ${c.semaforo}"></span>${c.semaforo ? capital(c.semaforo) : '—'}</span></div>
          <div class="sub">${SEM_TXT[c.semaforo] || 'Sin dato de calificación'}${c.porcentajeNormal !== null && c.porcentajeNormal !== undefined && c.porcentajeNormal < 100 ? ` · ${c.porcentajeNormal}% en Normal` : ''}${d.peorCalificacion && d.peorCalificacion !== c.calificacion ? ` · peor en el periodo: ${CALIF_TXT[d.peorCalificacion]}` : ''}</div>
          ${c.semaforoSentinel ? `<div class="sub sub-sentinel">Riesgo Sentinel: ${SENTINEL_TXT[c.semaforoSentinel] || c.semaforoSentinel.toLowerCase()}${c.semaforoValor !== null && c.semaforoValor !== undefined ? ` (${Number(c.semaforoValor).toFixed(3)})` : ''}</div>` : ''}</div>
        <div class="kpi"><div class="etq">Entidades que lo reportan</div><div class="valor num">${v(c.numEntidades)}</div>
          <div class="sub">${c.numEntidadesEstimado ? '<span class="estimado">ESTIMADO DEL DETALLE</span>' : d.entidadesMax ? `Máximo en 24 meses: <b>${d.entidadesMax}</b>` : 'a la fecha'}</div></div>
        <div class="kpi"><div class="etq">Deuda total actual</div><div class="valor num">${soles(c.deudaTotal)}</div>
          <div class="sub">${otrasDeudas ? `SBS ${soles(c.deudaSBS)} + otros ${soles(otrasDeudas)}` : `Vencida: ${soles(c.deudaVencida)}`}</div></div>
        <div class="kpi"><div class="etq">Endeudamiento máximo</div><div class="valor num">${soles(d.maximo)}</div>
          <div class="sub">${d.fechaMaximo ? `${esc(d.fechaMaximo)}` : ''}${d.desdeMaximo !== null && d.desdeMaximo < -0.01 ? ` · hoy ${(Math.abs(d.desdeMaximo) * 100).toFixed(0)}% menos` : d.desdeMaximo !== null && Math.abs(d.desdeMaximo) <= 0.01 ? ' · es su deuda actual' : ''}${d.meses ? ` · últimos ${d.meses} meses` : ''}</div></div>
        <div class="kpi"><div class="etq">Ingreso estimado</div><div class="valor num">${c.ingresoEstimado ? esc(c.ingresoEstimado.texto) : '—'}</div>
          <div class="sub">${c.ingresoEstimado ? 'Rango mensual según Sentinel' : 'El reporte no lo indica'}</div></div>
      </section>

      ${seccionProductos(c, a, reg)}

      <div class="rejilla">
        <div class="columna">
          <section class="tarjeta">
            <h2>Historial de endeudamiento <span class="tendencia t-${d.tendencia}">${esc(d.tendenciaTexto)}</span></h2>
            <div class="grafico">${grafico(c.historial || [], d.maximo)}</div>
            <div class="leyenda">
              <span><span class="luz VERDE"></span>NOR</span><span><span class="luz AMARILLO"></span>CPP</span>
              <span><span class="luz NARANJA"></span>DUD</span><span><span class="luz ROJO"></span>DEF</span>
              <span><span class="luz NEGRO"></span>PER</span><span><span class="luz GRIS"></span>Sin calificación</span>
              <span><span class="cuadro-max"></span>Endeudamiento máximo</span>
              ${(c.historial || []).some(h => h.entidades !== null && h.entidades !== undefined) ? '<span><b>N°</b>&nbsp;sobre la barra = entidades</span>' : ''}
            </div>
            <div class="metricas">
              <div class="metrica"><div class="etq">Variación 12 meses</div><div class="v num">${pct(d.variacion)}</div></div>
              <div class="metrica"><div class="etq">Deuda promedio</div><div class="v num">${soles(d.promedio)}</div></div>
              <div class="metrica"><div class="etq">Meses no verdes</div><div class="v num">${d.mesesSemaforoNoVerde} <small>de ${d.meses}</small></div></div>
              <div class="metrica"><div class="etq">Entidades hoy / máx.</div><div class="v num">${v(d.entidadesActual)} / ${v(d.entidadesMax)}</div></div>
            </div>
            ${d.eventos.length ? `<ul class="eventos">${d.eventos.slice(-5).reverse().map(e => `<li class="ev-${e.tipo}">${esc(e.texto)}</li>`).join('')}</ul>` : ''}
            ${tablaPosicion(c.posicionHistorica)}
          </section>

          <section class="tarjeta">
            <h2>Detalle por entidad <small>${c.periodoDetalle ? 'Deuda a ' + esc(capital(c.periodoDetalle.split(' ')[0])) + ' ' + esc(c.periodoDetalle.split(' ')[1]) : (c.detalleEntidades || []).length + ' encontradas'}</small></h2>
            ${tablaEntidades(c)}
            ${tablaLineas(c)}
          </section>
        </div>

        <div class="columna">
          <section class="tarjeta p-${r.perfil}">
            <h2>Perfil del RUC</h2>
            <div class="perfil"><div class="perfil-icono">${ICONOS[r.perfil] || ''}</div><div><b>${esc(r.perfilTexto)}</b><span>${esc(r.tipoPersona || 'Sin RUC registrado')}</span></div></div>
            <dl class="datos">
              <dt>Tipo contribuyente</dt><dd>${v(c.tipoContribuyente)}</dd>
              ${c.nombreComercial ? `<dt>Nombre comercial</dt><dd>${esc(c.nombreComercial)}</dd>` : ''}
              <dt>Estado / condición</dt><dd>${v(c.estadoRuc)} / ${v(c.condicionRuc)}</dd>
              <dt>Actividad</dt><dd>${c.ciiu ? `<span class="ciiu">${esc(c.ciiu)}</span> ` : ''}${v(c.actividad)}</dd>
              <dt>Inicio actividades</dt><dd>${fecha(c.inicioActividades)}</dd>
              <dt>Antigüedad del RUC</dt><dd>${antig(r.antiguedadMeses)}</dd>
            </dl>
            <div class="nota">${esc(r.motivo)}</div>
          </section>

          ${c.ingresoEstimado || (c.indicadores || []).length ? `
          <section class="tarjeta">
            <h2>Otros datos del reporte</h2>
            <dl class="datos">
              ${c.ingresoEstimado ? `<dt>Ingreso estimado</dt><dd>${esc(c.ingresoEstimado.texto)}</dd>` : ''}
              ${c.deudaRuc !== null && c.deudaRuc !== undefined ? `<dt>Deuda con el RUC</dt><dd>${soles(c.deudaRuc)}</dd>` : ''}
              ${c.docsImpagos ? `<dt>Documentos impagos</dt><dd>${soles(c.docsImpagos)}</dd>` : ''}
            </dl>
            ${(c.indicadores || []).length ? `<div class="chips" style="margin-top:12px">${c.indicadores.map(i => `<span class="chip">${esc(capital(i))}</span>`).join('')}</div>` : ''}
          </section>` : ''}

          <section class="tarjeta">
            <h2>Alertas para el asesor</h2>
            ${a.alertas.length ? a.alertas.map(x => `<div class="alerta a-${x.nivel}"><span class="marca-a"></span><span>${esc(x.texto)}</span></div>`).join('')
              : '<div class="alerta sin-alertas"><span>Sin alertas en el reporte.</span></div>'}
          </section>

        </div>
      </div>

      <details class="tecnico">
        <summary>Ver texto extraído del PDF (para revisar la lectura)</summary>
        ${faltan.length ? `<p style="font-size:13px;margin:10px 0 0">Datos que el lector no encontró:</p><div class="faltantes">${faltan.map(k => `<span>${NOMBRES_CAMPOS[k]}</span>`).join('')}</div>` : ''}
        <pre class="texto-pdf">${esc(reg.texto || '')}</pre>
      </details>`;
    panel.querySelectorAll('.segmentado button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.tipo) reg.tipoCliente = b.dataset.tipo;
      if (b.dataset.vivienda) reg.vivienda = reg.vivienda === b.dataset.vivienda ? null : b.dataset.vivienda;
      try { sessionStorage.setItem(CLAVE, JSON.stringify(reg)); } catch (e) { /* sin almacenamiento */ }
      render(reg);
      const sec = panel.querySelector('.productos');
      if (sec) sec.scrollIntoView({ block: 'nearest' });
    }));
    // En celular el gráfico se desliza: mostrar primero los meses más recientes
    panel.querySelectorAll('.grafico').forEach(g => { g.scrollLeft = g.scrollWidth; });
  }

  // ---------- edición manual ----------
  function configurarEdicion(reg) {
    const dlg = document.getElementById('dlgEditar');
    const form = document.getElementById('formEditar');
    const NUM = ['score', 'numEntidades', 'deudaTotal', 'deudaVencida'];
    document.getElementById('btnEditar').addEventListener('click', () => {
      for (const el of form.elements) {
        if (!el.name) continue;
        const val = reg.cliente[el.name];
        el.value = val === null || val === undefined ? '' : val;
      }
      dlg.showModal();
    });
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'guardar') return;
      for (const el of form.elements) {
        if (!el.name) continue;
        const t = el.value.trim();
        const nuevo = t === '' ? null : (NUM.includes(el.name) ? Number(t) : (el.tagName === 'SELECT' || el.type === 'date' ? t : t.toUpperCase()));
        if (reg.cliente[el.name] !== nuevo) {
          reg.cliente[el.name] = nuevo;
          if (el.name === 'numEntidades') reg.cliente.numEntidadesEstimado = false;
          if (el.name === 'calificacion') reg.cliente.semaforo = ({ NORMAL: 'VERDE', CPP: 'AMARILLO', DUDOSO: 'NARANJA', DEFICIENTE: 'ROJO', PERDIDA: 'NEGRO' })[nuevo] || null;
          reg.editado = true;
        }
      }
      if (reg.cliente.ruc && !reg.cliente.dni && reg.cliente.ruc.startsWith('10')) reg.cliente.dni = reg.cliente.ruc.slice(2, 10);
      sessionStorage.setItem(CLAVE, JSON.stringify(reg));
      render(reg);
    });
  }

  document.getElementById('btnImprimir').addEventListener('click', () => window.print());

  let reg = null;
  try { reg = JSON.parse(sessionStorage.getItem(CLAVE)); } catch (e) { reg = null; }
  if (!reg || !reg.cliente) {
    panel.innerHTML = `<div class="tarjeta vacio" style="margin-top:40px">Todavía no se ha cargado ningún reporte.<br><br><a class="btn btn-primario" href="index.html">Cargar reporte Sentinel</a></div>`;
    document.getElementById('btnEditar').style.display = 'none';
    return;
  }
  render(reg);
  configurarEdicion(reg);
})();
