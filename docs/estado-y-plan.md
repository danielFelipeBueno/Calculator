# Estado y plan

Dónde va el proyecto, qué falta y qué ya se decidió. Para retomar el trabajo sin
volver a discutir lo discutido ni repetir lo hecho.

Las reglas que no se pueden romper están en `CLAUDE.md`. El porqué técnico de
cada pieza del pipeline está en `README.md`. Esto es el mapa.

Última actualización: 6 de septiembre de 2026. Rama de trabajo:
`claude/rename-repo-me5ytx`.

## Qué es

Tienda en línea para vender Yanbal y Natura como consultora en Colombia. No
compite por precio —la marca fija el costo y compite con su propia tienda—, sino
por servicio: asesoría por WhatsApp, contraentrega y, más adelante,
fidelización.

La visión completa incluye login, un sistema de estrellas por compra y pagos.
Nada de eso está construido, y es deliberado: primero el catálogo real.

## Qué está hecho

**Datos: 792 productos publicables**, con foto, precio y descripción reales,
extraídos y verificados contra la fuente.

| | Total | Publicables | Con foto | Con descripción |
|---|---|---|---|---|
| Yanbal C09 | 468 | 440 | 442 (94 %) | 367 |
| Natura ciclo 13 | 366 | 352 | 352 (96 %) | 351 |

**Aplicación**: landing, catálogo con filtros, las 792 fichas generadas
estáticamente, tres páginas de políticas, sitemap y robots. `npm run build` da
801 páginas y `npx eslint .` sale limpio.

**Automatización**: detección de campaña nueva sin que nadie pase URLs, pipeline
en GitHub Actions para Yanbal, verificación de cobertura que bloquea la
publicación si los datos se degradan, y `scripts/actualizar-campana.mjs --auto`
para correr todo desde una máquina con IP colombiana.

## Qué falta

### 1. Para poder publicar — solo lo puede decidir una persona

Esto es lo único que separa el sitio de estar en línea. Nada de esto se puede
inventar (ver `CLAUDE.md`).

- `lib/negocio.ts`: nombre, ciudad, años vendiendo, código de consultora,
  **número de WhatsApp** (sin él no funciona ningún botón del sitio), costo de
  envío, umbral de envío gratis, ciudades con contraentrega.
- Foto de la consultora para la portada.
- Las tres páginas de `app/politicas/` están vacías —solo un recuadro que dice
  "CONTENIDO PENDIENTE"—. Envíos y devoluciones son decisiones de negocio.
  Privacidad es distinto: en Colombia la Ley 1581 de 2012 exige política de
  tratamiento de datos, y no la debería redactar un modelo.

### 2. Para que exista en internet

- Dominio y hosting. El sitio corre en local pero no está desplegado.
- `NEXT_PUBLIC_SITE_URL`. Sin eso, `sitemap.xml` y `robots.txt` apuntan a
  `alejandria.example.com` y todo el trabajo de SEO no le sirve a Google.
- Activar la automatización: el cron de `.github/workflows/campana.yml` **solo
  corre desde la rama por defecto**, así que no se ejecutará hasta que esta rama
  llegue a `main`.

### 3. Del catálogo

- 26 productos de Yanbal y 14 de Natura sin foto: los sitios no las publican y
  necesitan fotografía propia.
- 10 productos de Yanbal y 20 de Natura sin categoría, más 10 de Natura
  asignados por línea de producto. Es revisión manual de cada ciclo, media hora.
- Productos de Natura donde el nombre de la revista es una frase de publicidad
  ("LANZAMIENTO", "Con acción antidaños") en vez del producto.
- `lib/destacados.ts` y `lib/notas.ts` están vacíos. Hoy la landing elige sola
  los mejor calificados, pero qué se vende de verdad y qué opina la consultora de
  cada producto es lo que la diferencia de un catálogo genérico.

### 4. Diferido a propósito

Login, carrito, pagos y el sistema de estrellas. Cuando se construya el ledger de
estrellas, que sea **append-only**: cada movimiento una fila, el saldo se calcula
sumando. Nunca una columna de saldo mutable.

### 5. Legal, sin resolver

- Derechos de uso de las fotos y textos de las marcas.
- Si el contrato de consultora permite reventa en línea.

Es barato revisarlo ahora y caro después.

## Decisiones ya tomadas

No hace falta volver sobre esto salvo que cambien las circunstancias.

| Decisión | Por qué |
|---|---|
| **Avon fuera del lanzamiento** | Sin sitio del que sacar fotos (`avon.com.co` da 504 incluso desde IP residencial) y los nombres extraídos no son fiables: su maqueta rompe la reconstrucción por geometría. Los 130 productos extraídos siguen en `data/`, no se borró nada |
| **Precio de venta = precio de catálogo** | El margen vive en el descuento de consultora y no se le muestra al cliente |
| **El pedido se cierra por WhatsApp** | Sin carrito ni pagos por ahora, por decisión explícita |
| **Filtros y buscador sin JavaScript** | `<form method="GET">` y enlaces: más simple, sobrevive a mala conexión, lo indexa el buscador |
| **La URL de ficha lleva el código** | Sobrevive al cambio de ciclo y a que la marca renombre el producto |
| **PR en vez de commit directo** | El pipeline ya falló en silencio dos veces; el PR trae las cifras para poder mirarlas |
| **Tarea programada, no self-hosted runner** | El repo es **público**: un runner dejaría que cualquiera ejecute código en la máquina que lo hospede vía un PR desde un fork |

## Decisión pendiente

**Cómo se mantiene Natura al día.** `natura.com.co` responde 403 a toda IP de
datacenter, así que las fotos de Natura solo se pueden traer desde una conexión
residencial colombiana. `scripts/actualizar-campana.mjs --auto` ya está listo y
`docs/tarea-programada.md` explica cómo programarlo; falta decidir si se activa,
se corre a mano cada ciclo, o se resuelve de otro modo.

Mientras no se resuelva, Natura se queda congelada en el ciclo 13.

## Lo siguiente que rinde más

1. Llenar `lib/negocio.ts` y ver el sitio con datos reales. Es rápido y cambia
   por completo la sensación de lo que hay.
2. Escribir las tres políticas.
3. Dominio, `NEXT_PUBLIC_SITE_URL` y desplegar.
4. Mergear a `main` para que la automatización empiece a correr.

## Aviso con fecha

La campaña Yanbal C09 vencía el **11 de septiembre de 2026**. La C10 ya existe
(473 productos) pero cuando se probó, la tienda de Yanbal seguía sirviendo la
C09: enriquecerla dio 35 % de cobertura contra el 94 % de la vigente. Es el caso
de manual de "detectada no es vigente" (ver `CLAUDE.md`).

Hay un recordatorio automático para el 12 de septiembre que revisa si la
automatización corrió y, si no, hace el trabajo a mano.
