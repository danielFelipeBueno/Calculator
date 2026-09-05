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

Resultado sobre la C09: **367 de 468 productos (78 %)** con foto, descripción y
disponibilidad — 328 de confianza alta, 39 media.

De esos 367, **274 tienen foto del producto exacto** y **93 tienen foto de línea**:
varias entradas del catálogo apuntan a una sola ficha del sitio porque son
variantes —las 23 letras de un dije, los tonos de un corrector—. El emparejamiento
es correcto, pero la foto no distingue la variante, así que van marcados con
`fotoDeLinea` para que la ficha pueda advertirlo.

Tres detalles del emparejamiento:

- **El endpoint devuelve máximo 4 resultados.** La consulta tiene que ser
  específica o el producto correcto ni siquiera aparece entre los candidatos.
- La búsqueda es difusa y razona por token: la palabra de categoría arrastra
  resultados de toda la categoría. Por eso se generan **todas las ventanas de dos
  palabras consecutivas**, no solo las de los extremos: en "Delineador Punta
  Inteligente Negro" la única consulta que acierta es "punta inteligente", que
  está en el medio.
- **El precio valida el emparejamiento, no solo lo desempata.** Dentro de una misma
  colección de joyería los nombres se parecen demasiado ("Collar Amira" contra
  "Collar Amira Cristal") y solo el precio distingue la pieza. Sin esa regla el
  75 % sube a 81 %, pero con fotos equivocadas.

Los 115 sin emparejar son sobre todo joyería y empaques que no existen en el sitio
público; esos necesitan fotografía propia.

### Natura y Avon

Corren sobre `digital-catalogue.com`, que no publica datos estructurados: solo una
capa de texto por página, palabra a palabra y con coordenadas.

```bash
node scripts/extract-natura.mjs                     # Natura, ciclo vigente
node scripts/extract-natura.mjs <url-revista> Avon  # Avon
```

Los productos se reconstruyen por geometría: un párrafo de nombre y, debajo y en
la misma columna, un párrafo de datos con el código entre paréntesis.

```
Shampoo restauración 300 ml           <- nombre   (y=585, x=40)
(167286) 7 pts $ 40.500 ml a $ 135    <- datos    (y=612, x=40)
```

Con descuento los datos se parten en `de $ 33.500` (lista) y `a 25.100 $` (oferta).
Se descartan los precios unitarios, que llevan coma decimal, y los sellos
promocionales ("20 % de descuento"), que compiten con el nombre por estar en la
misma columna.

Resultado del ciclo 13: **Natura 366 productos**, **Avon 130**. Verificado a mano
contra la página 36 de Natura: 7 de 7 con código, puntos, precio y descuento
correctos. Ninguna de las dos marcas expone fotos ni stock por esta vía.

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
