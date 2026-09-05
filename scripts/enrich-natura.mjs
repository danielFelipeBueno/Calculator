#!/usr/bin/env node
// Enriquece un catálogo de revista de Natura con los datos del sitio público.
//
// Es el equivalente de enrich-yanbal.mjs, pero el emparejamiento es mucho más
// firme: el código que la revista imprime entre paréntesis es el mismo que el
// sitio usa como identificador, y `/p/<slug>/NATCOL-<código>` responde con
// cualquier slug. O sea que no hay que adivinar qué ficha corresponde a qué
// producto —como sí toca en Yanbal, donde el buscador devuelve cuatro
// candidatos y hay que elegir— sino comprobar que el sitio devolvió lo que se
// le pidió.
//
//   node scripts/enrich-natura.mjs [data/natura-revista-ciclo-13.json]
//
// Dos fuentes complementarias, como en Yanbal:
//   · el índice de categorías -> hasta dos fotos, precio tachado y stock
//   · la ficha del producto    -> descripción, nombre canónico y precio
// Ninguna sustituye a la otra: la ficha trae una sola foto y el índice no trae
// descripción, y hay productos de la revista que no están en ninguna categoría.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SITIO, pedir, fichaDe, tachadoEnFicha, sleep, mapLimit } from "./natura-sitio.mjs";

const CONCURRENCIA = 4;
const PAUSA_MS = 200;

// La revista y el sitio son dos canales con promociones distintas, así que el
// precio no siempre coincide aunque el producto sea el mismo. Sirve para
// confirmar, no para descartar: por eso convive con la similitud de nombre.
const TOLERANCIA_PRECIO = 0.02;

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Palabras que no distinguen un producto de otro dentro del catálogo.
const GENERICOS = new Set([
  "natura", "de", "del", "la", "el", "los", "las", "y", "en", "con", "para",
  "ml", "g", "gr", "un", "una", "al", "por", "kit", "refill", "repuesto",
]);

const tokens = (s) => norm(s).split(" ").filter((t) => t && !GENERICOS.has(t));

/** Jaccard sobre conjuntos de tokens: 1 = idénticos, 0 = sin nada en común. */
function similitud(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const t of A) if (B.has(t)) comunes++;
  return comunes / (A.size + B.size - comunes);
}

/**
 * Decide cuánto se puede confiar en el emparejamiento.
 *
 * El código ya identifica al producto, así que lo que se comprueba aquí es que
 * no sea un código mal leído de la revista que por casualidad exista en el
 * sitio. Dos señales independientes lo confirman —el nombre y el precio— y
 * basta con que una sea fuerte, porque la revista falla en ambas por su cuenta:
 * el extractor a veces recoge como nombre una línea de publicidad, y el sitio
 * corre descuentos que la revista del ciclo no tiene.
 */
function confianzaDe(sim, difPrecio) {
  const precioOk = difPrecio != null && difPrecio <= TOLERANCIA_PRECIO;
  if (sim >= 0.5 && precioOk) return "alta";
  if (sim >= 0.5) return "alta";
  if (precioOk && sim >= 0.2) return "alta";
  if (precioOk) return "media";
  if (sim >= 0.25) return "media";
  return "baja";
}

async function cargarIndice() {
  try {
    const ruta = resolve(process.cwd(), "data", "natura-sitio-indice.json");
    const productos = JSON.parse(await readFile(ruta, "utf8")).productos ?? [];
    console.log(`Índice del sitio: ${productos.length} productos`);
    return new Map(productos.map((p) => [p.codigo, p]));
  } catch {
    console.log("Sin índice local del sitio; corre antes indexar-natura.mjs para tener fotos y precio tachado.");
    return new Map();
  }
}

let bloqueos = 0;

async function enriquecer(producto, indice) {
  const delIndice = indice.get(producto.codigo) ?? null;

  const r = await pedir(`${SITIO}/p/x/NATCOL-${producto.codigo}`);
  await sleep(PAUSA_MS);
  if (r.bloqueado) bloqueos++;
  const ficha = r.status === 200 ? fichaDe(r.html) : null;

  // El canonical dice a qué producto resolvió el sitio de verdad. Si no es el
  // que se pidió, el emparejamiento no vale aunque la página haya respondido.
  const fichaValida = ficha && ficha.codigo === producto.codigo ? ficha : null;
  const fichaDesviada = ficha && ficha.codigo !== producto.codigo ? ficha.codigo : null;

  if (!delIndice && !fichaValida) {
    return {
      ...producto,
      confianza: null,
      enSitio: false,
      motivo: fichaDesviada ? `el sitio resolvió a NATCOL-${fichaDesviada}` : `sin ficha (status ${r.status})`,
    };
  }

  const nombreSitio = fichaValida?.nombre ?? delIndice?.nombre ?? null;
  // El precio del sitio sale de `price.sales` en el índice y de `offers.price`
  // en la ficha; los dos son ya el precio cobrado, nunca el tachado. Sobre una
  // muestra de 50 productos presentes en las dos fuentes coinciden en los 50.
  const precioSitio = delIndice?.precio ?? fichaValida?.precio ?? null;
  // El tachado solo lo publica el índice; para los productos que no están en
  // ninguna categoría hay que sacarlo del stream de la ficha. Sin él, un
  // producto que la revista trae a precio de lista y el sitio tiene en oferta
  // se contaría como discrepancia de precio sin serlo.
  const precioLista =
    delIndice?.precioLista ??
    (fichaValida ? tachadoEnFicha(r.html, producto.codigo, fichaValida.precio) : null);

  const sim = similitud(producto.nombre, nombreSitio);
  const difPrecio =
    precioSitio != null && producto.precio
      ? Math.abs(precioSitio - producto.precio) / producto.precio
      : null;
  // La revista puede coincidir con el precio tachado cuando el sitio está en
  // oferta y ella no: también cuenta como confirmación del emparejamiento.
  const difLista =
    precioLista != null && producto.precio
      ? Math.abs(precioLista - producto.precio) / producto.precio
      : null;
  const mejorDif = [difPrecio, difLista].filter((d) => d != null).sort((a, b) => a - b)[0] ?? null;

  const imagenes = [...new Set([...(delIndice?.imagenes ?? []), ...(fichaValida?.imagenes ?? [])])];

  return {
    ...producto,
    confianza: confianzaDe(sim, mejorDif),
    similitud: Number(sim.toFixed(2)),
    enSitio: true,
    fuentes: [delIndice && "indice", fichaValida && "ficha"].filter(Boolean),
    nombreSitio,
    sitioUrl: fichaValida?.url ?? delIndice?.url ?? null,
    descripcion: fichaValida?.descripcion ?? null,
    marca: fichaValida?.marca ?? delIndice?.marca ?? null,
    categoria: delIndice?.categoria ?? fichaValida?.categoria ?? null,
    precioSitio,
    precioListaSitio: precioLista,
    descuentoSitioPct: delIndice?.descuentoPct ?? null,
    // Se guardan los dos hechos por separado para no confundir "no coincide"
    // con "no se pudo comparar".
    precioCoincide: difPrecio == null ? null : difPrecio <= TOLERANCIA_PRECIO,
    difPrecioPct: difPrecio == null ? null : Number((difPrecio * 100).toFixed(1)),
    disponible: delIndice?.disponible ?? fichaValida?.disponible ?? null,
    calificacion: fichaValida?.calificacion ?? delIndice?.calificacion ?? null,
    imagenes: { principal: imagenes[0] ?? null, adicionales: imagenes.slice(1) },
  };
}

async function main() {
  const ruta = resolve(process.cwd(), process.argv[2] ?? "data/natura-revista-ciclo-13.json");
  const cat = JSON.parse(await readFile(ruta, "utf8"));
  const indice = await cargarIndice();

  console.log(`Cruzando ${cat.productos.length} productos contra ${SITIO}\n`);

  let hechos = 0;
  const productos = await mapLimit(cat.productos, CONCURRENCIA, async (p) => {
    const r = await enriquecer(p, indice);
    if (++hechos % 50 === 0) console.log(`  ${hechos}/${cat.productos.length}`);
    return r;
  });

  if (bloqueos > 0) {
    console.log(`\n  Atención: ${bloqueos} fichas respondieron con bloqueo de Akamai.`);
  }

  const con = (f) => productos.filter(f).length;
  const pct = (n) => `${((n / productos.length) * 100).toFixed(0)} %`;
  const comparables = productos.filter((p) => p.precioCoincide != null);

  const salida = ruta.replace(/\.json$/, "-enriquecido.json");
  await writeFile(salida, JSON.stringify({ ...cat, enriquecido: true, sitio: SITIO, productos }, null, 2));

  console.log(`\n  En el sitio: ${con((p) => p.enSitio)} de ${productos.length} (${pct(con((p) => p.enSitio))})`);
  console.log(`  Confianza: alta ${con((p) => p.confianza === "alta")} · media ${con((p) => p.confianza === "media")} · baja ${con((p) => p.confianza === "baja")} · sin match ${con((p) => !p.confianza)}`);
  console.log(`  Con foto:        ${con((p) => p.imagenes?.principal)} (${pct(con((p) => p.imagenes?.principal))})`);
  console.log(`  Con dos fotos:   ${con((p) => p.imagenes?.adicionales?.length)}`);
  console.log(`  Con descripción: ${con((p) => p.descripcion)} (${pct(con((p) => p.descripcion))})`);
  console.log(`  Agotados en el sitio: ${con((p) => p.disponible === false)}`);
  console.log(`  Precio revista = precio sitio: ${con((p) => p.precioCoincide === true)} de ${comparables.length} comparables`);
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
