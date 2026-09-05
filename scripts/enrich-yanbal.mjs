#!/usr/bin/env node
// Enriquece el catálogo extraído de Yanbal con los datos del sitio público.
//
// El buscador de yanbal.com expone un endpoint de autocompletado que devuelve JSON
// con descripción, precio, estado de stock e imágenes. Es una búsqueda difusa que
// razona por token: mandarle el nombre completo trae ruido (el token "Yanbal" domina),
// así que por cada producto se prueban varias consultas cortas y se elige el mejor
// candidato por similitud de nombre, confirmada con el precio — que el catálogo y el
// sitio publican igual.
//
//   node scripts/enrich-yanbal.mjs [data/yanbal-<campaña>.json]

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SITE = "https://www.yanbal.com";
const AUTOCOMPLETE = `${SITE}/co/corporate/search/autocomplete/SearchBox?term=`;
const CONCURRENCY = 4;
const PAUSE_MS = 120;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Tokens demasiado comunes para distinguir un producto en la búsqueda.
const GENERICOS = new Set([
  "yanbal", "de", "del", "la", "el", "los", "las", "y", "en", "con", "para",
  "eau", "parfum", "edp", "edt", "ml", "g", "gr",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokens = (s) => norm(s).split(" ").filter(Boolean);

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
 * Consultas candidatas, de más a menos distintiva.
 *
 * El endpoint devuelve como máximo 4 resultados, así que la consulta tiene que
 * ser específica o el producto correcto ni siquiera aparece. Y es difusa por
 * token: la palabra de categoría ("Delineador") arrastra resultados de toda la
 * categoría y desplaza al producto buscado.
 *
 * Por eso se generan TODAS las ventanas de dos palabras consecutivas, no solo
 * las de los extremos: en «Delineador Punta Inteligente Negro» la única que
 * acierta es «punta inteligente», que está en el medio.
 */
function consultas(nombre) {
  const t = tokens(nombre);
  const distintivos = t.filter((w) => !GENERICOS.has(w) && w.length > 2);
  const base = distintivos.length ? distintivos : t;

  const bigramas = [];
  for (let i = 0; i + 1 < base.length; i++) bigramas.push(base.slice(i, i + 2).join(" "));

  // Las ventanas del medio y del final discriminan más que la inicial, que
  // suele ser la categoría del producto.
  bigramas.sort((a, b) => base.indexOf(b.split(" ")[0]) - base.indexOf(a.split(" ")[0]));

  const out = [...bigramas, base.join(" ")];
  if (base.length >= 3) out.push(base.slice(0, 3).join(" "));
  if (base.length) {
    out.push(base[base.length - 1]);
    out.push(base[0]);
  }
  return [...new Set(out)].slice(0, 8);
}

/**
 * Índice local del sitio, si existe (lo construye indexar-yanbal.mjs).
 * Se consulta ANTES que el autocompletado porque es exhaustivo —el
 * autocompletado devuelve máximo 4 resultados— y no cuesta peticiones.
 */
let indice = [];
async function cargarIndice() {
  try {
    const ruta = resolve(process.cwd(), "data", "yanbal-sitio-indice.json");
    indice = JSON.parse(await readFile(ruta, "utf8")).productos ?? [];
    console.log(`Índice del sitio: ${indice.length} productos\n`);
  } catch {
    console.log("Sin índice local del sitio; corre antes indexar-yanbal.mjs para mejorar la cobertura.\n");
  }
}

/** Adapta una entrada del índice a la forma que devuelve el autocompletado. */
function comoCandidato(e) {
  return {
    code: e.codigo,
    name: e.nombre,
    url: e.url ? e.url.replace(`${SITE}/co/corporate`, "") : null,
    description: null,
    summary: null,
    price: e.precio != null ? { value: e.precio } : null,
    stock: null,
    images: (e.imagenes ?? []).map((u) => ({ format: "zoom", url: u.replace(SITE, "") })),
    precioLista: e.precioLista ?? null,
    delIndice: true,
  };
}

const cache = new Map();
async function buscar(term) {
  if (cache.has(term)) return cache.get(term);
  let productos = [];
  try {
    const res = await fetch(AUTOCOMPLETE + encodeURIComponent(term), {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (res.ok) productos = (await res.json()).products ?? [];
  } catch {
    /* una consulta fallida no invalida las demás */
  }
  cache.set(term, productos);
  await sleep(PAUSE_MS);
  return productos;
}

/**
 * Elige el mejor candidato y le asigna confianza.
 *
 * El precio VALIDA el emparejamiento, no solo desempata: dentro de una misma
 * colección los nombres se parecen mucho ("Collar Amira" contra "Collar Amira
 * Cristal") y solo el precio distingue la pieza correcta. Un desvío grande de
 * precio con nombres no idénticos se descarta — una foto equivocada es peor
 * que ninguna foto.
 */
const TOLERANCIA_PRECIO = 0.02; // el catálogo y el sitio publican el mismo valor

function elegir(producto, candidatos) {
  let mejor = null;
  for (const c of candidatos) {
    const sim = similitud(producto.nombre, c.name);
    const precio = c.price?.value;
    const desvio =
      precio != null && producto.precio
        ? Math.abs(precio - producto.precio) / producto.precio
        : null;
    const precioOk = desvio != null && desvio <= TOLERANCIA_PRECIO;

    let confianza = null;
    if (sim === 1 && (desvio == null || desvio <= 0.1)) confianza = "alta";
    else if (precioOk && sim >= 0.6) confianza = "alta";
    else if (precioOk && sim >= 0.35) confianza = "media";
    else if (sim >= 0.85 && desvio != null && desvio <= 0.1) confianza = "media";
    if (!confianza) continue;

    const rank = { alta: 3, media: 2 }[confianza] + sim;
    if (!mejor || rank > mejor.rank) mejor = { c, confianza, sim, rank };
  }
  return mejor;
}

function imagenes(c) {
  if (!c) return { thumb: null, card: null, grande: null, adicionales: [] };
  const url = (f) => {
    const im = (c.images ?? []).find((i) => i.format === f);
    return im ? SITE + im.url : null;
  };
  const todas = (c.images ?? []).filter((i) => i.format === "zoom").map((i) => SITE + i.url);
  return {
    thumb: url("thumbnail"),
    card: url("product"),
    grande: url("zoom"),
    // El índice del sitio trae hasta dos ángulos por producto.
    adicionales: todas.slice(1),
  };
}

/**
 * Las dos fuentes son complementarias y hay que consultar ambas:
 *   · el índice del sitio  -> fotos (hasta dos ángulos) y precio tachado
 *   · el autocompletado    -> descripción, resumen y estado de stock
 * Ninguna sustituye a la otra.
 */
async function enriquecer(producto) {
  const desdeIndice = elegir(
    producto,
    indice.filter((e) => e.nombre).map(comoCandidato),
  );

  const pool = new Map();
  for (const term of consultas(producto.nombre)) {
    for (const c of await buscar(term)) pool.set(c.code, c);
    // Un empate perfecto de nombre y precio no mejora consultando más.
    const parcial = elegir(producto, [...pool.values()]);
    if (parcial?.confianza === "alta" && parcial.sim === 1) break;
  }

  const desdeBusqueda = elegir(producto, [...pool.values()]);
  if (!desdeIndice && !desdeBusqueda) return { ...producto, confianza: null };
  return armar(producto, desdeIndice, desdeBusqueda);
}

function armar(producto, porIndice, porBusqueda) {
  const mejor = porIndice && porBusqueda
    ? (porIndice.sim >= porBusqueda.sim ? porIndice : porBusqueda)
    : (porIndice ?? porBusqueda);

  const ind = porIndice?.c;
  const bus = porBusqueda?.c;
  // Las fotos del índice traen más ángulos; si falta, sirven las del buscador.
  const fotos = imagenes(ind?.images?.length ? ind : bus);

  const fuentes = [porIndice && "indice", porBusqueda && "autocompletado"].filter(Boolean);

  return {
    ...producto,
    confianza: mejor.confianza,
    similitud: Number(mejor.sim.toFixed(2)),
    fuentes,
    sitioCodigo: (ind ?? bus).code,
    sitioUrl: (ind?.url ?? bus?.url) ? `${SITE}/co/corporate${ind?.url ?? bus.url}` : null,
    descripcion: bus?.description ?? null,
    resumen: bus?.summary ?? null,
    precioSitio: (bus ?? ind)?.price?.value ?? null,
    precioListaSitio: ind?.precioLista ?? null,
    disponible: bus?.stock?.stockLevelStatus?.code ?? null,
    imagenes: fotos,
  };
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function main() {
  const ruta = resolve(process.cwd(), process.argv[2] ?? "data/yanbal-col-2026-c09.json");
  const cat = JSON.parse(await readFile(ruta, "utf8"));

  await cargarIndice();
  console.log(`Cruzando ${cat.productos.length} productos contra ${SITE}\n`);

  let hechos = 0;
  const productos = await mapLimit(cat.productos, CONCURRENCY, async (p) => {
    const r = await enriquecer(p);
    if (++hechos % 100 === 0) console.log(`  ${hechos}/${cat.productos.length}`);
    return r;
  });

  // Varias entradas del catálogo pueden apuntar a una sola ficha del sitio:
  // las 23 letras de un dije, los tonos de un corrector. El emparejamiento es
  // correcto, pero la foto es de la línea y no de la variante concreta — la
  // ficha tiene que poder advertirlo.
  const usos = new Map();
  for (const p of productos) {
    if (p.sitioCodigo) usos.set(p.sitioCodigo, (usos.get(p.sitioCodigo) ?? 0) + 1);
  }
  for (const p of productos) {
    if (p.sitioCodigo && usos.get(p.sitioCodigo) > 1) p.fotoDeLinea = true;
  }

  const por = (c) => productos.filter((p) => p.confianza === c).length;
  const conFoto = productos.filter((p) => p.imagenes?.grande).length;
  const conDesc = productos.filter((p) => p.descripcion).length;
  const agotados = productos.filter((p) => p.disponible && p.disponible !== "inStock").length;
  const pct = (n) => `${((n / productos.length) * 100).toFixed(0)} %`;

  const salida = ruta.replace(/\.json$/, "-enriquecido.json");
  await writeFile(salida, JSON.stringify({ ...cat, enriquecido: true, productos }, null, 2));

  console.log(`\n  Consultas únicas al sitio: ${cache.size}`);
  console.log(`  Emparejados: alta ${por("alta")} · media ${por("media")} · sin match ${por(null)}`);
  console.log(`  Con foto:        ${conFoto} (${pct(conFoto)})`);
  console.log(`  Con descripción: ${conDesc} (${pct(conDesc)})`);
  console.log(`  Agotados en el sitio: ${agotados}`);
  console.log(`  Con foto de línea (variante no distinguible): ${productos.filter((p) => p.fotoDeLinea).length}`);
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
