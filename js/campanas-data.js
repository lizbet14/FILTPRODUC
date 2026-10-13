/*
 * FILTPRODUC · Catálogo de campañas (DATOS)
 * Este archivo lo genera y actualiza el Panel de administración (admin.html).
 * Contiene solo criterios de calificación y condiciones de oferta.
 */
window.FILTPRODUC_CATALOGO = {
  "version": 1,
  "actualizado": "2026-10-12T00:00:00-05:00",
  "region": "CENTRO",
  "agencia": "Satipo",
  "campanas": [
    {
      "activa": true,
      "id": "contigo-myperu",
      "nombre": "Crédito Contigo MyPerú",
      "segmento": "Empresarial",
      "tipo": "Producto",
      "descripcion": "Facilidades de pago ante situaciones coyunturales. Comercio, producción o servicios.",
      "requisitos": [
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Tener negocio propio (perfil Empresarial)"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 660,
          "texto": "Score desde 660 (sin score: solo nodos A, B o C)"
        },
        {
          "campo": "normal6m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 6 meses (o sin calificación)"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        },
        {
          "campo": "antiguedadMeses",
          "op": ">=",
          "valor": 3,
          "texto": "Experiencia mínima de 3 meses en el negocio",
          "siFalta": "revisar"
        },
        {
          "campo": "esAgroPesca",
          "op": "==",
          "valor": false,
          "texto": "Rubro no agropecuario ni pesquero (salvo ingresos comerciales sustentados)",
          "siFalta": "cumple"
        }
      ],
      "verificar": [
        "Mora promedio menor a 8 días (pagaré vigente o último cancelado)"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": null,
        "plazo": "Capital de trabajo hasta 36 meses · gracia hasta 180 días",
        "tramos": [
          {
            "scoreMin": 660,
            "scoreMax": 692,
            "montoMax": 75000,
            "teaMin": 20
          },
          {
            "scoreMin": 693,
            "scoreMax": 999,
            "montoMax": 95000,
            "teaMin": 16
          }
        ],
        "sinScore": {
          "tramo": 0,
          "nota": "Sin score: solo con nodo A, B o C. Se muestra el primer tramo como referencia."
        },
        "referencias": [
          {
            "texto": "Ampliación hasta el 100% del monto del producto (S/ 95,000) con 30% del capital cancelado y mora ≤ 8 días."
          }
        ]
      },
      "condiciones": [
        "Cuota fija, fecha fija o C.E.P.",
        "Garantía Campaña Contigo MyPerú 5450"
      ],
      "vigencia": null
    },
    {
      "activa": true,
      "id": "crece-mujer",
      "nombre": "Crédito Crece Mujer",
      "segmento": "Empresarial",
      "tipo": "Producto",
      "descripcion": "Para mujeres con negocio: capital de trabajo o activo fijo.",
      "requisitos": [
        {
          "campo": "genero",
          "op": "==",
          "valor": "FEMENINO",
          "texto": "Género femenino"
        },
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Actividad empresarial: negocio propio (perfil Empresarial)"
        },
        {
          "campo": "normalActual",
          "op": "==",
          "valor": true,
          "texto": "Clasificación crediticia 100% Normal"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "texto": "Hasta 3 IFIs incluida Caja Piura"
        },
        {
          "campo": "vivienda",
          "op": "in",
          "valor": [
            "PROPIA",
            "FAMILIAR"
          ],
          "texto": "Domicilio estable: casa propia o de familia (no alquilada)"
        }
      ],
      "verificar": [
        "Sustentar el domicilio con copia del recibo de servicios"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": null,
        "plazo": "Capital de trabajo 24 meses · activo fijo 36 meses · libre amortización 90 días",
        "tramos": [
          {
            "scoreMin": 0,
            "scoreMax": 999,
            "montoMax": 30000,
            "teaMin": 34.45
          }
        ],
        "referencias": [
          {
            "texto": "Paralelo a otro Crece Mujer hasta su límite de endeudamiento, sin % de amortización (01/09 al 31/12/2026)."
          }
        ]
      },
      "condiciones": [
        "A sola firma",
        "Frecuencia semanal, bisemanal o mensual",
        "Garantía 5418 Campaña Crece Mujer"
      ],
      "vigencia": null
    },
    {
      "activa": true,
      "id": "al-toque",
      "nombre": "Crédito Al Toque",
      "segmento": "Empresarial",
      "tipo": "Producto",
      "descripcion": "Requisitos mínimos para personas naturales con negocio (microempresa).",
      "requisitos": [
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Actividad empresarial: producción, comercio o servicios (perfil Empresarial)"
        },
        {
          "campo": "esPersonaNatural",
          "op": "==",
          "valor": true,
          "texto": "Persona natural",
          "siFalta": "cumple"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        },
        {
          "campo": "normal3m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 3 meses"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 477,
          "texto": "Score desde 477 (sin score: se acepta como no bancarizado)",
          "siFalta": "cumple"
        },
        {
          "campo": "vivienda",
          "op": "in",
          "valor": [
            "PROPIA",
            "FAMILIAR"
          ],
          "texto": "Domicilio estable: casa propia o de familia (no alquilada)"
        }
      ],
      "verificar": [],
      "oferta": {
        "montoMin": 500,
        "teaMax": 99.99,
        "plazo": "Capital de trabajo 24 meses · activo fijo 36 meses · libre amortización 90 días",
        "tramos": [
          {
            "scoreMin": 477,
            "scoreMax": 597,
            "montoMax": 3000,
            "teaMin": 42.58
          },
          {
            "scoreMin": 598,
            "scoreMax": 721,
            "montoMax": 20000,
            "teaMin": 34.49
          },
          {
            "scoreMin": 722,
            "scoreMax": 876,
            "montoMax": 20000,
            "teaMin": 30.97
          },
          {
            "scoreMin": 877,
            "scoreMax": 999,
            "montoMax": 30000,
            "teaMin": 26.82
          }
        ],
        "sinScore": {
          "tramo": 0,
          "nota": "Cliente no bancarizado (sin score): se ubica en el primer rango, máximo S/ 3,000."
        },
        "referencias": [
          {
            "texto": "Clientes recurrentes pueden mantener sus condiciones actuales; para mejorar la tasa deben cumplir el score del cuadro."
          },
          {
            "texto": "Paralelo a otro Al Toque hasta su límite de endeudamiento, sin % de amortización (01/09 al 31/12/2026)."
          }
        ]
      },
      "condiciones": [
        "A sola firma",
        "Frecuencia semanal, bisemanal, mensual o libre amortización",
        "Garantía 5414 Crédito Al Toque"
      ],
      "vigencia": null
    },
    {
      "activa": true,
      "id": "credifamilia",
      "nombre": "Credifamilia",
      "segmento": "Consumo",
      "tipo": "Producto",
      "descripcion": "Consumo para personas naturales con negocio vigente (micro y pequeña empresa).",
      "requisitos": [
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Contar con negocio propio activo (perfil Empresarial)"
        },
        {
          "campo": "normalActual",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal en el sistema financiero"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        },
        {
          "campo": "vivienda",
          "op": "in",
          "valor": [
            "PROPIA",
            "FAMILIAR"
          ],
          "texto": "Estabilidad domiciliaria: casa propia o familiar (numeral 7.2 del reglamento)"
        }
      ],
      "verificar": [
        "Documentos que acrediten el negocio",
        "No puede liquidar un crédito empresarial vigente"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": 99.99,
        "plazo": "Cuotas fijas hasta 24 meses · libre amortización 90 días",
        "tramos": [
          {
            "scoreMin": 0,
            "scoreMax": 999,
            "montoMax": 20000,
            "teaMin": 27.5
          }
        ],
        "referencias": [
          {
            "texto": "Ampliación de un Credifamilia con el 20% del capital pagado."
          }
        ]
      },
      "condiciones": [
        "Un solo crédito por cliente",
        "A sola firma",
        "Garantía Campaña Credifamilia 5417"
      ],
      "vigencia": null
    },
    {
      "activa": true,
      "id": "credifacil-credifamilia",
      "nombre": "Credifácil Navideño · Credifamilia",
      "segmento": "Consumo",
      "tipo": "Campaña",
      "vigencia": {
        "desde": "2026-09-01",
        "hasta": "2026-12-31"
      },
      "descripcion": "Campaña de consumo para clientes con negocio (evaluación por estados financieros).",
      "requisitos": [
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Cliente con negocio (perfil Empresarial)"
        },
        {
          "campo": "antiguedadMeses",
          "op": ">=",
          "valor": 6,
          "texto": "Mínimo 6 meses de antigüedad en la actividad",
          "siFalta": "revisar"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 598,
          "texto": "Score desde 598 (región CENTRO)"
        },
        {
          "campo": "normal6m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 6 meses"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        },
        {
          "campo": "ingresoEstimadoMin",
          "op": ">=",
          "valor": 850,
          "texto": "Ingreso mínimo familiar S/ 850 (referencia: ingreso estimado)",
          "siFalta": "revisar"
        },
        {
          "campo": "vivienda",
          "op": "in",
          "valor": [
            "PROPIA",
            "FAMILIAR"
          ],
          "texto": "Domicilio estable: casa propia o familiar"
        }
      ],
      "verificar": [
        "No estar sobreendeudado",
        "Solo un crédito de campaña vigente"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": 99.99,
        "plazo": "De 6 a 24 cuotas fijas mensuales",
        "tramos": [
          {
            "scoreMin": 598,
            "scoreMax": 630,
            "montoMax": 10000,
            "teaMin": 35
          },
          {
            "scoreMin": 631,
            "scoreMax": 699,
            "montoMax": 20000,
            "teaMin": 30
          },
          {
            "scoreMin": 700,
            "scoreMax": 999,
            "montoMax": 30000,
            "teaMin": 27.5
          }
        ],
        "topes": [
          {
            "id": "paralelo",
            "cuando": [
              {
                "campo": "creditoVigente",
                "op": "==",
                "valor": true
              }
            ],
            "montoMax": 15000,
            "texto": "Crédito paralelo (tiene crédito vigente en Caja Piura): tope S/ 15,000 y mora promedio \"0\". Solo un crédito de consumo o PYME vigente."
          }
        ],
        "referencias": [
          {
            "texto": "Primera cuota hasta 60 días después del desembolso, si el cliente lo solicita."
          }
        ]
      },
      "condiciones": [
        "Garantía Campaña \"Credifácil Consumo\" 5429",
        "No permite liquidar créditos MYPE"
      ]
    },
    {
      "activa": true,
      "id": "credifacil-credipersona",
      "nombre": "Credifácil Navideño · Credipersona",
      "segmento": "Consumo",
      "tipo": "Campaña",
      "vigencia": {
        "desde": "2026-09-01",
        "hasta": "2026-12-31"
      },
      "descripcion": "Campaña de consumo para dependientes e independientes (evaluación por hoja de trabajo).",
      "requisitos": [
        {
          "campo": "perfil",
          "op": "notIn",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Perfil Consumo: dependiente o independiente sin negocio (con negocio: Credifamilia)"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 598,
          "texto": "Score desde 598 (región CENTRO)"
        },
        {
          "campo": "normal6m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 6 meses"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        },
        {
          "campo": "ingresoEstimadoMin",
          "op": ">=",
          "valor": 850,
          "texto": "Ingreso mínimo familiar S/ 850 (referencia: ingreso estimado)",
          "siFalta": "revisar"
        }
      ],
      "verificar": [
        "Sustento de ingresos: boletas, recibos por honorarios o declaración jurada",
        "Dependientes: más de 6 meses de continuidad laboral y empresa con más de 2 años",
        "No estar sobreendeudado"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": 99.99,
        "plazo": "De 6 a 24 cuotas fijas mensuales",
        "tramos": [
          {
            "scoreMin": 598,
            "scoreMax": 999,
            "montoMax": 50000,
            "teaMin": 18.5
          }
        ],
        "topes": [
          {
            "id": "paralelo",
            "cuando": [
              {
                "campo": "creditoVigente",
                "op": "==",
                "valor": true
              }
            ],
            "montoMax": 15000,
            "texto": "Crédito paralelo (tiene crédito vigente en Caja Piura): tope S/ 15,000 y mora promedio \"0\". Solo un crédito de consumo o PYME vigente."
          },
          {
            "id": "alquilada",
            "cuando": [
              {
                "campo": "vivienda",
                "op": "==",
                "valor": "ALQUILADA"
              }
            ],
            "montoMax": 5000,
            "plazo": "hasta 18 meses",
            "texto": "Vivienda alquilada: solo con ingresos de 4ta o 5ta categoría, antigüedad laboral e ingresos fijos (sin fiador con casa propia). Hasta S/ 5,000 a 18 meses."
          }
        ],
        "referencias": [
          {
            "texto": "Si sustenta ingresos solo con declaración jurada u otros documentos: hasta S/ 6,000.",
            "montoMax": 6000
          }
        ]
      },
      "condiciones": [
        "Garantía Campaña \"Credifácil Consumo\" 5429",
        "A sola firma"
      ]
    },
    {
      "activa": true,
      "id": "credifacil-planilla",
      "nombre": "Credifácil Navideño · Descuento por Planilla",
      "segmento": "Consumo",
      "tipo": "Campaña",
      "vigencia": {
        "desde": "2026-09-01",
        "hasta": "2026-12-31"
      },
      "descripcion": "Para dependientes con convenio de descuento por planilla. No aplica a clientes nuevos.",
      "requisitos": [
        {
          "campo": "tipoCliente",
          "op": "in",
          "valor": [
            "REACTIVADO",
            "RECURRENTE"
          ],
          "texto": "No aplica a clientes nuevos de Descuento por Planilla"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 598,
          "texto": "Score desde 598 (región CENTRO)"
        },
        {
          "campo": "normal6m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 6 meses"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 3,
          "soloPara": [
            "NUEVO",
            "REACTIVADO"
          ],
          "texto": "Hasta 3 IFIs (incluida Caja Piura) para clientes nuevos/reactivados"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "soloPara": [
            "RECURRENTE"
          ],
          "texto": "Hasta 4 IFIs (incluida Caja Piura) para clientes recurrentes"
        }
      ],
      "verificar": [
        "Trabaja en una institución con convenio de descuento por planilla",
        "Continuidad laboral mayor a 6 meses"
      ],
      "oferta": {
        "montoMin": 500,
        "teaMax": 99.99,
        "plazo": "De 6 a 24 cuotas fijas mensuales",
        "tramos": [
          {
            "scoreMin": 598,
            "scoreMax": 999,
            "montoMax": 50000,
            "teaMin": 16
          }
        ],
        "topes": [
          {
            "id": "paralelo",
            "cuando": [
              {
                "campo": "creditoVigente",
                "op": "==",
                "valor": true
              }
            ],
            "montoMax": 15000,
            "texto": "Crédito paralelo (tiene crédito vigente en Caja Piura): tope S/ 15,000 y mora promedio \"0\". Solo un crédito de consumo o PYME vigente."
          }
        ],
        "referencias": [
          {
            "texto": "El paralelo se descuenta de la boleta y se desembolsa por el mismo producto (071)."
          }
        ]
      },
      "condiciones": [
        "Garantía Campaña \"Credifácil Consumo\" 5429"
      ]
    },
    {
      "activa": true,
      "id": "compra-deuda-retencion",
      "nombre": "Compra de Deuda Negocio · Foco Retención",
      "segmento": "Empresarial",
      "tipo": "Campaña",
      "vigencia": {
        "desde": "2026-10-01",
        "hasta": "2026-12-31"
      },
      "descripcion": "Retener clientes MYPE recurrentes que reciben ofertas de compra de deuda de la competencia.",
      "requisitos": [
        {
          "campo": "creditoVigente",
          "op": "==",
          "valor": true,
          "texto": "Cliente con crédito MYPE vigente en Caja Piura"
        },
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Negocio: comercio, producción o servicios (perfil Empresarial)"
        },
        {
          "campo": "numEntidades",
          "op": "<=",
          "valor": 4,
          "texto": "Hasta 4 IFIs incluida Caja Piura"
        },
        {
          "campo": "normal12m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 12 meses"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 574,
          "texto": "Score desde 574"
        }
      ],
      "verificar": [
        "Su crédito vigente en Caja Piura es MYPE",
        "Mora promedio menor a 8 días",
        "Haber pagado al menos 6 cuotas de la deuda a comprar (excepción: deuda no creció más de 20% en 6 meses)",
        "No se compran deudas de consumo de otras IFIs"
      ],
      "oferta": {
        "montoMin": 5000,
        "teaMax": 99.99,
        "plazo": "Capital de trabajo 24 meses · activo fijo 60 meses · gracia 60 días",
        "tramos": [
          {
            "scoreMin": 574,
            "scoreMax": 599,
            "montoMax": 30000,
            "teaMin": 14
          },
          {
            "scoreMin": 600,
            "scoreMax": 699,
            "montoMax": 50000,
            "teaMin": 14
          },
          {
            "scoreMin": 700,
            "scoreMax": 772,
            "montoMax": 80000,
            "teaMin": 14
          },
          {
            "scoreMin": 773,
            "scoreMax": 999,
            "montoMax": 100000,
            "teaMin": 14
          }
        ],
        "ajustesTea": [
          {
            "cuando": [
              {
                "campo": "competenciaDirecta",
                "op": "==",
                "valor": true
              }
            ],
            "pp": -2,
            "texto": "Tiene deuda con Caja Cusco, Huancayo o Arequipa (competencia directa): TEA negociable hasta −2 pp, con autorización del Gerente Regional."
          }
        ],
        "referencias": [
          {
            "texto": "Permite capital adicional (12 o 24 meses más al plazo pendiente). Respetar el escalonamiento interno."
          }
        ]
      },
      "condiciones": [
        "Frecuencia semanal, quincenal o mensual",
        "Garantía 5446 Compra Deuda Negocio Retención"
      ]
    },
    {
      "activa": true,
      "id": "compra-deuda-recuperacion",
      "nombre": "Compra de Deuda Negocio · Foco Recuperación",
      "segmento": "Empresarial",
      "tipo": "Campaña",
      "vigencia": {
        "desde": "2026-10-01",
        "hasta": "2026-12-31"
      },
      "descripcion": "Ex clientes o clientes nuevos con deuda MYPE en la competencia.",
      "requisitos": [
        {
          "campo": "creditoVigente",
          "op": "==",
          "valor": false,
          "texto": "Sin obligación vigente con Caja Piura"
        },
        {
          "campo": "deudaOtrasIfis",
          "op": ">",
          "valor": 0,
          "texto": "Tiene deuda en otras IFIs para comprar"
        },
        {
          "campo": "perfil",
          "op": "in",
          "valor": [
            "NEGOCIO",
            "EMPRESA"
          ],
          "texto": "Negocio: comercio, producción o servicios (perfil Empresarial)"
        },
        {
          "campo": "entidadesSinCajaPiura",
          "op": "<=",
          "valor": 2,
          "texto": "Hasta 2 IFIs sin incluir Caja Piura"
        },
        {
          "campo": "normal12m",
          "op": "==",
          "valor": true,
          "texto": "Calificación 100% Normal últimos 12 meses (o sin calificación)"
        },
        {
          "campo": "score",
          "op": ">=",
          "valor": 574,
          "texto": "Score desde 574"
        }
      ],
      "verificar": [
        "Mora promedio menor a 8 días en el último pagaré con Caja Piura (ex clientes)",
        "Haber pagado al menos 6 cuotas de la deuda a comprar (excepción: deuda no creció más de 20% en 6 meses)",
        "No se compran deudas de consumo de otras IFIs"
      ],
      "oferta": {
        "montoMin": 5000,
        "teaMax": 99.99,
        "plazo": "Capital de trabajo 24 meses · activo fijo 60 meses · gracia 60 días",
        "tramos": [
          {
            "scoreMin": 574,
            "scoreMax": 599,
            "montoMax": 30000,
            "teaMin": 14
          },
          {
            "scoreMin": 600,
            "scoreMax": 699,
            "montoMax": 50000,
            "teaMin": 14
          },
          {
            "scoreMin": 700,
            "scoreMax": 772,
            "montoMax": 80000,
            "teaMin": 14
          },
          {
            "scoreMin": 773,
            "scoreMax": 999,
            "montoMax": 100000,
            "teaMin": 14
          }
        ],
        "ajustesTea": [
          {
            "cuando": [
              {
                "campo": "competenciaDirecta",
                "op": "==",
                "valor": true
              }
            ],
            "pp": -2,
            "texto": "Tiene deuda con Caja Cusco, Huancayo o Arequipa (competencia directa): TEA negociable hasta −2 pp, con autorización del Gerente Regional."
          }
        ],
        "referencias": [
          {
            "texto": "Permite capital adicional (12 o 24 meses más al plazo pendiente). Respetar el escalonamiento interno."
          }
        ]
      },
      "condiciones": [
        "Frecuencia semanal, quincenal o mensual",
        "Garantía 5446 Compra Deuda Retención Negocio"
      ]
    }
  ]
};
