# FILTPRODUC

Calificador de clientes para asesores de negocios de **Caja Piura**: se carga el reporte de deudas de **Sentinel** en PDF y el sistema muestra los datos clave del cliente y a qué **productos y campañas** puede acceder.

🔗 **Web en línea:** https://lizbet14.github.io/FILTPRODUC/

## Formato de reporte soportado

Calibrado con el **"Reporte de Crédito" de Sentinel / Experian** (PDF descargado del sistema). Lee:

- Score Experian y su texto ("Buen Puntaje"), semáforo (valor numérico → color con la regla del reporte)
- Consulta Rápida: deuda total del DNI y del RUC
- Indicadores ("Línea de Crédito", "Está Avalado") e ingreso estimado
- Detalle de la deuda SBS/Microfinanzas por entidad (calificación, monto, días de atraso, entidades que ya no reportan)
- Detalle de vencidos (documentos impagos), líneas de crédito
- Información General SUNAT: tipo de contribuyente (con/sin negocio), nombre comercial, actividad (CIIU), inicio de actividades
- Posición Histórica de 24 meses: entidades, deuda SBS, % normal, vencidos, impagos, deuda tributaria y laboral
- Protestos y Deudores Alimentarios Morosos

> ⚠️ El repositorio es público: **nunca subir reportes reales de clientes**. Para pruebas se usa `ejemplos/reporte-sentinel-ficticio.pdf` (datos inventados).

## Qué hace hoy

1. **Carga del PDF** (`index.html`): arrastrar o elegir el reporte Sentinel. El PDF se lee **solo en el navegador** con pdf.js; no se sube a ningún servidor.
2. **Panel del cliente** (`panel.html`):
   - Score, semáforo por calificación SBS según el orden SBS (NOR verde · CPP amarillo · DEF naranja · DUD rojo · PER negro), N° de entidades (IFIs), deuda total, endeudamiento máximo e ingreso estimado.
   - Filtros del asesor: tipo de cliente (nuevo, reactivado, recurrente o **con crédito vigente**, que activa las condiciones de crédito paralelo) y vivienda (propia, familiar, alquilada).
   - **Perfil del RUC**: persona con negocio, solo presta servicios, empresa (RUC 20) o sin RUC; estado, condición, actividad y antigüedad.
   - **Historial de endeudamiento**: gráfico mensual con semáforo, tendencia, variación, máximo y promedio.
   - **Detalle por entidad** y **alertas** para el asesor (CPP o peor, deuda vencida, castigos, judicial, sobreendeudamiento, RUC no activo…).
   - **Corregir datos** manualmente si el lector no encontró algo; el análisis se recalcula.
   - **Productos y campañas**: a cuáles califica, con **monto máximo y TEA mínima** según su score y los topes de su situación (paralelo, vivienda alquilada, sin score), cuadro de tramos y cuánto subiría con mejor score.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `js/carga.js` | Página de carga del PDF |
| `panel.html`, `js/panel.js` | Panel central de datos |
| `js/pdf-texto.js` | Extrae el texto del PDF reconstruyendo las líneas |
| `js/sentinel-experian.js` | Lector del formato real "Reporte de Crédito" Sentinel/Experian |
| `js/sentinel-parser.js` | Detecta el formato; lector genérico de respaldo para otros formatos |
| `js/analisis.js` | Perfil del RUC, análisis del historial de deuda y alertas |
| `js/campanas.js` | Catálogo de campañas: solo criterios de calificación y condiciones (región por defecto: CENTRO) |
| `js/productos.js` | Motor de calificación (tipo de cliente, ventanas de calificación, tramos por score) |
| `vendor/pdfjs/` | pdf.js (Mozilla, Apache-2.0) incluido para no depender de CDNs |
| `ejemplos/` | Reporte **ficticio** de prueba (datos inventados) |

## Próximos pasos

- [x] Calibrar el lector con reportes Sentinel reales (cliente con negocio y cliente sin negocio).
- [x] Cargar las primeras campañas (Contigo MyPerú, Crece Mujer, Al Toque, Credifamilia, Credifácil Navideño, Compra de Deuda).
- [x] Mostrar a qué productos califica el cliente y por qué (monto y TEA según score).
- [ ] Agregar más productos y campañas.

> Herramienta de apoyo. Verificar siempre la información con los sistemas oficiales.
