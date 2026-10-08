/*
 * FILTPRODUC · Catálogo de campañas y productos de Caja Piura
 * Solo criterios de calificación y condiciones de oferta (monto, plazo, TEA).
 * Fuente: fichas de campaña vigentes (octubre 2026).
 *
 * Forma de cada requisito automático:
 *   { campo, op, valor, texto, soloPara?: ['NUEVO','REACTIVADO','RECURRENTE'], siFalta?: 'revisar'|'cumple' }
 *   - soloPara: el requisito solo aplica a ese tipo de cliente
 *   - siFalta: qué hacer si el reporte no trae el dato (por defecto 'revisar')
 * 'verificar': requisitos que el asesor confirma fuera del reporte.
 * 'tramos': monto máximo y TEA según rango de score.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Campanas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Región comercial del asesor (agencia Satipo → región CENTRO)
  const CONFIG = { agencia: 'Satipo', region: 'CENTRO' };

  // Credifácil Navideño: score mínimo por producto y región
  const CREDIFACIL_SCORE_REGION = {
    CREDIPERSONA: { 598: ['NOR ORIENTE 2', 'CENTRO', 'NOR ORIENTE 1', 'NOR CENTRO'], 631: ['NORTE 2', 'SUR', 'NORTE 1'], 700: ['ORIENTE 1', 'SELVA', 'LIMA SUR', 'LIMA NORTE', 'LIMA NORTE CHICO'] },
    CREDIFAMILIA: { 598: ['CENTRO', 'NOR ORIENTE 2', 'SELVA', 'SUR'], 631: ['NORTE 2', 'NOR ORIENTE 1', 'LIMA NORTE CHICO', 'ORIENTE 1'], 700: ['LIMA NORTE', 'NOR CENTRO', 'NORTE 1', 'LIMA SUR'] },
    PLANILLA: { 598: ['LIMA SUR', 'SELVA', 'ORIENTE 1', 'CENTRO'], 631: ['NOR ORIENTE 2', 'NOR ORIENTE 1', 'NOR CENTRO', 'NORTE 1'], 700: ['LIMA NORTE CHICO', 'LIMA NORTE', 'NORTE 2', 'SUR'] }
  };
  function scoreMinRegion(producto, region) {
    const t = CREDIFACIL_SCORE_REGION[producto];
    for (const min of Object.keys(t)) if (t[min].includes(region)) return +min;
    return 700; // si la región no figura, se usa el rango más exigente
  }

  const NEGOCIO = ['NEGOCIO', 'EMPRESA'];
  // Vivienda del cliente: PROPIA | FAMILIAR | ALQUILADA (la elige el asesor en el panel)
  const viviendaEstable = texto => ({ campo: 'vivienda', op: 'in', valor: ['PROPIA', 'FAMILIAR'], texto });
  const ifis = (nuevos, recurrentes, nota = 'incluida Caja Piura') => [
    { campo: 'numEntidades', op: '<=', valor: nuevos, soloPara: ['NUEVO', 'REACTIVADO'], texto: `Hasta ${nuevos} IFIs (${nota}) para clientes nuevos/reactivados` },
    { campo: 'numEntidades', op: '<=', valor: recurrentes, soloPara: ['RECURRENTE'], texto: `Hasta ${recurrentes} IFIs (${nota}) para clientes recurrentes` }
  ];

  function catalogo(region = CONFIG.region) {
    const minPersona = scoreMinRegion('CREDIPERSONA', region);
    const minFamilia = scoreMinRegion('CREDIFAMILIA', region);
    const minPlanilla = scoreMinRegion('PLANILLA', region);
    const tramosCredifamiliaNav = [
      { scoreMin: 598, scoreMax: 630, montoMin: 500, montoMax: 10000, teaMin: 35.0 },
      { scoreMin: 631, scoreMax: 699, montoMin: 500, montoMax: 20000, teaMin: 30.0 },
      { scoreMin: 700, scoreMax: 999, montoMin: 500, montoMax: 30000, teaMin: 27.5 }
    ].filter(t => t.scoreMax >= minFamilia).map(t => ({ ...t, scoreMin: Math.max(t.scoreMin, minFamilia) }));

    return [
      {
        id: 'contigo-myperu', nombre: 'Crédito Contigo MyPerú', segmento: 'Empresarial', tipo: 'Producto',
        descripcion: 'Facilidades de pago ante situaciones coyunturales. Comercio, producción o servicios.',
        requisitos: [
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Tener negocio propio' },
          { campo: 'score', op: '>=', valor: 660, texto: 'Score desde 660 (sin score: solo nodos A, B o C)' },
          { campo: 'normal6m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 6 meses (o sin calificación)' },
          ...ifis(3, 4),
          { campo: 'antiguedadMeses', op: '>=', valor: 3, texto: 'Experiencia mínima de 3 meses en el negocio', siFalta: 'revisar' },
          { campo: 'esAgroPesca', op: '==', valor: false, texto: 'Rubro no agropecuario ni pesquero (salvo ingresos comerciales sustentados)', siFalta: 'cumple' }
        ],
        verificar: ['Mora promedio menor a 8 días (pagaré vigente o último cancelado)'],
        tramos: [
          { scoreMin: 660, scoreMax: 692, montoMin: 500, montoMax: 75000, teaMin: 20.0 },
          { scoreMin: 693, scoreMax: 999, montoMin: 500, montoMax: 95000, teaMin: 16.0 }
        ],
        condiciones: ['Capital de trabajo hasta 36 meses', 'Periodo de gracia hasta 180 días', 'Cuota fija, fecha fija o C.E.P.']
      },
      {
        id: 'crece-mujer', nombre: 'Crédito Crece Mujer', segmento: 'Empresarial', tipo: 'Producto',
        descripcion: 'Para mujeres con negocio: capital de trabajo o activo fijo.',
        requisitos: [
          { campo: 'genero', op: '==', valor: 'FEMENINO', texto: 'Género femenino' },
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Actividad empresarial (negocio)' },
          { campo: 'normalActual', op: '==', valor: true, texto: 'Clasificación crediticia 100% Normal' },
          { campo: 'numEntidades', op: '<=', valor: 3, texto: 'Hasta 3 IFIs incluida Caja Piura' },
          viviendaEstable('Domicilio estable: casa propia o de familia (no alquilada)')
        ],
        verificar: ['Sustentar el domicilio con copia del recibo de servicios'],
        tramos: [{ scoreMin: 0, scoreMax: 999, montoMin: 500, montoMax: 30000, teaMin: 34.45 }],
        condiciones: ['Capital de trabajo hasta 24 meses, activo fijo hasta 36 meses o libre amortización 90 días', 'A sola firma', 'Paralelo a otro Crece Mujer permitido del 01/09 al 31/12/2026']
      },
      {
        id: 'al-toque', nombre: 'Crédito Al Toque', segmento: 'Empresarial', tipo: 'Producto',
        descripcion: 'Requisitos mínimos para personas naturales con negocio (microempresa).',
        requisitos: [
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Actividad empresarial (producción, comercio o servicios)' },
          { campo: 'esPersonaNatural', op: '==', valor: true, texto: 'Persona natural', siFalta: 'cumple' },
          ...ifis(3, 4),
          { campo: 'normal3m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 3 meses' },
          { campo: 'score', op: '>=', valor: 477, texto: 'Score desde 477 (no bancarizados: primer rango, máx. S/ 3,000)', siFalta: 'revisar' },
          viviendaEstable('Domicilio estable: casa propia o de familia (no alquilada)')
        ],
        verificar: [],
        tramos: [
          { scoreMin: 477, scoreMax: 597, montoMin: 500, montoMax: 3000, teaMin: 42.58 },
          { scoreMin: 598, scoreMax: 721, montoMin: 500, montoMax: 20000, teaMin: 34.49 },
          { scoreMin: 722, scoreMax: 876, montoMin: 500, montoMax: 20000, teaMin: 30.97 },
          { scoreMin: 877, scoreMax: 999, montoMin: 500, montoMax: 30000, teaMin: 26.82 }
        ],
        condiciones: ['Capital de trabajo hasta 24 meses, activo fijo hasta 36 meses', 'A sola firma', 'Paralelo a otro Al Toque permitido del 01/09 al 31/12/2026']
      },
      {
        id: 'credifamilia', nombre: 'Credifamilia', segmento: 'Consumo', tipo: 'Producto',
        descripcion: 'Consumo para personas naturales con negocio vigente (micro y pequeña empresa).',
        requisitos: [
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Contar con negocio propio activo' },
          { campo: 'normalActual', op: '==', valor: true, texto: 'Calificación 100% Normal en el sistema financiero' },
          ...ifis(3, 4),
          viviendaEstable('Estabilidad domiciliaria: casa propia o familiar (numeral 7.2 del reglamento)')
        ],
        verificar: ['Documentos que acrediten el negocio', 'No puede liquidar un crédito empresarial vigente'],
        tramos: [{ scoreMin: 0, scoreMax: 999, montoMin: 500, montoMax: 20000, teaMin: 27.5 }],
        condiciones: ['Cuotas fijas hasta 24 meses o libre amortización 90 días', 'Un solo crédito por cliente', 'Ampliación con 20% del capital pagado']
      },
      {
        id: 'credifacil-credifamilia', nombre: 'Credifácil Navideño · Credifamilia', segmento: 'Consumo', tipo: 'Campaña',
        vigencia: { desde: '2026-09-01', hasta: '2026-12-31' },
        descripcion: 'Campaña de consumo para clientes con negocio (evaluación por estados financieros).',
        requisitos: [
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Cliente con negocio' },
          { campo: 'antiguedadMeses', op: '>=', valor: 6, texto: 'Mínimo 6 meses de antigüedad en la actividad', siFalta: 'revisar' },
          { campo: 'score', op: '>=', valor: minFamilia, texto: `Score desde ${minFamilia} (región ${region})` },
          { campo: 'normal6m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 6 meses' },
          ...ifis(3, 4),
          { campo: 'ingresoEstimadoMin', op: '>=', valor: 850, texto: 'Ingreso mínimo familiar S/ 850 (referencia: ingreso estimado)', siFalta: 'revisar' },
          viviendaEstable('Domicilio estable: casa propia o familiar')
        ],
        verificar: ['No estar sobreendeudado', 'Solo un crédito de campaña vigente'],
        tramos: tramosCredifamiliaNav,
        condiciones: ['Plazo de 6 a 24 cuotas fijas mensuales', 'Paralelo (recurrente con crédito vigente): hasta S/ 15,000 y mora promedio 0', 'Primera cuota hasta 60 días después del desembolso']
      },
      {
        id: 'credifacil-credipersona', nombre: 'Credifácil Navideño · Credipersona', segmento: 'Consumo', tipo: 'Campaña',
        vigencia: { desde: '2026-09-01', hasta: '2026-12-31' },
        descripcion: 'Campaña de consumo para dependientes e independientes (evaluación por hoja de trabajo).',
        requisitos: [
          { campo: 'perfil', op: 'notIn', valor: NEGOCIO, texto: 'Ingresos como dependiente o independiente (clientes con negocio: Credifamilia)' },
          { campo: 'score', op: '>=', valor: minPersona, texto: `Score desde ${minPersona} (región ${region})` },
          { campo: 'normal6m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 6 meses' },
          ...ifis(3, 4),
          { campo: 'ingresoEstimadoMin', op: '>=', valor: 850, texto: 'Ingreso mínimo familiar S/ 850 (referencia: ingreso estimado)', siFalta: 'revisar' }
        ],
        verificar: ['Sustento de ingresos: boletas, recibos por honorarios o declaración jurada', 'Dependientes: más de 6 meses de continuidad laboral y empresa con más de 2 años', 'No estar sobreendeudado'],
        siAlquilada: { montoMax: 5000, plazoMax: 18, nota: 'Vivienda alquilada: solo con ingresos de 4ta o 5ta categoría, antigüedad laboral e ingresos fijos (sin fiador con casa propia). Hasta S/ 5,000 a 18 meses.' },
        tramos: [{ scoreMin: minPersona, scoreMax: 999, montoMin: 500, montoMax: 50000, teaMin: 18.5 }],
        condiciones: ['Plazo de 6 a 24 cuotas fijas mensuales', 'Con declaración jurada: hasta S/ 6,000', '4ta/5ta categoría sin domicilio estable ni fiador: hasta S/ 5,000 a 18 meses', 'Paralelo: hasta S/ 15,000']
      },
      {
        id: 'credifacil-planilla', nombre: 'Credifácil Navideño · Descuento por Planilla', segmento: 'Consumo', tipo: 'Campaña',
        vigencia: { desde: '2026-09-01', hasta: '2026-12-31' },
        descripcion: 'Para dependientes con convenio de descuento por planilla. No aplica a clientes nuevos.',
        requisitos: [
          { campo: 'tipoCliente', op: 'in', valor: ['REACTIVADO', 'RECURRENTE'], texto: 'No aplica a clientes nuevos de Descuento por Planilla' },
          { campo: 'score', op: '>=', valor: minPlanilla, texto: `Score desde ${minPlanilla} (región ${region})` },
          { campo: 'normal6m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 6 meses' },
          ...ifis(3, 4)
        ],
        verificar: ['Trabaja en una institución con convenio de descuento por planilla', 'Continuidad laboral mayor a 6 meses'],
        tramos: [{ scoreMin: minPlanilla, scoreMax: 999, montoMin: 500, montoMax: 50000, teaMin: 16.0 }],
        condiciones: ['Plazo de 6 a 24 cuotas fijas mensuales']
      },
      {
        id: 'compra-deuda-retencion', nombre: 'Compra de Deuda Negocio · Foco Retención', segmento: 'Empresarial', tipo: 'Campaña',
        vigencia: { desde: '2026-10-01', hasta: '2026-12-31' },
        descripcion: 'Retener clientes MYPE recurrentes que reciben ofertas de compra de deuda de la competencia.',
        requisitos: [
          { campo: 'tipoCliente', op: '==', valor: 'RECURRENTE', texto: 'Cliente recurrente con crédito MYPE vigente en Caja Piura' },
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Negocio (comercio, producción o servicios)' },
          { campo: 'numEntidades', op: '<=', valor: 4, texto: 'Hasta 4 IFIs incluida Caja Piura' },
          { campo: 'normal12m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 12 meses' },
          { campo: 'score', op: '>=', valor: 574, texto: 'Score desde 574' }
        ],
        verificar: ['Su crédito vigente en Caja Piura es MYPE', 'Mora promedio menor a 8 días', 'Haber pagado al menos 6 cuotas de la deuda a comprar (excepción: deuda no creció más de 20% en 6 meses)', 'No se compran deudas de consumo de otras IFIs'],
        tramos: [
          { scoreMin: 574, scoreMax: 599, montoMin: 5000, montoMax: 30000, teaMin: 14.0 },
          { scoreMin: 600, scoreMax: 699, montoMin: 5000, montoMax: 50000, teaMin: 14.0 },
          { scoreMin: 700, scoreMax: 772, montoMin: 5000, montoMax: 80000, teaMin: 14.0 },
          { scoreMin: 773, scoreMax: 999, montoMin: 5000, montoMax: 100000, teaMin: 14.0 }
        ],
        condiciones: ['Capital de trabajo 24 meses, activo fijo 60 meses', 'Periodo de gracia 60 días', 'Deuda con Caja Cusco, Huancayo o Arequipa: negociación de hasta −2 pp']
      },
      {
        id: 'compra-deuda-recuperacion', nombre: 'Compra de Deuda Negocio · Foco Recuperación', segmento: 'Empresarial', tipo: 'Campaña',
        vigencia: { desde: '2026-10-01', hasta: '2026-12-31' },
        descripcion: 'Ex clientes o clientes nuevos con deuda MYPE en la competencia.',
        requisitos: [
          { campo: 'tieneCajaPiura', op: '==', valor: false, texto: 'Sin obligación vigente con Caja Piura' },
          { campo: 'deudaOtrasIfis', op: '>', valor: 0, texto: 'Tiene deuda en otras IFIs para comprar' },
          { campo: 'perfil', op: 'in', valor: NEGOCIO, texto: 'Negocio (comercio, producción o servicios)' },
          { campo: 'entidadesSinCajaPiura', op: '<=', valor: 2, texto: 'Hasta 2 IFIs sin incluir Caja Piura' },
          { campo: 'normal12m', op: '==', valor: true, texto: 'Calificación 100% Normal últimos 12 meses (o sin calificación)' },
          { campo: 'score', op: '>=', valor: 574, texto: 'Score desde 574' }
        ],
        verificar: ['Mora promedio menor a 8 días en el último pagaré con Caja Piura (ex clientes)', 'Haber pagado al menos 6 cuotas de la deuda a comprar (excepción: deuda no creció más de 20% en 6 meses)', 'No se compran deudas de consumo de otras IFIs'],
        tramos: [
          { scoreMin: 574, scoreMax: 599, montoMin: 5000, montoMax: 30000, teaMin: 14.0 },
          { scoreMin: 600, scoreMax: 699, montoMin: 5000, montoMax: 50000, teaMin: 14.0 },
          { scoreMin: 700, scoreMax: 772, montoMin: 5000, montoMax: 80000, teaMin: 14.0 },
          { scoreMin: 773, scoreMax: 999, montoMin: 5000, montoMax: 100000, teaMin: 14.0 }
        ],
        condiciones: ['Capital de trabajo 24 meses, activo fijo 60 meses', 'Periodo de gracia 60 días', 'Deuda con Caja Cusco, Huancayo o Arequipa: negociación de hasta −2 pp']
      }
    ];
  }

  return { CONFIG, catalogo, scoreMinRegion };
});
