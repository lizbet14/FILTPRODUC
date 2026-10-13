/*
 * FILTPRODUC · Panel de administración de campañas
 *
 * - Acceso: usuario + clave. Se compara el hash PBKDF2-SHA256 (js/admin-config.js).
 * - Edición de cada cláusula de cada campaña (general, requisitos, verificaciones,
 *   oferta por tramos de score, topes, ajustes de TEA, referencias y condiciones).
 * - Guardar en este navegador (vista previa) o publicar para todos (GitHub API con
 *   un token que se guarda cifrado con la clave del administrador).
 */
(function () {
  'use strict';

  const CFG = window.FILTPRODUC_ADMIN;
  const RUTA_DATOS = 'js/campanas-data.js';
  const RUTA_CONFIG = 'js/admin-config.js';
  const CLAVE_TOKEN = 'filtproduc:admin:token';
  const INACTIVIDAD_MS = 20 * 60 * 1000;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clonar = o => JSON.parse(JSON.stringify(o));

  // ============================ Cripto ============================
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const deB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  function utf8ABase64(texto) {
    const bytes = enc.encode(texto);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  async function pbkdf2Bits(clave, sal, iteraciones) {
    const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, base, 256);
  }
  async function claveAes(clave, sal) {
    const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 150000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  function igualTiempoConstante(a, b) {
    if (a.length !== b.length) return false;
    let r = 0;
    for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  async function verificarClave(clave) {
    const bits = await pbkdf2Bits(clave, deB64(CFG.sal), CFG.iteraciones);
    return igualTiempoConstante(b64(bits), CFG.hash);
  }
  async function cifrarToken(token, clave) {
    const sal = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await claveAes(clave, sal);
    const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(token));
    return { sal: b64(sal), iv: b64(iv), datos: b64(datos) };
  }
  async function descifrarToken(obj, clave) {
    const k = await claveAes(clave, deB64(obj.sal));
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(obj.iv) }, k, deB64(obj.datos));
    return dec.decode(plano);
  }

  // ============================ Estado ============================
  const S = {
    clave: null, token: null,
    borrador: null,      // copia de trabajo del catálogo
    seleccion: null,     // id de campaña o '__ajustes'
    sucio: false,
    filtro: ''
  };

  // ============================ Utilidades UI ============================
  function aviso(texto, tipo = 'ok') {
    const el = $('#avisoFlotante');
    el.textContent = texto;
    el.className = 'aviso-flotante aviso-' + tipo;
    el.hidden = false;
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => { el.hidden = true; }, tipo === 'error' ? 7000 : 3500);
  }
  function confirmar(titulo, texto, boton = 'Confirmar') {
    const dlg = $('#dlgConfirmar');
    $('#confTitulo').textContent = titulo;
    $('#confTexto').textContent = texto;
    $('#confBoton').textContent = boton;
    return new Promise(res => {
      dlg.addEventListener('close', () => res(dlg.returnValue === 'si'), { once: true });
      dlg.showModal();
    });
  }
  function descargar(nombre, texto, tipo = 'application/json') {
    const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ============================ Acceso ============================
  const BLOQUEO = 'filtproduc:admin:bloqueo';
  function bloqueoRestante() {
    try { const b = JSON.parse(sessionStorage.getItem(BLOQUEO) || '{}'); return b.hasta && b.hasta > Date.now() ? b.hasta - Date.now() : 0; } catch (e) { return 0; }
  }
  function registrarFallo() {
    let b = {};
    try { b = JSON.parse(sessionStorage.getItem(BLOQUEO) || '{}'); } catch (e) { /* */ }
    b.fallos = (b.fallos || 0) + 1;
    if (b.fallos >= 5) { b.hasta = Date.now() + 60000; b.fallos = 0; }
    try { sessionStorage.setItem(BLOQUEO, JSON.stringify(b)); } catch (e) { /* */ }
  }

  async function ingresar(e) {
    e.preventDefault();
    const err = $('#loginError');
    err.classList.remove('visible');
    if (!CFG || !CFG.hash) { err.textContent = 'Falta la configuración de acceso (js/admin-config.js).'; err.classList.add('visible'); return; }
    const espera = bloqueoRestante();
    if (espera) { err.textContent = `Demasiados intentos. Espera ${Math.ceil(espera / 1000)} segundos.`; err.classList.add('visible'); return; }
    const usuario = $('#loginUsuario').value.trim().toUpperCase();
    const clave = $('#loginClave').value;
    const btn = $('#btnEntrar');
    btn.disabled = true; btn.textContent = 'Verificando…';
    let ok = false;
    try { ok = usuario === String(CFG.usuario).toUpperCase() && await verificarClave(clave); } catch (x) { ok = false; }
    btn.disabled = false; btn.textContent = 'Ingresar';
    if (!ok) {
      registrarFallo();
      err.textContent = 'Usuario o clave incorrectos.';
      err.classList.add('visible');
      $('#loginClave').value = '';
      $('#loginClave').focus();
      return;
    }
    S.clave = clave;
    try { sessionStorage.removeItem(BLOQUEO); } catch (x) { /* */ }
    await cargarToken();
    abrirPanel();
  }

  async function cargarToken() {
    S.token = null;
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_TOKEN) || 'null');
      if (guardado) S.token = await descifrarToken(guardado, S.clave);
    } catch (e) { S.token = null; }
  }

  function salir() {
    S.clave = null; S.token = null;
    location.reload();
  }

  let temporizador = null;
  function reiniciarInactividad() {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (S.sucio) {
        try { localStorage.setItem(Campanas.CLAVE_LOCAL, JSON.stringify(S.borrador)); } catch (e) { /* */ }
      }
      alert('Sesión cerrada por inactividad.' + (S.sucio ? ' Tus cambios se guardaron en este navegador.' : ''));
      salir();
    }, INACTIVIDAD_MS);
  }

  // ============================ Catálogo: metadatos ============================
  const CAMPOS = {
    score: { etq: 'Score Experian', tipo: 'numero' },
    numEntidades: { etq: 'N° de entidades (IFIs)', tipo: 'numero' },
    entidadesSinCajaPiura: { etq: 'N° de entidades sin Caja Piura', tipo: 'numero' },
    deudaOtrasIfis: { etq: 'Deuda en otras IFIs (S/)', tipo: 'numero' },
    deudaTotal: { etq: 'Deuda total (S/)', tipo: 'numero' },
    deudaVencida: { etq: 'Deuda vencida (S/)', tipo: 'numero' },
    docsImpagos: { etq: 'Documentos impagos (S/)', tipo: 'numero' },
    antiguedadMeses: { etq: 'Antigüedad del negocio (meses)', tipo: 'numero' },
    ingresoEstimadoMin: { etq: 'Ingreso estimado mínimo (S/)', tipo: 'numero' },
    normalActual: { etq: '100% Normal actualmente', tipo: 'bool' },
    normal3m: { etq: '100% Normal últimos 3 meses', tipo: 'bool' },
    normal6m: { etq: '100% Normal últimos 6 meses', tipo: 'bool' },
    normal12m: { etq: '100% Normal últimos 12 meses', tipo: 'bool' },
    creditoVigente: { etq: 'Tiene crédito vigente en Caja Piura (botón del asesor)', tipo: 'bool' },
    tieneCajaPiura: { etq: 'Caja Piura le reporta deuda (según reporte)', tipo: 'bool' },
    competenciaDirecta: { etq: 'Debe a Caja Cusco, Huancayo o Arequipa', tipo: 'bool' },
    esPersonaNatural: { etq: 'Es persona natural', tipo: 'bool' },
    esAgroPesca: { etq: 'Rubro agropecuario o pesquero', tipo: 'bool' },
    perfil: { etq: 'Perfil del cliente', tipo: 'lista', opciones: [['NEGOCIO', 'Con negocio (Empresarial)'], ['EMPRESA', 'Empresa (RUC 20)'], ['SERVICIOS', 'Sin negocio (Consumo)'], ['SIN_RUC', 'Sin RUC']] },
    tipoCliente: { etq: 'Tipo de cliente', tipo: 'lista', opciones: [['NUEVO', 'Nuevo'], ['REACTIVADO', 'Reactivado'], ['RECURRENTE', 'Recurrente']] },
    vivienda: { etq: 'Vivienda', tipo: 'lista', opciones: [['PROPIA', 'Propia'], ['FAMILIAR', 'Familiar'], ['ALQUILADA', 'Alquilada']] },
    genero: { etq: 'Género', tipo: 'lista', opciones: [['FEMENINO', 'Femenino'], ['MASCULINO', 'Masculino']] }
  };
  const OPS = {
    numero: [['>=', 'mayor o igual a'], ['<=', 'menor o igual a'], ['>', 'mayor a'], ['<', 'menor a'], ['==', 'igual a']],
    bool: [['==', 'es']],
    lista: [['in', 'es uno de'], ['notIn', 'no es ninguno de'], ['==', 'es']]
  };
  const TIPOS = [['NUEVO', 'Nuevo'], ['REACTIVADO', 'Reactivado'], ['RECURRENTE', 'Recurrente']];
  const CONDICIONES = {
    CREDITO_VIGENTE: { etq: 'Cliente con crédito vigente (paralelo)', cuando: [{ campo: 'creditoVigente', op: '==', valor: true }] },
    VIVIENDA_ALQUILADA: { etq: 'Vivienda alquilada', cuando: [{ campo: 'vivienda', op: '==', valor: 'ALQUILADA' }] },
    COMPETENCIA: { etq: 'Debe a Caja Cusco, Huancayo o Arequipa', cuando: [{ campo: 'competenciaDirecta', op: '==', valor: true }] },
    SIN_SCORE: { etq: 'Cliente sin score', cuando: [{ campo: 'sinScore', op: '==', valor: true }] },
    MUJER: { etq: 'Clienta (género femenino)', cuando: [{ campo: 'genero', op: '==', valor: 'FEMENINO' }] }
  };
  function condicionId(cuando) {
    const t = JSON.stringify(cuando || []);
    for (const k of Object.keys(CONDICIONES)) if (JSON.stringify(CONDICIONES[k].cuando) === t) return k;
    return 'PERSONALIZADA';
  }

  function valorPorDefecto(campo, op) {
    const m = CAMPOS[campo];
    if (!m) return '';
    if (m.tipo === 'numero') return 0;
    if (m.tipo === 'bool') return true;
    if (op === '==') return m.opciones[0][0];
    return [m.opciones[0][0]];
  }

  /** Texto automático para un requisito (si el administrador no escribe uno). */
  function textoAuto(r) {
    const m = CAMPOS[r.campo];
    if (!m) return '';
    if (m.tipo === 'bool') return r.valor ? m.etq : `No: ${m.etq.toLowerCase()}`;
    const opTxt = (OPS[m.tipo].find(o => o[0] === r.op) || [, r.op])[1];
    let v = r.valor;
    if (m.tipo === 'lista') {
      const nombre = x => (m.opciones.find(o => o[0] === x) || [, x])[1];
      v = Array.isArray(v) ? v.map(nombre).join(', ') : nombre(v);
    }
    return `${m.etq} ${opTxt} ${v}`;
  }

  function campanaNueva() {
    return {
      activa: true, id: 'nueva-campana-' + Date.now().toString(36), nombre: 'Nueva campaña', segmento: 'Empresarial', tipo: 'Campaña',
      vigencia: null, descripcion: '',
      requisitos: [{ campo: 'score', op: '>=', valor: 600, texto: 'Score desde 600' }],
      verificar: [],
      oferta: { montoMin: 500, plazo: '', tramos: [{ scoreMin: 600, scoreMax: 999, montoMax: 10000, teaMin: 30 }], topes: [], ajustesTea: [], referencias: [] },
      condiciones: []
    };
  }

  // ============================ Estado de cambios ============================
  function marcarSucio() {
    S.sucio = true;
    pintarEstado();
  }
  function pintarEstado() {
    const el = $('#estadoGuardado');
    const local = Campanas.local();
    let txt, cls;
    if (S.sucio) { txt = 'Cambios sin guardar'; cls = 'est-sucio'; }
    else if (local && local.publicadoDesdePanel) { txt = 'Publicado · la web se está actualizando'; cls = 'est-ok'; }
    else if (local) { txt = 'Guardado solo en este navegador · falta publicar'; cls = 'est-local'; }
    else { txt = 'Al día con lo publicado'; cls = 'est-ok'; }
    const pub = Campanas.publicado();
    el.className = 'estado-guardado ' + cls;
    el.innerHTML = `<span class="punto-estado"></span>${esc(txt)}<small>Publicado: ${pub.actualizado ? new Date(pub.actualizado).toLocaleString('es-PE') : '—'}${S.token ? ' · publicación configurada' : ' · publicación sin configurar'}</small>`;
  }

  // ============================ Validación ============================
  function validar(cat) {
    const errores = [];
    const ids = new Set();
    for (const p of cat.campanas) {
      const n = p.nombre || p.id;
      if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) errores.push({ id: p.id, msg: `${n}: el código solo puede tener minúsculas, números y guiones.` });
      if (ids.has(p.id)) errores.push({ id: p.id, msg: `${n}: el código "${p.id}" está repetido.` });
      ids.add(p.id);
      if (!p.nombre || !p.nombre.trim()) errores.push({ id: p.id, msg: `${p.id}: falta el nombre.` });
      if (p.vigencia && p.vigencia.desde && p.vigencia.hasta && p.vigencia.desde > p.vigencia.hasta) errores.push({ id: p.id, msg: `${n}: la vigencia termina antes de empezar.` });
      for (const [i, r] of (p.requisitos || []).entries()) {
        const m = CAMPOS[r.campo];
        if (!m) { errores.push({ id: p.id, msg: `${n}: requisito ${i + 1} con un dato no reconocido (${r.campo}).` }); continue; }
        if (m.tipo === 'numero' && (r.valor === '' || r.valor === null || isNaN(r.valor))) errores.push({ id: p.id, msg: `${n}: requisito ${i + 1} necesita un número.` });
        if (m.tipo === 'lista' && Array.isArray(r.valor) && !r.valor.length) errores.push({ id: p.id, msg: `${n}: requisito ${i + 1} necesita al menos una opción marcada.` });
        if (r.soloPara && !r.soloPara.length) errores.push({ id: p.id, msg: `${n}: requisito ${i + 1} no aplica a ningún tipo de cliente.` });
      }
      const o = p.oferta || {};
      const ts = o.tramos || [];
      if (!ts.length) errores.push({ id: p.id, msg: `${n}: la oferta necesita al menos un tramo de score.` });
      ts.forEach((t, i) => {
        if ([t.scoreMin, t.scoreMax, t.montoMax, t.teaMin].some(x => x === '' || x === null || isNaN(x))) errores.push({ id: p.id, msg: `${n}: tramo ${i + 1} tiene datos vacíos.` });
        else {
          if (t.scoreMin > t.scoreMax) errores.push({ id: p.id, msg: `${n}: tramo ${i + 1} tiene score "desde" mayor que "hasta".` });
          if (t.montoMax < (o.montoMin || 0)) errores.push({ id: p.id, msg: `${n}: tramo ${i + 1} tiene monto máximo menor al monto mínimo.` });
          if (t.teaMin < 0 || t.teaMin > 200) errores.push({ id: p.id, msg: `${n}: tramo ${i + 1} tiene una TEA fuera de rango.` });
          if (i > 0 && t.scoreMin <= ts[i - 1].scoreMax) errores.push({ id: p.id, msg: `${n}: los tramos ${i} y ${i + 1} se cruzan u están desordenados.` });
        }
      });
      if (o.sinScore && o.sinScore.tramo !== null && o.sinScore.tramo !== undefined && !ts[o.sinScore.tramo]) errores.push({ id: p.id, msg: `${n}: "sin score" apunta a un tramo que no existe.` });
      for (const [i, t] of (o.topes || []).entries()) if (t.montoMax !== undefined && t.montoMax !== null && (isNaN(t.montoMax) || t.montoMax <= 0)) errores.push({ id: p.id, msg: `${n}: tope ${i + 1} necesita un monto válido.` });
    }
    return errores;
  }

  /** Normaliza antes de guardar: textos automáticos, soloPara completo → sin restricción. */
  function normalizar(cat) {
    const c = clonar(cat);
    for (const p of c.campanas) {
      for (const r of p.requisitos || []) {
        if (r.soloPara && r.soloPara.length === TIPOS.length) delete r.soloPara;
        if (!r.siFalta || r.siFalta === 'revisar') delete r.siFalta;
        if (!r.texto || !r.texto.trim()) r.texto = textoAuto(r);
      }
      p.verificar = (p.verificar || []).map(x => String(x).trim()).filter(Boolean);
      p.condiciones = (p.condiciones || []).map(x => String(x).trim()).filter(Boolean);
      const o = p.oferta || (p.oferta = {});
      o.tramos = (o.tramos || []).map(t => ({ scoreMin: +t.scoreMin, scoreMax: +t.scoreMax, montoMax: +t.montoMax, teaMin: +t.teaMin }));
      o.topes = (o.topes || []).map((t, i) => { const x = { ...t, id: t.id || 'tope-' + (i + 1) }; if (x.montoMax === '' || x.montoMax === null || x.montoMax === undefined) delete x.montoMax; else x.montoMax = +x.montoMax; if (!x.plazo) delete x.plazo; return x; });
      o.referencias = (o.referencias || []).filter(r => r.texto && r.texto.trim()).map(r => { const x = { texto: r.texto.trim() }; if (r.montoMax) x.montoMax = +r.montoMax; return x; });
      o.ajustesTea = (o.ajustesTea || []).map(a => ({ ...a, pp: +a.pp }));
      if (o.sinScore && (o.sinScore.tramo === null || o.sinScore.tramo === undefined) && !o.sinScore.nota) delete o.sinScore;
      if (p.vigencia && !p.vigencia.desde && !p.vigencia.hasta) p.vigencia = null;
    }
    return c;
  }

  function mostrarErrores(errores) {
    const box = $('#erroresValidacion');
    if (!errores.length) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = `<b>No se puede guardar todavía. Corrige:</b><ul>${errores.slice(0, 8).map(e => `<li><a href="#" data-ir="${esc(e.id)}">${esc(e.msg)}</a></li>`).join('')}</ul>${errores.length > 8 ? `<p>y ${errores.length - 8} más…</p>` : ''}`;
    box.querySelectorAll('[data-ir]').forEach(a => a.addEventListener('click', ev => { ev.preventDefault(); S.seleccion = a.dataset.ir; pintarTodo(); }));
  }

  // ============================ Guardar / publicar ============================
  function prepararParaGuardar() {
    const cat = normalizar(S.borrador);
    const errores = validar(cat);
    mostrarErrores(errores);
    if (errores.length) { aviso('Hay datos por corregir antes de guardar.', 'error'); return null; }
    return cat;
  }

  function guardarLocal() {
    const cat = prepararParaGuardar();
    if (!cat) return false;
    cat.actualizado = new Date().toISOString();
    cat.borradorLocal = true;
    try { localStorage.setItem(Campanas.CLAVE_LOCAL, JSON.stringify(cat)); } catch (e) { aviso('No se pudo guardar en este navegador.', 'error'); return false; }
    S.borrador = clonar(cat);
    S.sucio = false;
    pintarTodo();
    aviso('Guardado en este navegador. El calificador de este equipo ya usa estos cambios.');
    return true;
  }

  function textoArchivoDatos(cat) {
    const limpio = clonar(cat);
    delete limpio.borradorLocal;
    return "/*\n * FILTPRODUC · Catálogo de campañas (DATOS)\n * Este archivo lo genera y actualiza el Panel de administración (admin.html).\n * Contiene solo criterios de calificación y condiciones de oferta.\n */\nwindow.FILTPRODUC_CATALOGO = " + JSON.stringify(limpio, null, 2) + ";\n";
  }

  async function github(ruta, opciones = {}) {
    const r = await fetch(`https://api.github.com/repos/${CFG.repo}/contents/${ruta}${opciones.method ? '' : `?ref=${CFG.rama}&t=${Date.now()}`}`, {
      ...opciones,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${S.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opciones.headers || {}) }
    });
    if (!r.ok) {
      let msg = `GitHub respondió ${r.status}`;
      try { const j = await r.json(); if (j.message) msg += `: ${j.message}`; } catch (e) { /* */ }
      if (r.status === 401) msg = 'El token no es válido o venció. Configúralo de nuevo en Más → Configurar publicación.';
      else if (r.status === 403 && /not accessible by personal access token/i.test(msg)) msg = 'El token puede leer pero no escribir. En GitHub edita el token y pon "Contenidos" (Contents) en "Lectura y escritura" (Read and write), con el repositorio FILTPRODUC marcado. No hace falta volver a pegarlo.';
      else if (r.status === 403 || r.status === 404) msg += '. Revisa que el token tenga "Contenidos: Lectura y escritura" sobre FILTPRODUC.';
      throw new Error(msg);
    }
    return r.json();
  }
  async function escribirArchivo(ruta, texto, mensaje) {
    const actual = await github(ruta);
    return github(ruta, { method: 'PUT', body: JSON.stringify({ message: mensaje, content: utf8ABase64(texto), sha: actual.sha, branch: CFG.rama }) });
  }

  async function publicar() {
    if (!S.token) { aviso('Primero configura la publicación (token de GitHub).', 'error'); abrirToken(); return; }
    const cat = prepararParaGuardar();
    if (!cat) return;
    const ok = await confirmar('Publicar para todos', 'Los cambios se verán en la web para todos los que la usen, en 1 o 2 minutos.', 'Publicar');
    if (!ok) return;
    const btn = $('#btnPublicar');
    btn.disabled = true; btn.textContent = 'Publicando…';
    try {
      cat.actualizado = new Date().toISOString();
      delete cat.borradorLocal;
      await escribirArchivo(RUTA_DATOS, textoArchivoDatos(cat), `Panel admin: actualiza catálogo de campañas (${new Date().toLocaleString('es-PE')})`);
      // Copia local hasta que GitHub Pages sirva la nueva versión (se limpia sola)
      try { localStorage.setItem(Campanas.CLAVE_LOCAL, JSON.stringify({ ...cat, publicadoDesdePanel: true })); } catch (e) { /* */ }
      S.borrador = clonar(cat);
      S.sucio = false;
      pintarTodo();
      aviso('¡Publicado! La web se actualiza para todos en 1 o 2 minutos.');
    } catch (e) {
      aviso('No se pudo publicar. ' + e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Publicar para todos';
    }
  }

  async function descartar() {
    const ok = await confirmar('Descartar cambios', 'Se borran los cambios guardados en este navegador y los no guardados. Vuelves a lo que está publicado.', 'Descartar');
    if (!ok) return;
    try { localStorage.removeItem(Campanas.CLAVE_LOCAL); } catch (e) { /* */ }
    S.borrador = clonar(Campanas.publicado());
    S.sucio = false;
    if (!S.borrador.campanas.find(p => p.id === S.seleccion)) S.seleccion = S.borrador.campanas[0] ? S.borrador.campanas[0].id : null;
    mostrarErrores([]);
    pintarTodo();
    aviso('Cambios descartados.');
  }

  function exportar() {
    const cat = normalizar(S.borrador);
    const f = new Date().toISOString().slice(0, 10);
    descargar(`filtproduc-campanas-${f}.json`, JSON.stringify(cat, null, 2));
  }
  function importar(archivo) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.campanas)) throw new Error('El archivo no tiene campañas.');
        S.borrador = d;
        S.seleccion = d.campanas[0] ? d.campanas[0].id : null;
        marcarSucio();
        pintarTodo();
        aviso(`Importadas ${d.campanas.length} campañas. Revisa y guarda.`);
      } catch (e) { aviso('No se pudo importar: ' + e.message, 'error'); }
    };
    r.readAsText(archivo);
  }

  // ============================ Token y clave ============================
  function abrirToken() {
    $('#inputToken').value = '';
    $('#tokenError').classList.remove('visible');
    $('#btnQuitarToken').hidden = !S.token;
    $('#dlgToken').showModal();
  }
  async function guardarToken() {
    const t = $('#inputToken').value.trim();
    const err = $('#tokenError');
    err.classList.remove('visible');
    if (!t) { err.textContent = 'Pega el token.'; err.classList.add('visible'); return; }
    const anterior = S.token;
    S.token = t;
    const btn = $('#btnGuardarToken');
    btn.disabled = true; btn.textContent = 'Probando…';
    try {
      await github(RUTA_DATOS);
      localStorage.setItem(CLAVE_TOKEN, JSON.stringify(await cifrarToken(t, S.clave)));
      $('#dlgToken').close();
      pintarEstado();
      aviso('Token guardado. Verifica que en GitHub tenga "Contenidos: Lectura y escritura"; la primera publicación lo confirmará.');
    } catch (e) {
      S.token = anterior;
      err.textContent = e.message;
      err.classList.add('visible');
    } finally { btn.disabled = false; btn.textContent = 'Probar y guardar'; }
  }
  function quitarToken() {
    try { localStorage.removeItem(CLAVE_TOKEN); } catch (e) { /* */ }
    S.token = null;
    $('#dlgToken').close();
    pintarEstado();
    aviso('Token eliminado de este navegador.');
  }

  async function cambiarClave() {
    const n1 = $('#claveNueva').value, n2 = $('#claveNueva2').value;
    const err = $('#claveError');
    err.classList.remove('visible');
    const falla = m => { err.textContent = m; err.classList.add('visible'); };
    if (!S.token) return falla('Primero configura la publicación (token de GitHub).');
    if (n1.length < 10 || !/[A-Za-z]/.test(n1) || !/\d/.test(n1)) return falla('La clave debe tener mínimo 10 caracteres, con letras y números.');
    if (n1 !== n2) return falla('Las claves no coinciden.');
    const btn = $('#btnGuardarClave');
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      const sal = crypto.getRandomValues(new Uint8Array(16));
      const iter = CFG.iteraciones || 210000;
      const hash = b64(await pbkdf2Bits(n1, sal, iter));
      const nuevo = { ...CFG, sal: b64(sal), hash, iteraciones: iter, actualizado: new Date().toISOString().slice(0, 10) };
      const texto = "/*\n * FILTPRODUC · Configuración del acceso de administración\n * Solo contiene el HASH de la clave (PBKDF2-SHA256 con sal). La clave no se guarda.\n * Este archivo se actualiza desde el panel al usar \"Cambiar clave\".\n */\nwindow.FILTPRODUC_ADMIN = " + JSON.stringify(nuevo, null, 2) + ";\n";
      await escribirArchivo(RUTA_CONFIG, texto, 'Panel admin: cambia la clave de acceso');
      Object.assign(CFG, nuevo);
      S.clave = n1;
      localStorage.setItem(CLAVE_TOKEN, JSON.stringify(await cifrarToken(S.token, n1)));
      $('#dlgClave').close();
      aviso('Clave cambiada. Rige en la web en 1 o 2 minutos.');
    } catch (e) {
      falla('No se pudo cambiar: ' + e.message);
    } finally { btn.disabled = false; btn.textContent = 'Cambiar clave'; }
  }

  // ============================ Lista de campañas ============================
  function estadoVigencia(p) {
    const hoy = new Date().toISOString().slice(0, 10);
    if (p.activa === false) return ['Inactiva', 'b-inactiva'];
    if (p.vigencia && p.vigencia.hasta && hoy > p.vigencia.hasta) return ['Vencida', 'b-vencida'];
    if (p.vigencia && p.vigencia.desde && hoy < p.vigencia.desde) return ['Por iniciar', 'b-futura'];
    return ['Activa', 'b-activa'];
  }
  function pintarLista() {
    const f = S.filtro.toLowerCase();
    const items = S.borrador.campanas.filter(p => !f || (p.nombre + ' ' + p.id).toLowerCase().includes(f));
    $('#listaCampanas').innerHTML = `
      <button type="button" class="item-camp item-ajustes ${S.seleccion === '__ajustes' ? 'sel' : ''}" data-id="__ajustes">
        <b>⚙ Ajustes generales</b><small>Agencia y región</small>
      </button>
      ${items.map(p => { const [t, c] = estadoVigencia(p); return `
      <button type="button" class="item-camp ${p.id === S.seleccion ? 'sel' : ''}" data-id="${esc(p.id)}">
        <b>${esc(p.nombre)}</b>
        <small>${esc(p.segmento || '')} · ${esc(p.tipo || '')} <span class="badge ${c}">${t}</span></small>
      </button>`; }).join('')}
      ${!items.length ? '<p class="vacio">Sin resultados.</p>' : ''}`;
    $('#listaCampanas').querySelectorAll('.item-camp').forEach(b => b.addEventListener('click', () => { S.seleccion = b.dataset.id; pintarTodo(); $('#editor').scrollIntoView({ block: 'start', behavior: 'smooth' }); }));
  }

  // ============================ Editor ============================
  const actual = () => S.borrador.campanas.find(p => p.id === S.seleccion);

  function opcionesSelect(lista, sel) {
    return lista.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`).join('');
  }

  function controlValor(r, i) {
    const m = CAMPOS[r.campo] || { tipo: 'numero' };
    const base = `requisitos.${i}.valor`;
    if (m.tipo === 'numero') return `<input type="number" step="any" data-ruta="${base}" data-tipo="numero" value="${esc(r.valor)}" aria-label="Valor">`;
    if (m.tipo === 'bool') return `<select data-ruta="${base}" data-tipo="bool" aria-label="Valor"><option value="true" ${r.valor ? 'selected' : ''}>Sí</option><option value="false" ${!r.valor ? 'selected' : ''}>No</option></select>`;
    if (r.op === '==') return `<select data-ruta="${base}" data-tipo="texto" aria-label="Valor">${opcionesSelect(m.opciones, r.valor)}</select>`;
    const sel = Array.isArray(r.valor) ? r.valor : [r.valor];
    return `<div class="checks">${m.opciones.map(([v, t]) => `<label class="check"><input type="checkbox" data-lista="${base}" value="${esc(v)}" ${sel.includes(v) ? 'checked' : ''}>${esc(t)}</label>`).join('')}</div>`;
  }

  function filaRequisito(r, i, total) {
    const m = CAMPOS[r.campo] || { tipo: 'numero' };
    const tipos = r.soloPara || TIPOS.map(t => t[0]);
    return `<div class="fila-req">
      <div class="req-linea">
        <select data-ruta="requisitos.${i}.campo" data-rerender aria-label="Dato del cliente">${Object.entries(CAMPOS).map(([k, c]) => `<option value="${k}" ${k === r.campo ? 'selected' : ''}>${esc(c.etq)}</option>`).join('')}</select>
        <select data-ruta="requisitos.${i}.op" data-rerender aria-label="Condición">${opcionesSelect(OPS[m.tipo], r.op)}</select>
        ${controlValor(r, i)}
        <div class="mover">
          <button type="button" class="btn-ico" data-mover="requisitos.${i}.-1" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
          <button type="button" class="btn-ico" data-mover="requisitos.${i}.1" ${i === total - 1 ? 'disabled' : ''} title="Bajar">↓</button>
          <button type="button" class="btn-ico peligro" data-quitar="requisitos.${i}" title="Quitar requisito">✕</button>
        </div>
      </div>
      <input class="req-texto" data-ruta="requisitos.${i}.texto" value="${esc(r.texto || '')}" placeholder="${esc(textoAuto(r))}" aria-label="Texto que ve el asesor">
      <div class="req-opciones">
        <span>Aplica a:</span>
        ${TIPOS.map(([v, t]) => `<label class="check"><input type="checkbox" data-solopara="${i}" value="${v}" ${tipos.includes(v) ? 'checked' : ''}>${t}</label>`).join('')}
        <label class="check-sel">Si el reporte no trae el dato:
          <select data-ruta="requisitos.${i}.siFalta"><option value="revisar" ${r.siFalta !== 'cumple' ? 'selected' : ''}>marcar "Falta un dato"</option><option value="cumple" ${r.siFalta === 'cumple' ? 'selected' : ''}>darlo por cumplido</option></select>
        </label>
      </div>
    </div>`;
  }

  function listaTextos(ruta, items, placeholder) {
    return `<div class="lista-textos">${(items || []).map((t, i) => `
      <div class="fila-texto"><input data-ruta="${ruta}.${i}" value="${esc(t)}" placeholder="${esc(placeholder)}"><button type="button" class="btn-ico peligro" data-quitar="${ruta}.${i}" title="Quitar">✕</button></div>`).join('')}
      <button type="button" class="btn btn-mini" data-agregar="${ruta}">＋ Agregar</button></div>`;
  }

  function seccion(titulo, ayuda, contenido, abierta = true) {
    return `<details class="sec-ed" ${abierta ? 'open' : ''}><summary><b>${titulo}</b>${ayuda ? `<small>${ayuda}</small>` : ''}</summary><div class="sec-cuerpo">${contenido}</div></details>`;
  }

  function editorAjustes() {
    const d = S.borrador;
    return `<div class="ed-cab"><div><span class="seg">Configuración</span><h2>Ajustes generales</h2></div></div>
      ${seccion('Agencia y región', 'Se muestran en el calificador', `
        <div class="campos">
          <label>Agencia<input data-raiz="agencia" value="${esc(d.agencia || '')}"></label>
          <label>Región comercial<input data-raiz="region" value="${esc(d.region || '')}"></label>
        </div>
        <p class="nota-ed">Los montos y scores por región (por ejemplo el score mínimo de Credifácil) se editan en cada campaña.</p>`)}`;
  }

  function editorCampana(p) {
    const o = p.oferta || (p.oferta = { tramos: [] });
    const [estTxt, estCls] = estadoVigencia(p);
    const tramos = o.tramos || [];
    return `<div class="ed-cab">
        <div><span class="seg">${esc(p.segmento || '')} · ${esc(p.tipo || '')} <span class="badge ${estCls}">${estTxt}</span></span><h2>${esc(p.nombre)}</h2></div>
        <div class="ed-acciones">
          <label class="interruptor"><input type="checkbox" data-ruta="activa" data-tipo="checkbox" ${p.activa !== false ? 'checked' : ''}><span></span>${p.activa !== false ? 'Activa' : 'Inactiva'}</label>
          <button type="button" class="btn btn-mini" id="btnDuplicar">Duplicar</button>
          <button type="button" class="btn btn-mini peligro" id="btnEliminar">Eliminar</button>
        </div>
      </div>

      ${seccion('1. Datos generales', 'Nombre, tipo y vigencia', `
        <div class="campos">
          <label class="ancho">Nombre<input data-ruta="nombre" value="${esc(p.nombre)}"></label>
          <label>Segmento<select data-ruta="segmento">${opcionesSelect([['Empresarial', 'Empresarial'], ['Consumo', 'Consumo']], p.segmento)}</select></label>
          <label>Tipo<select data-ruta="tipo">${opcionesSelect([['Campaña', 'Campaña'], ['Producto', 'Producto']], p.tipo)}</select></label>
          <label class="ancho">Descripción corta<input data-ruta="descripcion" value="${esc(p.descripcion || '')}"></label>
          <label>Vigente desde<input type="date" data-ruta="vigencia.desde" value="${esc(p.vigencia && p.vigencia.desde || '')}"></label>
          <label>Vigente hasta<input type="date" data-ruta="vigencia.hasta" value="${esc(p.vigencia && p.vigencia.hasta || '')}"></label>
          <label class="ancho">Código interno<input data-ruta="id" value="${esc(p.id)}" spellcheck="false"></label>
        </div>
        <p class="nota-ed">Sin fechas de vigencia = siempre vigente. Fuera de vigencia, la campaña no aparece en el calificador.</p>`)}

      ${seccion('2. Requisitos para calificar', 'Cada requisito se revisa con los datos del reporte y los botones del asesor', `
        ${(p.requisitos || []).map((r, i, arr) => filaRequisito(r, i, arr.length)).join('') || '<p class="vacio">Sin requisitos: califica cualquier cliente.</p>'}
        <button type="button" class="btn btn-mini" data-agregar="requisitos">＋ Agregar requisito</button>`)}

      ${seccion('3. Verificar en la evaluación', 'Lo que el asesor confirma fuera del reporte (no bloquea)', listaTextos('verificar', p.verificar, 'Ej.: Mora promedio menor a 8 días'))}

      ${seccion('4. Oferta: monto y TEA por tramo de score', 'Monto máximo y TEA mínima según el score del cliente', `
        <div class="campos">
          <label>Monto mínimo (S/)<input type="number" step="any" data-ruta="oferta.montoMin" data-tipo="numero" value="${esc(o.montoMin ?? '')}"></label>
          <label class="ancho">Plazo<input data-ruta="oferta.plazo" value="${esc(o.plazo || '')}" placeholder="Ej.: Capital de trabajo 24 meses · activo fijo 36 meses"></label>
        </div>
        <div class="tabla-ed">
          <div class="tabla-cab"><span>Score desde</span><span>Score hasta</span><span>Monto máximo (S/)</span><span>TEA mínima (%)</span><span></span></div>
          ${tramos.map((t, i) => `<div class="tabla-fila">
            <label class="celda"><span class="etq-movil">Score desde</span><input type="number" data-ruta="oferta.tramos.${i}.scoreMin" data-tipo="numero" value="${esc(t.scoreMin)}" aria-label="Score desde"></label>
            <label class="celda"><span class="etq-movil">Score hasta</span><input type="number" data-ruta="oferta.tramos.${i}.scoreMax" data-tipo="numero" value="${esc(t.scoreMax)}" aria-label="Score hasta"></label>
            <label class="celda"><span class="etq-movil">Monto máx. (S/)</span><input type="number" step="any" data-ruta="oferta.tramos.${i}.montoMax" data-tipo="numero" value="${esc(t.montoMax)}" aria-label="Monto máximo"></label>
            <label class="celda"><span class="etq-movil">TEA mín. (%)</span><input type="number" step="0.01" data-ruta="oferta.tramos.${i}.teaMin" data-tipo="numero" value="${esc(t.teaMin)}" aria-label="TEA mínima"></label>
            <button type="button" class="btn-ico peligro" data-quitar="oferta.tramos.${i}" title="Quitar tramo">✕</button>
          </div>`).join('')}
          <button type="button" class="btn btn-mini" data-agregar="oferta.tramos">＋ Agregar tramo</button>
        </div>
        <p class="nota-ed">Un solo tramo de 0 a 999 = mismo monto y TEA para cualquier score. Los tramos deben ir de menor a mayor score, sin cruzarse.</p>
        <div class="campos">
          <label>Si el cliente no tiene score
            <select data-ruta="oferta.sinScore.tramo" data-tipo="tramo">
              <option value="" ${!o.sinScore || o.sinScore.tramo === null || o.sinScore.tramo === undefined ? 'selected' : ''}>No ubicarlo en un tramo</option>
              ${tramos.map((t, i) => `<option value="${i}" ${o.sinScore && o.sinScore.tramo === i ? 'selected' : ''}>Usar tramo ${i + 1} (${t.scoreMin}–${t.scoreMax})</option>`).join('')}
            </select>
          </label>
          <label>Nota para cliente sin score<input data-ruta="oferta.sinScore.nota" value="${esc(o.sinScore && o.sinScore.nota || '')}" placeholder="Ej.: No bancarizado: primer rango"></label>
        </div>`)}

      ${seccion('5. Topes automáticos', 'Bajan el monto máximo según la situación del cliente', `
        ${(o.topes || []).map((t, i) => { const cid = condicionId(t.cuando); return `<div class="fila-tope">
          <label>Cuando
            <select data-cond="oferta.topes.${i}">${Object.entries(CONDICIONES).map(([k, c]) => `<option value="${k}" ${k === cid ? 'selected' : ''}>${esc(c.etq)}</option>`).join('')}${cid === 'PERSONALIZADA' ? '<option value="PERSONALIZADA" selected>Condición personalizada</option>' : ''}</select>
          </label>
          <label>Monto máximo (S/)<input type="number" step="any" data-ruta="oferta.topes.${i}.montoMax" data-tipo="numero" value="${esc(t.montoMax ?? '')}"></label>
          <label>Plazo<input data-ruta="oferta.topes.${i}.plazo" value="${esc(t.plazo || '')}" placeholder="Opcional"></label>
          <button type="button" class="btn-ico peligro" data-quitar="oferta.topes.${i}" title="Quitar tope">✕</button>
          <label class="ancho">Texto para el asesor<input data-ruta="oferta.topes.${i}.texto" value="${esc(t.texto || '')}"></label>
        </div>`; }).join('') || '<p class="vacio">Sin topes.</p>'}
        <button type="button" class="btn btn-mini" data-agregar="oferta.topes">＋ Agregar tope</button>`, !!(o.topes || []).length)}

      ${seccion('6. Ajustes de TEA', 'TEA negociable en ciertas situaciones', `
        ${(o.ajustesTea || []).map((a, i) => { const cid = condicionId(a.cuando); return `<div class="fila-tope">
          <label>Cuando
            <select data-cond="oferta.ajustesTea.${i}">${Object.entries(CONDICIONES).map(([k, c]) => `<option value="${k}" ${k === cid ? 'selected' : ''}>${esc(c.etq)}</option>`).join('')}${cid === 'PERSONALIZADA' ? '<option value="PERSONALIZADA" selected>Condición personalizada</option>' : ''}</select>
          </label>
          <label>Puntos porcentuales<input type="number" step="0.01" data-ruta="oferta.ajustesTea.${i}.pp" data-tipo="numero" value="${esc(a.pp)}" title="Negativo = baja la TEA"></label>
          <span></span>
          <button type="button" class="btn-ico peligro" data-quitar="oferta.ajustesTea.${i}" title="Quitar ajuste">✕</button>
          <label class="ancho">Texto para el asesor<input data-ruta="oferta.ajustesTea.${i}.texto" value="${esc(a.texto || '')}"></label>
        </div>`; }).join('') || '<p class="vacio">Sin ajustes de TEA.</p>'}
        <button type="button" class="btn btn-mini" data-agregar="oferta.ajustesTea">＋ Agregar ajuste</button>`, !!(o.ajustesTea || []).length)}

      ${seccion('7. Otros topes y condiciones de monto', 'Informativos: dependen del sustento y los revisa el asesor', `
        ${(o.referencias || []).map((r, i) => `<div class="fila-texto">
          <input data-ruta="oferta.referencias.${i}.texto" value="${esc(r.texto)}" placeholder="Ej.: Con declaración jurada: hasta S/ 6,000">
          <button type="button" class="btn-ico peligro" data-quitar="oferta.referencias.${i}" title="Quitar">✕</button></div>`).join('')}
        <button type="button" class="btn btn-mini" data-agregar="oferta.referencias">＋ Agregar</button>`, !!(o.referencias || []).length)}

      ${seccion('8. Condiciones', 'Garantía, frecuencia de pago, etc.', listaTextos('condiciones', p.condiciones, 'Ej.: A sola firma'), !!(p.condiciones || []).length)}`;
  }

  function pintarEditor() {
    const ed = $('#editor');
    const scroll = window.scrollY;
    const abiertas = [...ed.querySelectorAll('details.sec-ed')].map(d => d.open);
    if (S.seleccion === '__ajustes') ed.innerHTML = editorAjustes();
    else {
      const p = actual();
      ed.innerHTML = p ? editorCampana(p) : '<div class="vacio">Elige una campaña de la lista o crea una nueva.</div>';
    }
    if (abiertas.length) ed.querySelectorAll('details.sec-ed').forEach((d, i) => { if (abiertas[i] !== undefined && pintarEditor._mismo) d.open = abiertas[i]; });
    window.scrollTo(0, scroll);
    enlazarEditor();
  }

  function pintarTodo() {
    pintarEstado();
    pintarLista();
    pintarEditor._mismo = pintarTodo._ultimo === S.seleccion;
    pintarTodo._ultimo = S.seleccion;
    pintarEditor();
  }

  // ---------- rutas tipo "oferta.tramos.2.montoMax" ----------
  function obtener(obj, ruta) { return ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function asignar(obj, ruta, valor) {
    const ks = ruta.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] === null || o[ks[i]] === undefined) o[ks[i]] = /^\d+$/.test(ks[i + 1]) ? [] : {};
      o = o[ks[i]];
    }
    o[ks[ks.length - 1]] = valor;
  }

  function enlazarEditor() {
    const ed = $('#editor');
    const p = actual();

    ed.querySelectorAll('[data-raiz]').forEach(el => el.addEventListener('input', () => { S.borrador[el.dataset.raiz] = el.value; marcarSucio(); }));
    if (!p) return;

    ed.querySelectorAll('[data-ruta]').forEach(el => {
      const evento = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date' || el.dataset.ruta === 'id' ? 'change' : 'input';
      el.addEventListener(evento, () => {
        const ruta = el.dataset.ruta;
        const t = el.dataset.tipo;
        let v = el.value;
        if (t === 'numero') v = v === '' ? '' : Number(v);
        else if (t === 'bool') v = v === 'true';
        else if (t === 'checkbox') v = el.checked;
        else if (t === 'tramo') v = v === '' ? null : Number(v);
        if (ruta === 'id') {
          v = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]+/g, '-');
          S.seleccion = v;
        }
        if (ruta.startsWith('vigencia.') && !p.vigencia) p.vigencia = {};
        asignar(p, ruta, v);
        // al cambiar el dato del requisito, ajustar condición y valor por defecto
        const m = /^requisitos\.(\d+)\.(campo|op)$/.exec(ruta);
        if (m) {
          const r = p.requisitos[+m[1]];
          const tipo = (CAMPOS[r.campo] || {}).tipo;
          if (m[2] === 'campo' || !OPS[tipo].some(o => o[0] === r.op)) r.op = OPS[tipo][0][0];
          if (m[2] === 'campo' || tipo === 'lista') r.valor = valorPorDefecto(r.campo, r.op);
          r.texto = '';
        }
        marcarSucio();
        if (el.hasAttribute('data-rerender') || ruta === 'activa' || ruta === 'nombre' || ruta === 'id' || ruta === 'segmento' || ruta === 'tipo' || ruta.startsWith('vigencia') || ruta.includes('tramos')) {
          if (ruta === 'nombre' || ruta === 'segmento' || ruta === 'tipo' || ruta.startsWith('vigencia')) { pintarLista(); const h = ed.querySelector('.ed-cab h2'); if (h && ruta === 'nombre') h.textContent = p.nombre; }
          else if (ruta.includes('tramos')) { if (evento === 'change' || el.type !== 'number') pintarTodo(); }
          else pintarTodo();
        }
      });
      if (el.dataset.ruta && el.dataset.ruta.includes('tramos')) el.addEventListener('change', () => pintarTodo());
    });

    ed.querySelectorAll('[data-lista]').forEach(el => el.addEventListener('change', () => {
      const ruta = el.dataset.lista;
      const marcados = [...ed.querySelectorAll(`[data-lista="${ruta}"]:checked`)].map(x => x.value);
      asignar(p, ruta, marcados);
      marcarSucio();
    }));

    ed.querySelectorAll('[data-solopara]').forEach(el => el.addEventListener('change', () => {
      const i = +el.dataset.solopara;
      const marcados = [...ed.querySelectorAll(`[data-solopara="${i}"]:checked`)].map(x => x.value);
      if (marcados.length === TIPOS.length) delete p.requisitos[i].soloPara;
      else p.requisitos[i].soloPara = marcados;
      marcarSucio();
    }));

    ed.querySelectorAll('[data-cond]').forEach(el => el.addEventListener('change', () => {
      const obj = obtener(p, el.dataset.cond);
      if (CONDICIONES[el.value]) obj.cuando = clonar(CONDICIONES[el.value].cuando);
      marcarSucio();
    }));

    ed.querySelectorAll('[data-quitar]').forEach(b => b.addEventListener('click', () => {
      const ks = b.dataset.quitar.split('.');
      const idx = +ks.pop();
      const arr = obtener(p, ks.join('.'));
      arr.splice(idx, 1);
      if (ks.join('.') === 'oferta.tramos' && p.oferta.sinScore && p.oferta.sinScore.tramo !== null && p.oferta.sinScore.tramo >= arr.length) p.oferta.sinScore.tramo = null;
      marcarSucio(); pintarTodo();
    }));

    ed.querySelectorAll('[data-mover]').forEach(b => b.addEventListener('click', () => {
      const ks = b.dataset.mover.split('.');
      const delta = +ks.pop(), idx = +ks.pop();
      const arr = obtener(p, ks.join('.'));
      const j = idx + delta;
      if (j < 0 || j >= arr.length) return;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      marcarSucio(); pintarTodo();
    }));

    ed.querySelectorAll('[data-agregar]').forEach(b => b.addEventListener('click', () => {
      const ruta = b.dataset.agregar;
      let arr = obtener(p, ruta);
      if (!Array.isArray(arr)) { asignar(p, ruta, []); arr = obtener(p, ruta); }
      if (ruta === 'requisitos') arr.push({ campo: 'score', op: '>=', valor: 600, texto: '' });
      else if (ruta === 'oferta.tramos') {
        const ult = arr[arr.length - 1];
        arr.push(ult ? { scoreMin: Math.min(999, ult.scoreMax + 1), scoreMax: 999, montoMax: ult.montoMax, teaMin: ult.teaMin } : { scoreMin: 0, scoreMax: 999, montoMax: 10000, teaMin: 30 });
      } else if (ruta === 'oferta.topes') arr.push({ cuando: clonar(CONDICIONES.CREDITO_VIGENTE.cuando), montoMax: 15000, texto: '' });
      else if (ruta === 'oferta.ajustesTea') arr.push({ cuando: clonar(CONDICIONES.COMPETENCIA.cuando), pp: -2, texto: '' });
      else if (ruta === 'oferta.referencias') arr.push({ texto: '' });
      else arr.push('');
      marcarSucio(); pintarTodo();
      const ultimos = $('#editor').querySelectorAll(`[data-ruta^="${ruta}."]`);
      if (ultimos.length) ultimos[ultimos.length - 1].focus();
    }));

    const dup = $('#btnDuplicar');
    if (dup) dup.addEventListener('click', () => {
      const copia = clonar(p);
      copia.id = p.id + '-copia';
      while (S.borrador.campanas.some(x => x.id === copia.id)) copia.id += '-1';
      copia.nombre = p.nombre + ' (copia)';
      S.borrador.campanas.splice(S.borrador.campanas.indexOf(p) + 1, 0, copia);
      S.seleccion = copia.id;
      marcarSucio(); pintarTodo();
      aviso('Campaña duplicada.');
    });
    const del = $('#btnEliminar');
    if (del) del.addEventListener('click', async () => {
      const ok = await confirmar('Eliminar campaña', `Se eliminará "${p.nombre}". Si solo quieres ocultarla, mejor desactívala con el interruptor.`, 'Eliminar');
      if (!ok) return;
      const i = S.borrador.campanas.indexOf(p);
      S.borrador.campanas.splice(i, 1);
      const sig = S.borrador.campanas[Math.min(i, S.borrador.campanas.length - 1)];
      S.seleccion = sig ? sig.id : '__ajustes';
      marcarSucio(); pintarTodo();
    });
  }

  // ============================ Arranque del panel ============================
  function abrirPanel() {
    $('#vistaLogin').hidden = true;
    $('#vistaAdmin').hidden = false;
    S.borrador = clonar(Campanas.datos());
    delete S.borrador.borradorLocal;
    delete S.borrador.publicadoDesdePanel;
    S.seleccion = S.borrador.campanas[0] ? S.borrador.campanas[0].id : '__ajustes';
    S.sucio = false;
    pintarTodo();

    $('#btnGuardarLocal').addEventListener('click', guardarLocal);
    $('#btnPublicar').addEventListener('click', publicar);
    $('#btnNueva').addEventListener('click', () => {
      const n = campanaNueva();
      S.borrador.campanas.push(n);
      S.seleccion = n.id;
      marcarSucio(); pintarTodo();
      const inp = $('#editor [data-ruta="nombre"]'); if (inp) { inp.focus(); inp.select(); }
    });
    $('#buscar').addEventListener('input', e => { S.filtro = e.target.value; pintarLista(); });

    const btnMas = $('#btnMas'), menu = $('#menuMas');
    btnMas.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; btnMas.setAttribute('aria-expanded', String(!menu.hidden)); });
    document.addEventListener('click', () => { menu.hidden = true; btnMas.setAttribute('aria-expanded', 'false'); });
    menu.querySelectorAll('[data-accion]').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.accion;
      if (a === 'exportar') exportar();
      if (a === 'importar') $('#archivoImportar').click();
      if (a === 'descartar') descartar();
      if (a === 'token') abrirToken();
      if (a === 'clave') { $('#claveNueva').value = ''; $('#claveNueva2').value = ''; $('#claveError').classList.remove('visible'); $('#dlgClave').showModal(); }
      if (a === 'salir') {
        if (S.sucio) confirmar('Cerrar sesión', 'Tienes cambios sin guardar. Se perderán.', 'Cerrar sesión').then(ok => { if (ok) salir(); });
        else salir();
      }
    }));
    $('#archivoImportar').addEventListener('change', e => { if (e.target.files[0]) importar(e.target.files[0]); e.target.value = ''; });
    $('#btnGuardarToken').addEventListener('click', guardarToken);
    $('#btnQuitarToken').addEventListener('click', quitarToken);
    $('#btnGuardarClave').addEventListener('click', cambiarClave);

    window.addEventListener('beforeunload', e => { if (S.sucio) { e.preventDefault(); e.returnValue = ''; } });
    ['click', 'keydown', 'input'].forEach(ev => document.addEventListener(ev, reiniciarInactividad, { passive: true }));
    reiniciarInactividad();
  }

  // ============================ Inicio ============================
  if (!window.crypto || !crypto.subtle) {
    $('#loginError').textContent = 'Este navegador no permite el acceso seguro. Usa Chrome, Edge o Firefox actualizados.';
    $('#loginError').classList.add('visible');
  }
  $('#formLogin').addEventListener('submit', ingresar);
  $('#loginUsuario').focus();
})();
