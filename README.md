# Alejandría

Tienda en línea de productos de venta directa (Yanbal, Natura, Avon) para Colombia.

## Estado

En investigación. Todavía no hay aplicación: por ahora el repositorio contiene el
pipeline de ingesta de catálogos, que es la pieza que valida si el proyecto es viable.

## Extracción de catálogos

### Yanbal

Los catálogos de Yanbal corren sobre iPaper y publican sus productos ya
estructurados —código, nombre y precio— en archivos de *enrichments*.
No hace falta OCR ni parseo de texto.

```bash
node scripts/extract-yanbal.mjs [url-del-flipbook]
```

Deja `data/yanbal-<campaña>.json` y `.csv`. Sin dependencias; requiere Node 18+.

La campaña C09 de 2026 da **468 SKUs únicos** entre $3.000 y $374.900.

**Las URLs de los enrichments vienen firmadas y expiran en ~24 h.** Cada corrida
relee el HTML del flipbook para obtenerlas frescas. No las caches.

El catálogo no trae fotos ni descripciones: el campo `aws` del hotspot es el ícono
del carrito, igual para todos. Eso lo resuelve el paso siguiente.

### Enriquecimiento desde el sitio público

```bash
node scripts/enrich-yanbal.mjs data/yanbal-col-2026-c09.json
```

El buscador de `yanbal.com` expone un endpoint de autocompletado que devuelve JSON
con **foto (hasta 500x500), descripción, resumen, precio y estado de stock**. El
script cruza cada producto del catálogo contra él.

Resultado sobre la C09: **353 de 468 productos (75 %)** con foto, descripción y
disponibilidad — 311 de confianza alta, 42 media.

Dos detalles del emparejamiento:

- La búsqueda es difusa y razona por token: mandarle el nombre completo trae ruido
  porque "Yanbal" domina el ranking. Por eso se prueban varias consultas cortas
  por producto y se agrupan los candidatos.
- **El precio valida el emparejamiento, no solo lo desempata.** Dentro de una misma
  colección de joyería los nombres se parecen demasiado ("Collar Amira" contra
  "Collar Amira Cristal") y solo el precio distingue la pieza. Sin esa regla el
  75 % sube a 81 %, pero con fotos equivocadas.

Los 115 sin emparejar son sobre todo joyería y empaques que no existen en el sitio
público; esos necesitan fotografía propia.

### Natura y Avon

Pendiente. Corren sobre `digital-catalogue.com` y exponen una capa de texto por
página (palabra a palabra, con coordenadas) en
`.../view/common/data/<página>.json`. Extraer productos ahí requiere agrupar por
`paragraph_id` y posición: bastante más trabajo que Yanbal.

## Decisiones tomadas

- **Precio de venta = precio de catálogo**, por ahora. El margen vive en el
  descuento de consultora y no se le muestra al cliente. El modelo de datos igual
  separa precio de referencia y precio de venta.
- **El precio no es el diferencial**: la marca fija el costo y compite con su
  propia tienda. La ventaja tiene que estar en servicio, contraentrega y fidelización.

## Pendientes

- Fotos propias para los 115 productos sin emparejar (joyería y empaques).
- Adaptador de Natura y Avon.
- Verificar el descuento de consultora por marca y calcular márgenes reales.
- Revisar derechos de uso de imágenes y textos de las marcas, y las cláusulas de
  reventa en línea del contrato de consultora.
