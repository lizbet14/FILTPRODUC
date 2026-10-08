# FILTPRODUC

Calificador de clientes para asesores de negocios de **Caja Piura**: se carga el reporte de deudas de **Sentinel** en PDF y el sistema muestra los datos clave del cliente y a qué **productos y campañas** puede acceder.

🔗 **Web en línea:** https://lizbet14.github.io/filtproduc/

## Qué hace hoy

1. **Carga del PDF** (`index.html`): arrastrar o elegir el reporte Sentinel. El PDF se lee **solo en el navegador** con pdf.js; no se sube a ningún servidor.
2. **Panel del cliente** (`panel.html`):
   - Score, semáforo actual, N° de entidades (IFIs) que lo reportan, deuda total y vencida, calificación SBS.
   - **Perfil del RUC**: persona con negocio, solo presta servicios, empresa (RUC 20) o sin RUC; estado, condición, actividad y antigüedad.
   - **Historial de endeudamiento**: gráfico mensual con semáforo, tendencia, variación, máximo y promedio.
   - **Detalle por entidad** y **alertas** para el asesor (CPP o peor, deuda vencida, castigos, judicial, sobreendeudamiento, RUC no activo…).
   - **Corregir datos** manualmente si el lector no encontró algo; el análisis se recalcula.
   - Sección de **productos y campañas** (motor de reglas listo, catálogo pendiente).

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `js/carga.js` | Página de carga del PDF |
| `panel.html`, `js/panel.js` | Panel central de datos |
| `js/pdf-texto.js` | Extrae el texto del PDF reconstruyendo las líneas |
| `js/sentinel-parser.js` | Lee los datos del reporte Sentinel (etiquetas configurables en `ETIQUETAS`) |
| `js/analisis.js` | Perfil del RUC, análisis del historial de deuda y alertas |
| `js/productos.js` | Catálogo de productos/campañas y motor de reglas |
| `vendor/pdfjs/` | pdf.js (Mozilla, Apache-2.0) incluido para no depender de CDNs |
| `ejemplos/` | Reporte **ficticio** de prueba (datos inventados) |

## Próximos pasos

- [ ] Calibrar el lector con un reporte Sentinel real (anonimizado).
- [ ] Cargar el catálogo de productos y campañas de Caja Piura con sus requisitos.
- [ ] Mostrar a qué productos califica el cliente y por qué.

> Herramienta de apoyo. Verificar siempre la información con los sistemas oficiales.
