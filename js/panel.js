/* FILTPRODUC · panel central del cliente */
(function () {
  'use strict';
  const CLAVE = 'filtproduc:reporte';
  const panel = document.getElementById('panel');

  // ---------- formato ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const soles = n => n === null || n === undefined ? '—' : 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const solesCorto = n => n >= 1000 ? 'S/ ' + (n / 1000).toLocaleString('es-PE', { maximumFractionDigits: 1 }) + 'k' : 'S/ ' + Math.round(n);
  const fecha = iso => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const v = x => (x === null || x === undefined || x === '') ? '—' : esc(x);
  const antig = m => m === null || m === undefined ? '—' : (m >= 12 ? `${Math.floor(m / 12)} año(s)${m % 12 ? ' y ' + (m % 12) + ' mes(es)' : ''}` : `${m} mes(es)`);
  const CALIF_TXT = { NORMAL: 'Normal', CPP: 'CPP', DEFICIENTE: 'Deficiente', DUDOSO: 'Dudoso', PERDIDA: 'Pérdida' };
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
  function grafico(historial) {
    const datos = historial.filter(h => h.deuda !== null);
    if (datos.length < 2) return '<div class="vacio">El reporte no trae suficiente historial mensual para graficar.</div>';
    const W = 680, H = 240, mL = 56, mR = 8, mT = 14, mB = 46;
    const max = Math.max(...datos.map(d => d.deuda)) || 1;
    const paso = Math.pow(10, Math.floor(Math.log10(max)));
    const tope = Math.ceil(max / paso) * paso;
    const ancho = (W - mL - mR) / historial.length;
    const y = val => mT + (H - mT - mB) * (1 - val / tope);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deuda total por mes">`;
    for (let i = 0; i <= 4; i++) {
      const val = tope * i / 4, yy = y(val);
      s += `<line x1="${mL}" x2="${W - mR}" y1="${yy}" y2="${yy}" stroke="var(--linea)" stroke-width="1"/>`;
      s += `<text x="${mL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="var(--tinta-3)">${solesCorto(val)}</text>`;
    }
    historial.forEach((h, i) => {
      const x = mL + i * ancho;
      const bw = Math.min(34, ancho * 0.62);
      const cx = x + ancho / 2;
      if (h.deuda !== null) {
        const yy = y(h.deuda);
        s += `<rect x="${cx - bw / 2}" y="${yy}" width="${bw}" height="${H - mB - yy}" rx="4" fill="var(--rojo)" opacity="${i === historial.length - 1 ? 1 : 0.55}"><title>${esc(h.etiqueta)}: ${soles(h.deuda)}${h.calificacion ? ' · ' + h.calificacion : ''}</title></rect>`;
      }
      const color = { VERDE: 'var(--verde)', AMARILLO: 'var(--ambar)', ROJO: 'var(--rojo)', GRIS: 'var(--gris)' }[h.semaforo] || 'var(--linea)';
      s += `<circle cx="${cx}" cy="${H - mB + 12}" r="4.5" fill="${color}"><title>Semáforo: ${h.semaforo || 'sin dato'}</title></circle>`;
      const [mes, anio] = h.etiqueta.split(' ');
      s += `<text x="${cx}" y="${H - mB + 30}" text-anchor="middle" font-size="11" fill="var(--tinta-2)">${esc(mes)}</text>`;
      if (i === 0 || mes === 'Ene') s += `<text x="${cx}" y="${H - mB + 43}" text-anchor="middle" font-size="10" fill="var(--tinta-3)">${esc(anio)}</text>`;
    });
    return s + '</svg>';
  }

  // ---------- render ----------
  function render(reg) {
    const c = reg.cliente;
    const a = Analisis.analizarCliente(c);
    const evals = Productos.evaluar(c, a);
    const r = a.ruc, d = a.deuda;
    const faltan = Object.keys(NOMBRES_CAMPOS).filter(k => c.camposHallados && c.camposHallados[k] === false && (c[k] === null || c[k] === undefined));
    const maxEnt = Math.max(1, ...(c.detalleEntidades || []).map(e => e.deuda || 0));

    panel.innerHTML = `
      <section class="cabecera-cliente">
        <div>
          <h1>${v(c.nombre) === '—' ? 'Cliente sin nombre' : v(c.nombre)}</h1>
          <div class="ids">
            <span>DNI <b class="num">${v(c.dni)}</b></span>
            <span>RUC <b class="num">${v(c.ruc)}</b></span>
          </div>
        </div>
        <div class="fuente">Reporte ${esc(c.fuente || 'Sentinel')} del <b>${fecha(c.fechaReporte)}</b><br>${esc(reg.archivo || '')}${reg.editado ? ' · <b>corregido manualmente</b>' : ''}</div>
      </section>

      <section class="kpis">
        <div class="kpi destacado"><div class="etq">Score</div><div class="valor num">${v(c.score)}</div><div class="sub">Sentinel</div></div>
        <div class="kpi"><div class="etq">Semáforo actual</div><div class="valor"><span class="semaforo"><span class="luz ${c.semaforo}"></span>${c.semaforo ? c.semaforo.charAt(0) + c.semaforo.slice(1).toLowerCase() : '—'}</span></div><div class="sub">${d.mesesSemaforoNoVerde ? d.mesesSemaforoNoVerde + ' mes(es) no verde' : 'Historial en verde'}</div></div>
        <div class="kpi"><div class="etq">Entidades (IFIs)</div><div class="valor num">${v(c.numEntidades)}</div><div class="sub">${c.numEntidadesEstimado ? '<span class="estimado">ESTIMADO DEL DETALLE</span>' : 'que lo reportan a la fecha'}</div></div>
        <div class="kpi"><div class="etq">Deuda total</div><div class="valor num">${soles(c.deudaTotal)}</div><div class="sub">Vencida: ${soles(c.deudaVencida)}</div></div>
        <div class="kpi"><div class="etq">Calificación SBS</div><div class="valor">${c.calificacion ? CALIF_TXT[c.calificacion] : '—'}</div><div class="sub">${d.peorCalificacion && d.peorCalificacion !== c.calificacion ? 'Peor en el periodo: ' + CALIF_TXT[d.peorCalificacion] : 'en el reporte actual'}</div></div>
      </section>

      <div class="rejilla">
        <div class="columna">
          <section class="tarjeta">
            <h2>Historial de endeudamiento <span class="tendencia t-${d.tendencia}">${esc(d.tendenciaTexto)}</span></h2>
            <div class="grafico">${grafico(c.historial || [])}</div>
            <div class="leyenda">
              <span><span class="luz VERDE"></span>Verde</span><span><span class="luz AMARILLO"></span>Amarillo</span>
              <span><span class="luz ROJO"></span>Rojo</span><span><span class="luz GRIS"></span>Sin información</span>
            </div>
            <div class="metricas">
              <div class="metrica"><div class="etq">Variación</div><div class="v num">${d.variacion === null ? '—' : (d.variacion > 0 ? '+' : '') + (d.variacion * 100).toFixed(0) + '%'}</div></div>
              <div class="metrica"><div class="etq">Deuda máxima</div><div class="v num">${soles(d.maximo)}</div></div>
              <div class="metrica"><div class="etq">Promedio</div><div class="v num">${soles(d.promedio)}</div></div>
              <div class="metrica"><div class="etq">Meses leídos</div><div class="v num">${d.meses}</div></div>
            </div>
          </section>

          <section class="tarjeta">
            <h2>Detalle por entidad <small>${(c.detalleEntidades || []).length} encontradas</small></h2>
            ${(c.detalleEntidades || []).length ? `
            <table>
              <thead><tr><th>Entidad</th><th>Calificación</th><th class="der">Deuda</th></tr></thead>
              <tbody>${c.detalleEntidades.map(e => `
                <tr><td>${esc(e.entidad)}<div class="barra-mini" style="width:${Math.max(4, (e.deuda || 0) / maxEnt * 100)}%"></div></td>
                <td>${e.calificacion ? `<span class="calif-badge ${e.calificacion}">${CALIF_TXT[e.calificacion]}</span>` : '—'}</td>
                <td class="der num">${soles(e.deuda)}</td></tr>`).join('')}
              </tbody>
            </table>` : '<div class="vacio">No se identificó el detalle por entidad en el reporte.</div>'}
          </section>
        </div>

        <div class="columna">
          <section class="tarjeta p-${r.perfil}">
            <h2>Perfil del RUC</h2>
            <div class="perfil"><div class="perfil-icono">${ICONOS[r.perfil] || ''}</div><div><b>${esc(r.perfilTexto)}</b><span>${esc(r.tipoPersona || 'Sin RUC registrado')}</span></div></div>
            <dl class="datos">
              <dt>Tipo contribuyente</dt><dd>${v(c.tipoContribuyente)}</dd>
              <dt>Estado / condición</dt><dd>${v(c.estadoRuc)} / ${v(c.condicionRuc)}</dd>
              <dt>Actividad</dt><dd>${v(c.actividad)}</dd>
              <dt>Inicio actividades</dt><dd>${fecha(c.inicioActividades)}</dd>
              <dt>Antigüedad</dt><dd>${antig(r.antiguedadMeses)}</dd>
            </dl>
            <div class="nota">${esc(r.motivo)}</div>
          </section>

          <section class="tarjeta">
            <h2>Alertas para el asesor</h2>
            ${a.alertas.length ? a.alertas.map(x => `<div class="alerta a-${x.nivel}"><span class="marca-a"></span><span>${esc(x.texto)}</span></div>`).join('')
              : '<div class="alerta sin-alertas"><span>Sin alertas en el reporte.</span></div>'}
          </section>

          <section class="tarjeta">
            <h2>Productos y campañas <small>Caja Piura</small></h2>
            ${evals.length ? evals.map(ev => `
              <div class="producto">
                <div class="producto-cab"><b>${esc(ev.producto.nombre)}</b><span class="estado e-${ev.estado}">${{ CALIFICA: 'Califica', REVISAR: 'Revisar', NO_CALIFICA: 'No califica' }[ev.estado]}</span></div>
                ${ev.producto.descripcion ? `<div class="sub" style="font-size:13px;color:var(--tinta-2)">${esc(ev.producto.descripcion)}</div>` : ''}
                <ul class="requisitos">${ev.detalle.map(q => `<li class="${q.cumple === true ? 'ok' : q.cumple === false ? 'no' : 'falta'}">${esc(q.texto)}</li>`).join('')}</ul>
              </div>`).join('')
              : `<div class="vacio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>
                 Aún no se han cargado los productos y campañas.<br>Cuando se agreguen, aquí verás a cuáles califica el cliente y por qué.</div>`}
          </section>
        </div>
      </div>

      <details class="tecnico">
        <summary>Ver texto extraído del PDF (para revisar la lectura)</summary>
        ${faltan.length ? `<p style="font-size:13px;margin:10px 0 0">Datos que el lector no encontró:</p><div class="faltantes">${faltan.map(k => `<span>${NOMBRES_CAMPOS[k]}</span>`).join('')}</div>` : ''}
        <pre class="texto-pdf">${esc(reg.texto || '')}</pre>
      </details>`;
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
        let nuevo = t === '' ? null : (NUM.includes(el.name) ? Number(t) : (el.tagName === 'SELECT' || el.type === 'date' ? t : t.toUpperCase()));
        if (reg.cliente[el.name] !== nuevo) {
          reg.cliente[el.name] = nuevo;
          if (el.name === 'numEntidades') reg.cliente.numEntidadesEstimado = false;
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
