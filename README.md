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
node scripts/indexar-yanbal.mjs                              # primero el índice
node scripts/enrich-yanbal.mjs data/yanbal-col-2026-c09.json # luego el cruce
```

El sitio de Yanbal ofrece dos fuentes, y son complementarias:

| Fuente | Qué da | Límite |
|---|---|---|
| Índice de categorías | Foto (hasta 2 ángulos), precio y precio tachado | Sin descripción ni stock |
| Autocompletado del buscador | Descripción, resumen y estado de stock | Devuelve máximo 4 resultados |

`indexar-yanbal.mjs` recorre las 121 categorías del menú paginándolas y deja
`data/yanbal-sitio-indice.json` con **449 productos**. Es exhaustivo y local, así
que resuelve las familias numerosas que el autocompletado nunca alcanza: hay 31
collares en el catálogo y buscar "collar" solo enseña cuatro.

Resultado sobre la C09: **442 de 468 productos (94 %)** con foto, 367 con
descripción, 220 con dos ángulos y 426 con precio tachado.

Cuatro cosas que cuestan caro si se ignoran:

- **El autocompletado devuelve máximo 4 resultados.** La consulta tiene que ser
  específica o el producto correcto ni siquiera aparece entre los candidatos.
- La búsqueda es difusa y razona por token: la palabra de categoría arrastra
  resultados de toda la categoría. Por eso se generan **todas las ventanas de dos
  palabras consecutivas**, no solo las de los extremos: en "Delineador Punta
  Inteligente Negro" la única consulta que acierta es "punta inteligente".
- **En el listado de categoría hay dos precios.** `--priceBefore` es el tachado y
  `--discountPrice` el que se cobra; coger el primero que aparezca da el tachado y
  falsea toda comparación contra el catálogo. Con el precio correcto, **399 de 400
  productos coinciden exactamente** con el precio del catálogo.
- **El precio valida el emparejamiento**, no solo lo desempata. Dentro de una
  colección de joyería los nombres se parecen demasiado ("Collar Amira" contra
  "Collar Amira Cristal") y solo el precio distingue la pieza.

De los 442 con foto, **7 llevan `fotoDeLinea`**: varias entradas del catálogo
apuntan a una sola ficha porque son variantes —las letras de un dije, los tonos de
un corrector— y la foto no distingue cuál. Los 26 sin foto son empaques y
variantes de maquillaje que el sitio no publica; esos necesitan fotografía propia.

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

### Enriquecimiento de Natura desde el sitio público

```bash
node scripts/indexar-natura.mjs                                  # primero el índice
node scripts/enrich-natura.mjs data/natura-revista-ciclo-13.json # luego el cruce
```

Mismo patrón que Yanbal —un índice del sitio para foto y precio, una segunda
fuente para descripción y stock— pero el emparejamiento es mucho más firme: el
código que la revista imprime entre paréntesis **es** el identificador del
sitio, y `/p/<slug>/NATCOL-<código>` responde con cualquier slug. Así que no hay
que adivinar qué ficha corresponde a qué producto; hay que comprobar que el
sitio devolvió lo que se le pidió, y para eso está el `canonical`.

| Fuente | Qué da | Límite |
|---|---|---|
| Índice de categorías | Foto (hasta 2 ángulos), precio, precio tachado y stock | Sin descripción; solo cubre 170 de los 366 |
| Ficha del producto | Descripción, nombre canónico, precio y stock | Una sola foto; una petición por producto |

`indexar-natura.mjs` recorre las 177 categorías del menú y deja
`data/natura-sitio-indice.json` con **378 productos**. No es opcional ni
sustituible por un buscador: en natura.com.co **el buscador está bloqueado**.

Resultado sobre el ciclo 13: **352 de 366 productos (96 %)** con foto, 351 con
descripción, 129 con dos ángulos. Los 14 restantes dan 404 en el sitio —son de
revista, no de tienda—. Confianza alta en 289, media en 55 y baja en 8.

Cuatro cosas que cuestan caro si se ignoran:

- **Akamai responde "Access Denied" con status 200.** Las rutas de API que
  probaría cualquiera —`/api/catalog_system/...`, `/busca`, `/search`, el
  autocompletado— devuelven todas el mismo cuerpo de 2.629 bytes con un 200
  encima. Mirar el código de respuesta no basta: hay que mirar el cuerpo.
- **Sin las cabeceras `Sec-Fetch-*` la portada responde 403.** Con ellas, 200.
- **En el JSON del sitio hay dos precios, y el nombre engaña.** `price.sales` es
  lo que se cobra y `price.list` el tachado, que vale `null` si no hay
  descuento. Peor todavía en `variations[].price`: ahí el tachado se llama
  `listPrice` y vale **0** cuando no hay descuento, así que tomarlo como precio
  da un producto de cero pesos.
- **La ficha cuelga vitrinas de productos similares con sus propios precios.**
  Anclarse en la posición del texto —"el precio más cercano al nombre"— lee el
  precio de otro producto: el del principal puede estar a cuatro mil caracteres.
  La variación se identifica por `productId` *y* por que su `salePrice` sea el
  que ya publicó el JSON-LD; si no concuerdan, se descarta el tachado. Un
  tachado equivocado es peor que ninguno, porque inventa un descuento que no
  existe.

**El precio confirma el emparejamiento**, como en Yanbal, pero aquí hay que
compararlo contra los dos: **329 de 352 (93 %)** coinciden con el precio de
venta o con el tachado —209 con el de venta, 120 con el tachado, porque el sitio
trae en oferta lo que la revista publica a precio de lista—.

De los 23 que no cuadran contra ninguno, 14 caen en razones limpias de 0,80,
0,75 y 0,70: son descuentos de la revista del ciclo que el sitio no tiene. El
resto son productos donde el extractor de la revista falló —capturó como nombre
una frase de publicidad ("LANZAMIENTO", "Con acción antidaños") y con ella un
precio que no era—. Por eso conviene preferir `nombreSitio` sobre `nombre`
cuando `similitud` es baja.

### Avon: sin fuente

No se pudo enriquecer, y no por un bloqueo que se pueda sortear:

- `avon.com.co` devuelve **504** en todos los intentos, también desde una
  conexión residencial colombiana. No es un 403 ni un reto de JavaScript: no hay
  nada que responda al otro lado.
- `avon.co` sí responde, pero es el sitio institucional (ASP.NET/Kestrel): tiene
  historia de la marca y formulario de consultoras, y **cero precios y cero
  códigos** del catálogo. Solo enlaza de vuelta a la revista de
  `digital-catalogue.com`, que es de donde ya salen los datos.

Los 130 productos de `data/avon-revista-avon-ciclo-13.json` se quedan sin foto,
descripción ni stock hasta que aparezca otra fuente.

## Decisiones tomadas

- **Precio de venta = precio de catálogo**, por ahora. El margen vive en el
  descuento de consultora y no se le muestra al cliente. El modelo de datos igual
  separa precio de referencia y precio de venta.
- **El precio no es el diferencial**: la marca fija el costo y compite con su
  propia tienda. La ventaja tiene que estar en servicio, contraentrega y fidelización.

## Pendientes

- Fotos propias para los 26 productos de Yanbal y los 14 de Natura que los
  sitios no publican.
- Fuente de fotos y descripciones para Avon: hoy no hay ninguna.
- Revisar los productos de Natura con `similitud` baja: el código empareja bien,
  pero el nombre que trae la revista es una frase de publicidad.
- Verificar el descuento de consultora por marca y calcular márgenes reales.
- Revisar derechos de uso de imágenes y textos de las marcas, y las cláusulas de
  reventa en línea del contrato de consultora.
