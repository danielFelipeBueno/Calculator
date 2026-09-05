#!/usr/bin/env node
// Construye un índice completo de los productos publicados en yanbal.com.
//
// El autocompletado del buscador devuelve como máximo 4 resultados, así que por
// sí solo nunca alcanza a los productos de familias numerosas — hay 31 collares
// en el catálogo y la búsqueda de "collar" solo enseña cuatro. Las páginas de
// categoría sí se pueden paginar entero, y además traen DOS imágenes por
// producto en vez de una.
//
//   node scripts/indexar-yanbal.mjs
//
// Deja data/yanbal-sitio-indice.json, que enrich-yanbal.mjs usa como segunda
// fuente cuando el autocompletado no encuentra el producto.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SITE = "https://www.yanbal.com";
const BASE = `${SITE}/co/corporate`;
const CONCURRENCIA = 3;
const PAUSA_MS = 250;
const MAX_PAGINAS = 40;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function html(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    return res.ok ? res.text() : null;
  } catch {
    return null;
  }
}

const desescapar = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();

/** Las categorías se anuncian en el menú de la portada. */
async function categorias() {
  const h = await html(`${SITE}/co/`);
  if (!h) throw new Error("no pude leer la portada de yanbal.com");
  const rutas = [...h.matchAll(/\/co\/corporate\/c\/([A-Za-z0-9%_-]+)/g)].map((m) => m[1]);
  return [...new Set(rutas)];
}

/**
 * Un producto por bloque `product__list--box`. El bloque trae el código en un
 * input oculto, el nombre en el título del enlace, el precio en el span de
 * `price-plp`, y hasta dos imágenes a 500x500.
 */
function productosDe(h) {
  const out = [];
  for (const bloque of h.split("product__list--box").slice(1)) {
    const b = bloque.slice(0, 14000);

    const codigo = b.match(/name="productCode" value="(\d+)"/)?.[1];
    if (!codigo) continue;

    const enlace = b.match(new RegExp(`href="(/co/corporate/p/${codigo}/[^"?]*)"`))?.[1];

    // El primer enlace del bloque es una etiqueta autocerrada sin texto, así que
    // hay que descartar los candidatos en blanco: se toma el primero que
    // contenga letras de verdad.
    const candidatos = [
      ...[...b.matchAll(new RegExp(`href="/co/corporate/p/${codigo}/[^"]*"[^>]*>([^<]{3,110})<`, "g"))].map((m) => m[1]),
      ...[...b.matchAll(/title="([^"]{3,110})"/g)].map((m) => m[1]),
      ...[...b.matchAll(/alt="([^"]{3,110})"/g)].map((m) => m[1]),
    ];
    const nombre = candidatos.map(desescapar).find((t) => /[a-záéíóúñ]{3}/i.test(t));
    // El bloque trae dos precios: --priceBefore es el tachado y --discountPrice
    // el que se cobra. Coger el primero que aparezca da el tachado y falsea
    // todas las comparaciones contra el catálogo.
    const monto = (clase) => {
      const m = b.match(new RegExp(`price-plp__list__productValue--${clase}"[^>]*>\\s*\\$\\s?([\\d.]+)`));
      return m ? Number(m[1].replaceAll(".", "")) : null;
    };
    const precio = monto("discountPrice") ?? monto("priceBefore");
    const precioLista = monto("discountPrice") ? monto("priceBefore") : null;

    const imgs = [...new Set(
      [...b.matchAll(new RegExp(`/medias/500Wx500H-Yanbal-OriginalFormat-${codigo}-(\\d+)\\.jpg\\?[^"']+`, "g"))]
        .map((m) => SITE + m[0]),
    )];

    out.push({
      codigo,
      nombre: nombre ? desescapar(nombre) : null,
      url: enlace ? SITE + enlace : null,
      precio,
      precioLista,
      imagenes: imgs,
    });
  }
  return out;
}

async function recorrerCategoria(cat, encontrados) {
  let nuevas = 0;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const h = await html(`${BASE}/c/${cat}?q=%3Arelevance&page=${pagina}`);
    await sleep(PAUSA_MS);
    if (!h) break;

    const ps = productosDe(h);
    // Una página que no aporta ningún código nuevo significa que la categoría
    // se agotó: el sitio repite la última página en vez de devolver vacío.
    const antes = encontrados.size;
    for (const p of ps) {
      const previo = encontrados.get(p.codigo);
      if (!previo || (p.imagenes.length > previo.imagenes.length)) encontrados.set(p.codigo, p);
    }
    nuevas += encontrados.size - antes;
    if (ps.length === 0 || encontrados.size === antes) break;
  }
  return nuevas;
}

async function main() {
  console.log(`Indexando ${SITE}\n`);
  const cats = await categorias();
  console.log(`  ${cats.length} categorías en el menú\n`);

  const encontrados = new Map();
  let hechas = 0;

  const cola = [...cats];
  await Promise.all(
    Array.from({ length: CONCURRENCIA }, async () => {
      while (cola.length) {
        const cat = cola.shift();
        const nuevas = await recorrerCategoria(cat, encontrados);
        hechas++;
        if (nuevas > 0) {
          console.log(`  +${String(nuevas).padStart(3)}  ${cat.slice(0, 44).padEnd(44)} (${encontrados.size} en total)`);
        }
      }
    }),
  );

  const productos = [...encontrados.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const conPrecio = productos.filter((p) => p.precio);
  const conFoto = productos.filter((p) => p.imagenes.length);
  const dosFotos = productos.filter((p) => p.imagenes.length > 1);
  const enOferta = productos.filter((p) => p.precioLista);

  const salida = resolve(process.cwd(), "data", "yanbal-sitio-indice.json");
  await mkdir(dirname(salida), { recursive: true });
  await writeFile(
    salida,
    JSON.stringify({ origen: SITE, categorias: cats.length, extraido: new Date().toISOString(), productos }, null, 2),
  );

  console.log(`\n  ${hechas} categorías recorridas`);
  console.log(`  ${productos.length} productos únicos en el sitio`);
  console.log(`  con precio: ${conPrecio.length} · con foto: ${conFoto.length} · con dos fotos: ${dosFotos.length}`);
  console.log(`  con precio tachado (en oferta): ${enOferta.length}`);
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
