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

Dos cosas a tener en cuenta:

- **Las URLs de los enrichments vienen firmadas y expiran en ~24 h.** Cada corrida
  relee el HTML del flipbook para obtenerlas frescas. No las caches.
- **No hay fotos de producto.** El campo `aws` del hotspot es el ícono del carrito,
  igual para todos los productos. Las fotos hay que resolverlas por otra vía.

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

- Fotos de producto para Yanbal.
- Adaptador de Natura y Avon.
- Verificar el descuento de consultora por marca y calcular márgenes reales.
- Revisar derechos de uso de imágenes y textos de las marcas, y las cláusulas de
  reventa en línea del contrato de consultora.
