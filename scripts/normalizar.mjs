#!/usr/bin/env node
// Consolida un catálogo enriquecido en el registro que consumirá la tienda.
//
// El nombre de la revista no sirve como identidad: está pensado para leerse
// dentro de una página maquetada, donde la variante se entiende por el contexto
// visual. Fuera de esa página pierde la mitad de la información —doce productos
// distintos se llaman "Crema nutritiva para el cuerpo 400 ml"— y a veces captura
// un sello publicitario en vez del producto. El nombre del sitio de la marca sí
// es un identificador completo, así que manda cuando existe.
//
//   node scripts/normalizar.mjs data/natura-revista-ciclo-13-enriquecido.json
//
// Deja <archivo>-normalizado.json con `nombre` ya resuelto, `nombreRevista`
// conservado para trazabilidad, y un `slug` estable para la URL del producto.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

/** Sellos y frases de maqueta que el extractor confunde con un nombre. */
const NO_ES_NOMBRE =
  /^(producto vegano|lanzamiento|repuesto|nuevo|oferta|hasta|desde|solo|más del|composición|material|carga máxima|haz tu regalo|\d+\s*%)/i;

const sinTildes = (s) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

function slugificar(nombre, codigo) {
  const base = sinTildes(String(nombre ?? ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/, "");
  return base ? `${codigo}/${base}` : String(codigo);
}

/** ¿El nombre de la revista es utilizable por sí solo? */
function revistaSirve(nombre) {
  const t = String(nombre ?? "").trim();
  return t.length >= 6 && t.split(/\s+/).length >= 2 && !NO_ES_NOMBRE.test(t);
}

function normalizar(p) {
  const delSitio = String(p.nombreSitio ?? "").trim();
  const delaRevista = String(p.nombre ?? "").trim();

  const nombre = delSitio || (revistaSirve(delaRevista) ? delaRevista : null);
  const origen = delSitio ? "sitio" : nombre ? "revista" : null;

  // Una foto de la marca vale más que ninguna, pero conviene saber cuál es cuál.
  const im = p.imagenes ?? {};
  const principal = im.principal ?? im.grande ?? im.card ?? null;
  const adicionales = im.adicionales ?? [];

  return {
    codigo: String(p.codigo),
    nombre,
    nombreRevista: delaRevista || null,
    origenNombre: origen,
    slug: nombre ? slugificar(nombre, p.codigo) : String(p.codigo),
    precio: p.precio ?? null,
    precioLista: p.precioLista ?? p.precioListaSitio ?? null,
    marca: p.marca ?? null,
    puntos: p.puntos ?? null,
    pagina: p.pagina ?? null,
    disponible: p.disponible ?? null,
    calificacion: p.calificacion ?? null,
    descripcion: p.descripcion ?? null,
    imagenPrincipal: principal,
    imagenesAdicionales: adicionales,
    urlMarca: p.sitioUrl ?? null,
    // Sin nombre utilizable no hay ficha que publicar ni URL que indexar.
    publicable: Boolean(nombre && principal && p.precio),
  };
}

async function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error("Uso: node scripts/normalizar.mjs <archivo-enriquecido.json>");
    process.exit(1);
  }
  const ruta = resolve(process.cwd(), entrada);
  const d = JSON.parse(await readFile(ruta, "utf8"));

  const productos = d.productos.map(normalizar);

  // Un slug repetido sería dos productos peleando por la misma URL.
  const vistos = new Map();
  for (const p of productos) {
    const n = (vistos.get(p.slug) ?? 0) + 1;
    vistos.set(p.slug, n);
    if (n > 1) p.slug = `${p.slug}-${n}`;
  }

  const conNombre = productos.filter((p) => p.nombre);
  const delSitio = productos.filter((p) => p.origenNombre === "sitio");
  const publicables = productos.filter((p) => p.publicable);
  const repetidos = new Set();
  const cuenta = new Map();
  for (const p of conNombre) {
    const k = p.nombre.toLowerCase();
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
    if (cuenta.get(k) > 1) repetidos.add(k);
  }

  const salida = ruta.replace(/\.json$/, "").replace(/-enriquecido$/, "") + "-normalizado.json";
  await writeFile(salida, JSON.stringify({ ...d, normalizado: true, productos }, null, 2));

  const pct = (n) => `${Math.round((n / productos.length) * 100)} %`;
  console.log(`  ${productos.length} productos`);
  console.log(`  con nombre utilizable : ${conNombre.length} (${pct(conNombre.length)}) — ${delSitio.length} del sitio de la marca`);
  console.log(`  nombres repetidos     : ${repetidos.size}`);
  console.log(`  publicables           : ${publicables.length} (${pct(publicables.length)}) con nombre, foto y precio`);
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
