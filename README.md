# Alejandría

Tienda en línea de productos de venta directa (Yanbal y Natura) para Colombia.

## Estado

Aplicación en pie sobre datos reales: **792 productos** publicables (440 de Yanbal,
352 de Natura) con foto, precio y descripción salidos del pipeline de este mismo
repositorio. No hay carrito ni pagos —el pedido se cierra por WhatsApp— ni login ni
sistema de estrellas todavía; eso viene después.

**Avon queda fuera del lanzamiento.** La decisión y lo que costaría revertirla están
en [Avon: fuera por ahora](#avon-fuera-por-ahora).

## La aplicación

```bash
npm install
npm run dev            # desarrollo
npm run build && npm start
```

Next.js 16 (App Router), React 19, TypeScript y Tailwind v4. Sin base de datos: la
tienda lee los JSON que deja el pipeline, y `lib/productos.ts` es la única capa que
conoce ese formato —cuando haya base de datos, se reescribe ahí y nada más—.

| Ruta | Qué es |
|---|---|
| `/` | Landing: quién es la consultora, buscador, categorías y destacados |
| `/catalogo` | Catálogo completo con filtros por marca, categoría, stock y orden |
| `/producto/<marca>/<código>/<slug>` | Ficha, generada estáticamente para los 792 |
| `/politicas/{envios,devoluciones,privacidad}` | Políticas |
| `/sitemap.xml`, `/robots.txt` | Indexación |

Dos decisiones que conviene no deshacer sin querer:

- **Los filtros y el buscador funcionan sin JavaScript**, con `<form method="GET">`
  y enlaces. Es más simple, sobrevive a una conexión mala y lo indexa el buscador.
- **La URL de la ficha lleva el código**, no solo el nombre, así que sobrevive al
  cambio de ciclo y a que la marca renombre el producto. Es la razón de ser del
  `slug` estable que genera `normalizar.mjs`.

`lib/negocio.ts` concentra los datos del negocio —nombre, ciudad, WhatsApp, costo de
envío, ciudades con contraentrega—. **Hoy están en `[CORCHETES]` a propósito**: son
decisiones que no se pueden inventar, y el sitio muestra el corchete en vez de un
dato falso. Lo mismo con las reseñas y las notas de la consultora.

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

El método funciona con la maqueta de Natura, no con la de Avon: los precios y
códigos de Avon salen bien, pero **los nombres no** —ver
[Avon: fuera por ahora](#avon-fuera-por-ahora)—.

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

### Avon: fuera por ahora

**Avon no entra al lanzamiento.** La tienda solo carga Yanbal y Natura. Los datos
extraídos siguen en `data/avon-revista-avon-ciclo-13.json` y el extractor sigue
aceptando Avon: no hay nada que deshacer si más adelante se decide incluirla.

La razón no es una preferencia, son dos problemas que se suman:

**No hay sitio del que enriquecer**, y no por un bloqueo que se pueda sortear:

- `avon.com.co` devuelve **504** en todos los intentos, también desde una
  conexión residencial colombiana. No es un 403 ni un reto de JavaScript: no hay
  nada que responda al otro lado.
- `avon.co` sí responde, pero es el sitio institucional (ASP.NET/Kestrel): tiene
  historia de la marca y formulario de consultoras, y **cero precios y cero
  códigos** del catálogo. Solo enlaza de vuelta a la revista de
  `digital-catalogue.com`, que es de donde ya salen los datos.

**Y los nombres que sí se extrajeron no son de fiar.** La reconstrucción por
geometría que funciona con Natura no puede funcionar con la maqueta de Avon: el
código va *dentro* del párrafo del precio, y el nombre real vive en una banda al
pie, en otra columna, sin ninguna relación geométrica con su producto. No es un
ajuste de umbrales; es que la señal que usa el método no existe en esa maqueta.

Así que los 130 productos de Avon no tienen foto, ni descripción, ni stock, ni
nombre confiable. Publicar eso es peor que no publicarlo.

Para incluirla haría falta una de estas, y ninguna es gratis:

| Camino | Qué cuesta |
|---|---|
| Leer las páginas de la revista con un modelo de visión | Reescribir el extractor para Avon; hay que verificar producto por producto |
| Fotografiar y nombrar a mano los 130 | Trabajo manual por ciclo, no una sola vez |
| Que Avon abra un sitio con catálogo | No depende de nosotros |

### Actualización automática de campaña

```bash
npm run campana:detectar    # ¿hay campaña nueva publicada?
```

Las dos marcas numeran sus revistas de forma consecutiva, así que **no hace falta
que nadie pase la URL**: se pide el número siguiente y se mira si responde.

| Marca | Patrón |
|---|---|
| Yanbal | `docs.yanbal.com/cdigital/co/<año>/c<n>/oficial/` |
| Natura | `co.natura.digital-catalogue.com/co/<año>/<n>/revista/ciclo-<n>/view` |

**Las dos publican la campaña siguiente antes de que entre en vigencia.** El 5 de
septiembre de 2026, con la C09 corriendo hasta el 11, la C10 de Yanbal y el ciclo
14 de Natura ya respondían. Eso da margen para preparar los datos, pero también
significa que *detectada* no es *vigente*: publicar apenas aparece haría que el
sitio muestre precios que todavía no rigen.

`.github/workflows/campana.yml` corre esa detección a diario y, si hay novedad,
ejecuta el pipeline y **abre un PR** —no commitea directo—. El PR trae la tabla de
cobertura comparada contra la campaña vigente:

```bash
node scripts/verificar-cobertura.mjs <nuevo.json> <anterior.json> [--puntos 10]
```

Compara **porcentajes, no cantidades**: una campaña nueva legítimamente trae más o
menos productos, pero no tiene por qué bajar la proporción de los que llevan foto.
Si alguna medida cae más de 10 puntos porcentuales, el PR se marca con una
advertencia. No es paranoia: este pipeline ya terminó con código 0 y cara de éxito
dos veces mientras entregaba basura —un precio tachado leído como precio real, que
inventó descuentos del 45 %, y un merge que dejó 14 descripciones de 367—. Contar
antes y después es lo único que los delató.

El workflow también corre `npm run build` con los datos nuevos, así que un cambio
de formato en la fuente se cae en CI y no en producción.

#### Detectada no es lo mismo que procesable

La revista de la campaña nueva aparece días antes, pero **la tienda de la marca
sigue sirviendo la campaña vieja** — y la tienda es de donde salen las fotos.
Enriquecer contra una tienda que todavía no cambió da esto:

| | C09 (vigente) | C10 (detectada, tienda sin cambiar) |
|---|---|---|
| con foto | 442 (94 %) | 166 (**35 %**) |
| con descripción | 367 (78 %) | 98 (**21 %**) |
| publicables | 440 (94 %) | 166 (**35 %**) |

No es un bug del pipeline: la ficha de esos productos aún no existe en
`yanbal.com`. Por eso, **si la cobertura cae, el workflow no abre PR**: lo anota
en el resumen de la corrida y lo vuelve a intentar al día siguiente. Como el cron
es diario, el PR se abre solo el día que la tienda cambia de campaña, sin que
nadie tenga que estar pendiente.

#### Qué queda fuera del automatismo

| Tramo | ¿Corre en la nube? |
|---|---|
| Revista de Yanbal | ✅ |
| Tienda `yanbal.com` (fotos, stock) | ✅ |
| Revista de Natura | ✅ |
| Tienda `natura.com.co` (fotos, stock) | ❌ **403** |

`natura.com.co` rechaza toda IP de datacenter, y eso incluye a los runners de
GitHub. El workflow extrae la revista de Natura —precios y códigos sí se
alcanzan— pero **no toca el archivo que lee la tienda**, porque sustituir 352
productos con foto por 366 sin foto los sacaría a todos del sitio.

Ese tramo necesita una conexión residencial colombiana. Para eso está:

```bash
node scripts/actualizar-campana.mjs                 # lo que haya nuevo
node scripts/actualizar-campana.mjs --marca natura  # solo una marca
node scripts/actualizar-campana.mjs --forzar        # aunque no haya novedad
```

Corre el pipeline completo de las dos marcas en un solo comando, desde una
máquina que sí alcance los dos sitios. **Comprueba primero qué alcanza** y lo
dice antes de empezar, en vez de descubrirlo a mitad de camino y dejar los datos
a medias:

```
▸ Comprobando qué alcanza esta máquina

  ✓ Yanbal   https://www.yanbal.com/co/
  ✗ Natura   https://www.natura.com.co/
     HTTP 403
     natura.com.co bloquea las IPs de datacenter. Este paso necesita una
     conexión residencial colombiana — corre el script desde tu casa, no
     desde un servidor, una VPN extranjera ni un runner de GitHub.
```

No commitea ni pushea: deja los archivos, compara la cobertura y dice qué hacer.
Publicar es una decisión, no un paso del pipeline.

Con `--auto` sirve para una tarea programada: empuja una rama `datos/campana-*`
si la cobertura pasó, no empuja nada si cayó, y nunca toca `main`. Cómo
programarla en macOS, Linux o Windows está en
[docs/tarea-programada.md](docs/tarea-programada.md).

**Una tarea programada, no un *self-hosted runner*.** Un runner existe para que
GitHub le mande trabajo a tu máquina, y con este repositorio **público** esa
puerta la puede empujar cualquiera: un fork puede abrir un PR y ejecutar código
en tu computador. GitHub lo desaconseja explícitamente. Una tarea programada
hace lo mismo con solo conexiones salientes. Si el repo pasara a privado, el
runner deja de ser un problema y se puede reconsiderar.

### Normalización

```bash
node scripts/normalizar.mjs data/<marca>-<campaña>-enriquecido.json
```

Consolida el registro que consumirá la tienda y resuelve el nombre. **El nombre de
la revista no sirve como identidad**: está pensado para leerse dentro de una página
maquetada, donde la variante se entiende por el contexto visual. Fuera de ahí pierde
la mitad de la información —doce productos distintos se llaman "Crema nutritiva para
el cuerpo 400 ml"— y a veces captura un sello publicitario. El nombre del sitio de la
marca sí es un identificador completo, así que manda cuando existe.

| | Nombres repetidos |
|---|---|
| Natura, nombre de la revista | 180 productos |
| Natura, nombre del sitio | **1 producto** |

Genera además el `slug` estable para la URL —`/p/<código>/<slug>`, que sobrevive al
cambio de ciclo— y marca `publicable` los que tienen nombre, foto y precio.

Resultado: **Natura 352 publicables de 366 (96 %)**, **Yanbal 440 de 468 (94 %)**.

### Clasificación por categoría

```bash
node scripts/clasificar.mjs data/<marca>-<campaña>-normalizado.json
```

Las revistas no publican la categoría, y el campo `categoria` que trae el sitio de
Natura son etiquetas de campaña —`aniversario` ×100, `carrito20`, `2x1`—, no una
taxonomía. Hay que derivarla del nombre.

**Lo que decide el resultado es el orden de las reglas**, porque un nombre dispara
varias y gana la primera:

| Nombre | Cae en | Y no en |
|---|---|---|
| Base **antiedad** | Maquillaje | Cuidado facial |
| **Crema** para peinar | Cabello | Cuidado corporal |
| Desodorante **perfumado** roll on | Desodorantes | Perfumería |
| **Set** Cielo: perfume + jabón + desodorante | Sets y regalos | Desodorantes |
| **Set** Collares Aimee | Joyería | Sets y regalos |

Los dos últimos son la misma palabra resuelta distinto: un set que **enumera**
productos de varias categorías no pertenece a ninguna, y por eso la regla de sets
exige el separador (`:` o `+`); un set de una sola categoría se queda en la suya.

Cuando ninguna palabra clave coincide entra un respaldo por **línea de producto**
—Lumina es cabello, Chronos facial, Essencial perfumería— pero solo para las líneas
cuya categoría domina por encima del 70 % en los datos reales. Tododia y Ekos quedan
fuera a propósito: reparten entre corporal y cabello, y adivinar ahí ensucia más de
lo que arregla. Lo asignado así queda marcado con `origenCategoria: "linea"` para
poder revisarlo aparte.

Resultado: **804 de 829 productos (96 %)** en 11 categorías. Los ~25 restantes y los
10 asignados por línea son la revisión manual de cada ciclo — media hora, no un
proyecto.

Ojo con los plurales al ampliar las reglas: `\bpolvo\b` no captura "Polvos
Compactos" y `\bcollar\b` no captura "Set Collares". Los tres primeros errores que
encontré al verificar por muestreo eran exactamente eso.

## Decisiones tomadas

- **Precio de venta = precio de catálogo**, por ahora. El margen vive en el
  descuento de consultora y no se le muestra al cliente. El modelo de datos igual
  separa precio de referencia y precio de venta.
- **El precio no es el diferencial**: la marca fija el costo y compite con su
  propia tienda. La ventaja tiene que estar en servicio, contraentrega y fidelización.

## Pendientes

Para abrir la tienda:

- Llenar los `[CORCHETES]` de `lib/negocio.ts` —nombre, ciudad, WhatsApp, costo de
  envío, ciudades con contraentrega— y el texto de las tres políticas.
- Foto de la consultora para la portada.

Del catálogo:

- Fotos propias para los 26 productos de Yanbal y los 14 de Natura que los
  sitios no publican.
- Revisar los productos de Natura con `similitud` baja: el código empareja bien,
  pero el nombre que trae la revista es una frase de publicidad.
- Verificar el descuento de consultora por marca y calcular márgenes reales.
- Revisar derechos de uso de imágenes y textos de las marcas, y las cláusulas de
  reventa en línea del contrato de consultora.
