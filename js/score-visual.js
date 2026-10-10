/*
 * FILTPRODUC · Visual del score
 *  - Niveles de score (alineados a los cortes de las campañas)
 *  - Medidor semicircular con aguja animada
 *  - Número que cuenta hasta el score
 *  - Lluvia de confeti (score 800 o más)
 * Los efectos se pueden apagar con el botón ✨ de la barra (se guarda en el navegador).
 */
(function (root) {
  'use strict';

  const NIVELES = [
    { id: 'MUY_BAJO', nombre: 'Muy bajo', desde: 0, hasta: 476, color: 'var(--rojo)', medalla: '—' },
    { id: 'BAJO', nombre: 'Bajo', desde: 477, hasta: 597, color: 'var(--naranja)', medalla: 'Bronce' },
    { id: 'MEDIO', nombre: 'Medio', desde: 598, hasta: 699, color: 'var(--azul-nivel)', medalla: 'Plata' },
    { id: 'BUENO', nombre: 'Bueno', desde: 700, hasta: 799, color: 'var(--verde)', medalla: 'Oro' },
    { id: 'EXCELENTE', nombre: 'Excelente', desde: 800, hasta: 999, color: 'var(--acento)', medalla: 'Diamante' }
  ];
  const MIN = 300, MAX = 999; // escala visible del medidor

  // Efectos activados salvo que el asesor los apague con el botón ✨.
  // (No se usa la opción "reducir movimiento" de Windows: suele venir apagada en equipos de trabajo.)
  const CLAVE_EFECTOS = 'filtproduc:efectos';
  function efectosActivos() {
    try { return localStorage.getItem(CLAVE_EFECTOS) !== 'off'; } catch (e) { return true; }
  }
  function setEfectos(activos) {
    try { localStorage.setItem(CLAVE_EFECTOS, activos ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
  }
  const reducirMovimiento = () => !efectosActivos();

  function nivelDe(score) {
    if (score === null || score === undefined || isNaN(score)) return null;
    return NIVELES.find(n => score >= n.desde && score <= n.hasta) || NIVELES[NIVELES.length - 1];
  }
  function siguienteNivel(score) {
    const n = nivelDe(score);
    if (!n) return null;
    const i = NIVELES.indexOf(n);
    return NIVELES[i + 1] || null;
  }

  // ---------- medidor ----------
  const CX = 110, CY = 108, R = 86, GROSOR = 16;
  const frac = s => Math.min(1, Math.max(0, (s - MIN) / (MAX - MIN)));
  function punto(t, r = R) {
    const ang = Math.PI * (1 - t);
    return [CX + r * Math.cos(ang), CY - r * Math.sin(ang)];
  }
  function arco(t1, t2, r = R) {
    const [x1, y1] = punto(t1, r), [x2, y2] = punto(t2, r);
    const grande = (t2 - t1) > 0.5 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${grande} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  /** SVG del medidor. La aguja queda en reposo (-90°) y se gira con animar(). */
  function medidorSVG(score) {
    const n = nivelDe(score);
    const segs = NIVELES.map(nv => {
      const t1 = frac(Math.max(nv.desde, MIN)), t2 = frac(nv.hasta + (nv.hasta === 999 ? 0 : 1));
      const activo = n && nv.id === n.id;
      return `<path d="${arco(t1 + 0.004, t2 - 0.004)}" stroke="${nv.color}" stroke-width="${activo ? GROSOR + 4 : GROSOR}" fill="none" stroke-linecap="butt" opacity="${activo ? 1 : 0.45}"><title>${nv.nombre}: ${nv.desde}–${nv.hasta}</title></path>`;
    }).join('');
    const marcas = [477, 598, 700, 800].map(v => {
      const [x, y] = punto(frac(v), R - GROSOR / 2 - 15);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="currentColor" opacity=".7">${v}</text>`;
    }).join('');
    const grados = score === null || score === undefined ? -90 : -90 + 180 * frac(score);
    return `<svg class="medidor" viewBox="0 0 220 122" role="img" aria-label="Medidor de score${score != null ? ': ' + score + ', nivel ' + n.nombre : ''}">
      ${segs}${marcas}
      <g class="aguja" data-grados="${grados.toFixed(1)}" transform="rotate(${grados.toFixed(1)} ${CX} ${CY})">
        <line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 6}" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="7" fill="currentColor"/>
      <circle cx="${CX}" cy="${CY}" r="3" fill="${n ? n.color : 'var(--gris)'}"/>
    </svg>`;
  }

  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /**
   * Anima, dentro de 'raiz': la aguja del medidor, el número del score (cuenta de 0
   * al score) y la barra de "Siguiente nivel" (se llena). Si los efectos están
   * apagados, deja todo en su posición final.
   */
  function animar(raiz, score) {
    if (!raiz) return;
    const aguja = raiz.querySelector('.kpi-score .aguja');
    const numero = raiz.querySelector('.kpi-score [data-cuenta]');
    const barra = raiz.querySelector('.nivel-barra span[data-ancho]');
    const gradosFin = aguja ? parseFloat(aguja.dataset.grados) : null;
    const nFin = numero ? +numero.dataset.cuenta : null;
    const anchoFin = barra ? parseFloat(barra.dataset.ancho) : null;
    const colocar = e => {
      if (aguja) aguja.setAttribute('transform', `rotate(${(-90 + (gradosFin + 90) * e).toFixed(2)} ${CX} ${CY})`);
      if (numero) numero.textContent = Math.round(nFin * e);
      if (barra) barra.style.width = (anchoFin * e).toFixed(1) + '%';
    };
    if (aguja) aguja.style.transform = ''; // la rotación la maneja el atributo transform
    if (!efectosActivos() || score === null || score === undefined) { colocar(1); return; }
    const DUR = 2000, t0 = performance.now();
    colocar(0);
    const paso = ahora => {
      const t = Math.min(1, (ahora - t0) / DUR);
      colocar(easeOut(t));
      if (t < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }

  // ---------- confeti ----------
  function confeti(opciones = {}) {
    if (!efectosActivos() || !root.document) return;
    const colores = opciones.colores || ['#0b3d91', '#1d56a8', '#f8a900', '#ffd25a', '#ffffff', '#4f86e0'];
    const canvas = document.createElement('canvas');
    canvas.className = 'confeti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const ajustar = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    ajustar();
    root.addEventListener('resize', ajustar);
    const N = Math.min(220, Math.round(innerWidth / 6));
    const piezas = Array.from({ length: N }, () => ({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 10,
      vx: -1.5 + Math.random() * 3, vy: 2 + Math.random() * 3.5,
      rot: Math.random() * Math.PI, vr: -0.15 + Math.random() * 0.3,
      osc: Math.random() * Math.PI * 2,
      color: colores[Math.floor(Math.random() * colores.length)],
      forma: Math.random() < 0.25 ? 'circulo' : 'papel'
    }));
    const DURACION = opciones.duracion || 3800;
    const t0 = performance.now();
    function cuadro(ahora) {
      const t = ahora - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const desvanecer = t > DURACION - 900 ? Math.max(0, (DURACION - t) / 900) : 1;
      for (const p of piezas) {
        p.osc += 0.05; p.x += p.vx + Math.sin(p.osc) * 0.8; p.y += p.vy; p.vy += 0.03; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = desvanecer;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.forma === 'circulo') { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.scale(1, Math.cos(p.osc)); ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
        ctx.restore();
      }
      if (t < DURACION) requestAnimationFrame(cuadro);
      else { root.removeEventListener('resize', ajustar); canvas.remove(); }
    }
    requestAnimationFrame(cuadro);
  }

  root.ScoreVisual = { NIVELES, nivelDe, siguienteNivel, medidorSVG, animar, confeti, efectosActivos, setEfectos, reducirMovimiento };
})(typeof window !== 'undefined' ? window : this);
