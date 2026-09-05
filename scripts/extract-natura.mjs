#!/usr/bin/env node
// Extrae el catálogo de productos de una revista de Natura o Avon
// (plataforma digital-catalogue.com).
//
// A diferencia de Yanbal, aquí no hay datos estructurados: la plataforma solo
// publica una capa de texto por página, palabra a palabra y con coordenadas.
// Los productos se reconstruyen por geometría — un párrafo de nombre y, debajo
// y en la misma columna, un párrafo de datos con el código entre paréntesis:
//
//     Shampoo restauración 300 ml          <- nombre    (y=585, x=40)
//     (167286) 7 pts $ 40.500 ml a $ 135   <- datos     (y=612, x=40)
//
// Con descuento los datos se parten en varios párrafos: "de $ 33.500" (lista)
// y "a 25.100 $" (oferta).
//
//   node scripts/extract-natura.mjs <url-de-la-revista> [marca]

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const NATURA_C13 =
  "https://co.natura.digital-catalogue.com/co/2026/13/revista/ciclo-13/view";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const CODIGO = /\((\d{5,7})\)/;
const MISMA_COLUMNA = 40; // px de tolerancia horizontal
const SALTO_NOMBRE = 90;  // px máximos entre el nombre y sus datos

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  return res.json();
}

/** Agrupa las palabras de una página en párrafos con su caja envolvente. */
function parrafos(words) {
  const grupos = new Map();
  for (const w of words) {
    if (!grupos.has(w.paragraph_id)) grupos.set(w.paragraph_id, []);
    grupos.get(w.paragraph_id).push(w);
  }
  return [...grupos.values()].map((ws) => {
    const ordenadas = [...ws].sort((a, b) => Math.round(a.y / 3) - Math.round(b.y / 3) || a.x - b.x);
    return {
      texto: ordenadas.map((w) => w.text).join(" "),
      x: Math.min(...ws.map((w) => w.x)),
      y: Math.min(...ws.map((w) => w.y)),
    };
  });
}

/**
 * Precios de producto en pesos. Se descartan los unitarios ("ml a $ 135,00"),
 * que llevan coma decimal, y los gramajes sueltos.
 */
function precios(texto) {
  const out = [];
  for (const m of texto.matchAll(/(de|a)?\s*\$?\s*(\d{1,3}(?:\.\d{3})+)(?!,)\s*\$?/g)) {
    const valor = Number(m[2].replaceAll(".", ""));
    if (valor >= 1000) out.push({ marca: m[1] ?? null, valor });
  }
  return out;
}

function limpiarNombre(t) {
  return t.replace(/\s+/g, " ").replace(/^[·•\-–\s]+/, "").trim();
}

// Sellos y reclamos que la revista imprime junto al producto y que, por estar
// en la misma columna, compiten con el nombre real.
const SELLOS =
  /^(\d+\s*%|.*\bde descuento\b|.*\bproducto con repuesto\b|.*\bcon enjuague\b|.*\bllevando\b|.*\bgratis\b|.*\bnuevo\b\s*$|.*\boferta\b)/i;

/** Un nombre plausible: sin código, sin precio, sin sello promocional. */
function esNombre(p) {
  return (
    !CODIGO.test(p.texto) &&
    !/\d{1,3}(?:\.\d{3})+/.test(p.texto) &&
    /[a-záéíóúñ]{3}/i.test(p.texto) &&
    !SELLOS.test(p.texto.trim()) &&
    p.texto.length >= 5 &&
    p.texto.length <= 120
  );
}

function productosDePagina(pagina, numero) {
  const ps = parrafos(pagina.words ?? []);
  const anclas = ps.filter((p) => CODIGO.test(p.texto));
  const encontrados = [];

  for (const ancla of anclas) {
    const codigo = ancla.texto.match(CODIGO)[1];

    // El nombre: el párrafo más cercano por encima, en la misma columna.
    const candidatos = ps
      .filter(
        (p) =>
          p !== ancla &&
          p.y < ancla.y &&
          ancla.y - p.y <= SALTO_NOMBRE &&
          Math.abs(p.x - ancla.x) <= MISMA_COLUMNA &&
          esNombre(p),
      )
      .sort((a, b) => b.y - a.y);
    if (!candidatos.length) continue;

    // Los precios pueden seguir en párrafos hermanos justo debajo del ancla.
    const cerca = ps.filter(
      (p) =>
        Math.abs(p.x - ancla.x) <= MISMA_COLUMNA &&
        p.y >= ancla.y &&
        p.y <= ancla.y + 60,
    );
    const todos = cerca.flatMap((p) => precios(p.texto));
    const oferta = todos.find((p) => p.marca === "a")?.valor ?? null;
    const lista = todos.find((p) => p.marca === "de")?.valor ?? null;
    const suelto = todos.find((p) => !p.marca)?.valor ?? null;

    const precio = oferta ?? suelto ?? lista;
    if (precio == null) continue;

    const pts = ancla.texto.match(/(\d+)\s*pts/);

    encontrados.push({
      codigo,
      nombre: limpiarNombre(candidatos[0].texto),
      precio,
      precioLista: lista && lista !== precio ? lista : null,
      puntos: pts ? Number(pts[1]) : null,
      pagina: numero,
    });
  }
  return encontrados;
}

async function main() {
  const base = (process.argv[2] ?? NATURA_C13).replace(/\/+$/, "");
  const marca = process.argv[3] ?? (base.includes("avon") ? "Avon" : "Natura");

  console.log(`Leyendo revista: ${base}`);

  const productos = [];
  let pagina = 1;
  let vacias = 0;

  // La revista no declara su total de páginas en los datos, así que se avanza
  // hasta acumular varias páginas seguidas sin capa de texto.
  while (vacias < 5 && pagina <= 300) {
    const d = await getJson(`${base}/common/data/${String(pagina).padStart(4, "0")}.json`);
    if (!d) {
      vacias++;
    } else {
      vacias = 0;
      productos.push(...productosDePagina(d, pagina));
    }
    if (pagina % 40 === 0) console.log(`  página ${pagina}… ${productos.length} productos`);
    pagina++;
  }

  // Un producto puede repetirse entre páginas; se conserva la primera aparición.
  const porCodigo = new Map();
  for (const p of productos) if (!porCodigo.has(p.codigo)) porCodigo.set(p.codigo, p);
  const unicos = [...porCodigo.values()].sort((a, b) => a.pagina - b.pagina);

  const slug = `${marca.toLowerCase()}-${base.split("/").slice(-3, -1).join("-")}`;
  const salida = resolve(process.cwd(), "data", `${slug}.json`);
  await mkdir(dirname(salida), { recursive: true });
  await writeFile(
    salida,
    JSON.stringify({ marca, origen: base, extraido: new Date().toISOString(), productos: unicos }, null, 2),
  );

  const vals = unicos.map((p) => p.precio);
  const fmt = (n) => "$" + Math.round(n).toLocaleString("es-CO");
  console.log(`\n  ${productos.length} apariciones -> ${unicos.length} productos únicos`);
  if (vals.length) {
    console.log(`  Precios: ${fmt(Math.min(...vals))} – ${fmt(Math.max(...vals))}`);
    console.log(`  Con precio de lista (en oferta): ${unicos.filter((p) => p.precioLista).length}`);
  }
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
