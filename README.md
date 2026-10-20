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
   - **Medidor de score** con aguja animada y número que cuenta, 5 niveles (Muy bajo <477 · Bajo 477–597 · Medio 598–699 · Bueno 700–799 · Excelente 800+), **lluvia de confeti** con 800 o más y **barra al siguiente nivel** con las mejoras de oferta que obtendría.
   - Semáforo por calificación SBS según el orden SBS (NOR verde · CPP amarillo · DEF naranja · DUD rojo · PER negro), N° de entidades (IFIs), deuda total, endeudamiento máximo e ingreso estimado.
   - Filtros del asesor: **perfil Empresarial o Consumo** (Empresarial = tiene negocio aunque no figure con RUC/RUS activo; manda sobre el dato del RUC), tipo de cliente (nuevo, reactivado, recurrente o **con crédito vigente**, que activa las condiciones de crédito paralelo), vivienda (propia, familiar, alquilada), **género** (mujer/varón, tomado del reporte y corregible; limita a Crece Mujer) y **destino del crédito** (capital de trabajo o activo fijo; p. ej. Contigo MyPerú solo financia capital de trabajo). El menú de filtros se pliega con el botón **Cambiar** y, plegado, muestra un resumen de lo elegido y lo que falta elegir.
   - **Perfil del RUC**: persona con negocio, solo presta servicios, empresa (RUC 20) o sin RUC; estado, condición, actividad y antigüedad.
   - **Historial de endeudamiento**: gráfico mensual con semáforo, tendencia, variación, máximo y promedio.
   - **Detalle por entidad** y **alertas** para el asesor (CPP o peor, deuda vencida, castigos, judicial, sobreendeudamiento, RUC no activo…).
   - **Corregir datos** manualmente si el lector no encontró algo; el análisis se recalcula.
   - **Productos y campañas**: a cuáles califica, con **monto máximo y TEA mínima** según su score y los topes de su situación (paralelo, vivienda alquilada, sin score), cuadro de tramos y cuánto subiría con mejor score. Diseño con encabezado de resumen (anillo de campañas que califica), tarjetas por segmento (Empresarial azul, Consumo ámbar), barra horizontal "Lo mejor para el cliente" (mayor monto y menor TEA; clic para ir a la tarjeta), cintas de *Mayor monto* y *Menor TEA*, barra de tramos y destinos que financia cada campaña.

## Panel de administración (`admin.html`)

Acceso con usuario **LBARZOLA** y su clave (en el repositorio solo está el *hash* PBKDF2-SHA256 de la clave, en `js/admin-config.js`).

- Edita cada cláusula de cada campaña: datos generales y vigencia, activar/desactivar, **requisitos** (dato, condición, valor, texto, a qué tipo de cliente aplica, qué hacer si falta el dato), **verificaciones**, **oferta por tramos de score** (monto máximo y TEA mínima), cliente sin score, **topes automáticos**, **ajustes de TEA**, referencias y condiciones.
- Crear, duplicar y eliminar campañas. Validación antes de guardar (tramos ordenados y sin cruces, valores vacíos, etc.).
- **Guardar en este navegador**: vista previa inmediata en el calificador de ese equipo.
- **Publicar para todos**: actualiza `js/campanas-data.js` en GitHub (la web se actualiza en 1–2 minutos). Requiere un token *fine-grained* de GitHub con permiso *Contents: Read and write* solo sobre este repositorio; se guarda **cifrado con la clave** en el navegador del administrador.
- Respaldo: descargar e importar el catálogo en JSON. Cambiar clave desde el panel.

> Seguridad: la clave protege el acceso al panel; lo que realmente impide cambiar la web publicada es el token de GitHub, que solo tiene el administrador.

## Estructura

| Archivo | Para qué sirve |
|---|---|
| `index.html`, `js/carga.js` | Página de carga del PDF |
| `panel.html`, `js/panel.js` | Panel central de datos |
| `js/pdf-texto.js` | Extrae el texto del PDF reconstruyendo las líneas |
| `js/sentinel-experian.js` | Lector del formato real "Reporte de Crédito" Sentinel/Experian |
| `js/sentinel-parser.js` | Detecta el formato; lector genérico de respaldo para otros formatos |
| `js/analisis.js` | Perfil del RUC, análisis del historial de deuda y alertas |
| `js/campanas-data.js` | **Datos** del catálogo de campañas (lo actualiza el panel de administración) |
| `js/campanas.js` | Lee el catálogo publicado o los cambios guardados en el navegador |
| `admin.html`, `js/admin.js`, `css/admin.css` | Panel de administración |
| `js/admin-config.js` | Usuario y hash de la clave de administración |
| `js/score-visual.js` | Niveles de score, medidor, animaciones y confeti |
| `js/productos.js` | Motor de calificación (tipo de cliente, ventanas de calificación, tramos por score) |
| `vendor/pdfjs/` | pdf.js (Mozilla, Apache-2.0) incluido para no depender de CDNs |
| `ejemplos/` | Reporte **ficticio** de prueba (datos inventados) |

## Próximos pasos

- [x] Calibrar el lector con reportes Sentinel reales (cliente con negocio y cliente sin negocio).
- [x] Cargar las primeras campañas (Contigo MyPerú, Crece Mujer, Al Toque, Credifamilia, Credifácil Navideño, Compra de Deuda).
- [x] Mostrar a qué productos califica el cliente y por qué (monto y TEA según score).
- [ ] Agregar más productos y campañas.

> Herramienta de apoyo. Verificar siempre la información con los sistemas oficiales.
