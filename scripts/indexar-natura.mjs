#!/usr/bin/env node
// Construye un índice completo de los productos publicados en natura.com.co.
//
// Es el equivalente de indexar-yanbal.mjs para Natura, y cumple el mismo papel:
// recorrer el menú de categorías entero para tener foto y precio de todo el
// sitio, sin depender de un buscador. Aquí no hay alternativa, además: en
// natura.com.co el buscador está bloqueado —/busca, /search y el autocompletado
// devuelven la página de "Access Denied" de Akamai— así que las categorías son
// la única vía de listado.
//
//   node scripts/indexar-natura.mjs
//
// Deja data/natura-sitio-indice.json, que enrich-natura.mjs usa como primera
// fuente antes de ir ficha por ficha.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { SITIO, pedir, productosDe, sleep, mapLimit } from "./natura-sitio.mjs";

const CONCURRENCIA = 3;
const PAUSA_MS = 250;

/**
 * Las categorías se anuncian en el menú, que va completo en toda página del
 * sitio. Se leen de la portada y se completan con las que aparezcan al
 * recorrerlas: el menú de una categoría lista además sus hermanas y sus hijas.
 */
function categoriasDe(html) {
  return [...new Set([...html.matchAll(/href="\/c\/([a-z0-9-]{2,60})"/g)].map((m) => m[1]))];
}

async function main() {
  console.log(`Indexando ${SITIO}\n`);

  const portada = await pedir(`${SITIO}/`);
  if (portada.bloqueado) {
    console.error("  El sitio respondió con un bloqueo de Akamai. Paro aquí.");
    process.exit(2);
  }
  if (portada.status !== 200) throw new Error(`la portada respondió ${portada.status}`);

  const pendientes = categoriasDe(portada.html);
  console.log(`  ${pendientes.length} categorías en el menú de la portada\n`);

  const vistas = new Set(pendientes);
  const encontrados = new Map();
  let bloqueos = 0;
  let hechas = 0;

  // Cola dinámica: recorrer una categoría puede descubrir subcategorías nuevas.
  const cola = [...pendientes];
  await mapLimit(
    Array.from({ length: CONCURRENCIA }, (_, i) => i),
    CONCURRENCIA,
    async () => {
      while (cola.length) {
        const cat = cola.shift();
        const r = await pedir(`${SITIO}/c/${cat}`);
        await sleep(PAUSA_MS);
        hechas++;
        if (r.bloqueado) {
          bloqueos++;
          continue;
        }
        if (r.status !== 200) continue;

        for (const nueva of categoriasDe(r.html)) {
          if (!vistas.has(nueva)) {
            vistas.add(nueva);
            cola.push(nueva);
          }
        }

        const antes = encontrados.size;
        for (const p of productosDe(r.html)) {
          const previo = encontrados.get(p.codigo);
          // Gana el registro más completo: más fotos, y precio antes que sin precio.
          const mejora =
            !previo ||
            p.imagenes.length > previo.imagenes.length ||
            (previo.precio == null && p.precio != null);
          if (mejora) encontrados.set(p.codigo, { ...previo, ...p });
        }
        const nuevos = encontrados.size - antes;
        if (nuevos > 0) {
          console.log(
            `  +${String(nuevos).padStart(3)}  ${cat.slice(0, 44).padEnd(44)} (${encontrados.size} en total)`,
          );
        }
      }
    },
  );

  if (bloqueos > 0) console.log(`\n  Atención: ${bloqueos} categorías respondieron con bloqueo de Akamai.`);

  const productos = [...encontrados.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const con = (f) => productos.filter(f).length;

  const salida = resolve(process.cwd(), "data", "natura-sitio-indice.json");
  await mkdir(dirname(salida), { recursive: true });
  await writeFile(
    salida,
    JSON.stringify(
      { origen: SITIO, marca: "Natura", categorias: vistas.size, extraido: new Date().toISOString(), productos },
      null,
      2,
    ),
  );

  console.log(`\n  ${hechas} categorías recorridas (${vistas.size} descubiertas)`);
  console.log(`  ${productos.length} productos únicos en el sitio`);
  console.log(`  con precio: ${con((p) => p.precio != null)} · con foto: ${con((p) => p.imagenes.length)}`);
  console.log(`  con dos fotos: ${con((p) => p.imagenes.length > 1)} · con precio tachado: ${con((p) => p.precioLista != null)}`);
  console.log(`  agotados: ${con((p) => p.disponible === false)}`);
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
