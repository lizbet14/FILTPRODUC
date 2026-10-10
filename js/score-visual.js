/*
 * FILTPRODUC · Visual del score
 *  - Niveles de score (alineados a los cortes de las campañas)
 *  - Medidor semicircular con aguja animada
 *  - Número que cuenta hasta el score
 *  - Lluvia de confeti (score 800 o más)
 * Respeta "reducir movimiento" del sistema.
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

  const reducirMovimiento = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
      <g class="aguja" data-grados="${grados.toFixed(1)}" style="transform-origin:${CX}px ${CY}px; transform: rotate(${grados.toFixed(1)}deg)">
        <line x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - R + 6}" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
      </g>
      <circle cx="${CX}" cy="${CY}" r="7" fill="currentColor"/>
      <circle cx="${CX}" cy="${CY}" r="3" fill="${n ? n.color : 'var(--gris)'}"/>
    </svg>`;
  }

  /** Anima la aguja y el número dentro de 'contenedor'. */
  function animar(contenedor, score) {
    if (!contenedor || score === null || score === undefined) return;
    const aguja = contenedor.querySelector('.aguja');
    const numero = contenedor.querySelector('[data-cuenta]');
    if (reducirMovimiento()) return; // ya están en su posición final
    const destino = aguja ? aguja.dataset.grados : null;
    if (aguja) {
      aguja.style.transition = 'none';
      aguja.style.transform = 'rotate(-90deg)';
      aguja.getBoundingClientRect();
      requestAnimationFrame(() => {
        aguja.style.transition = 'transform 1.3s cubic-bezier(.2,.9,.25,1.15)';
        aguja.style.transform = `rotate(${destino}deg)`;
      });
    }
    if (numero) {
      const fin = +numero.dataset.cuenta, dur = 1200, t0 = performance.now();
      const paso = ahora => {
        const t = Math.min(1, (ahora - t0) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        numero.textContent = Math.round(fin * e);
        if (t < 1) requestAnimationFrame(paso); else numero.textContent = fin;
      };
      numero.textContent = '0';
      requestAnimationFrame(paso);
    }
  }

  // ---------- confeti ----------
  function confeti(opciones = {}) {
    if (reducirMovimiento() || !root.document) return;
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

  root.ScoreVisual = { NIVELES, nivelDe, siguienteNivel, medidorSVG, animar, confeti, reducirMovimiento };
})(typeof window !== 'undefined' ? window : this);
