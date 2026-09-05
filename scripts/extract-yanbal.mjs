#!/usr/bin/env node
// Extrae el catálogo de productos de un flipbook de Yanbal (plataforma iPaper).
//
// El flipbook publica sus productos como "enrichments" de tipo 13, ya estructurados:
// código, nombre, precio, página e imagen. No hace falta OCR ni parsear texto.
//
// Las URLs de los enrichments vienen firmadas y expiran en ~24 h, así que cada
// corrida tiene que releer el HTML del flipbook para obtenerlas frescas. No las caches.
//
//   node scripts/extract-yanbal.mjs [url-del-flipbook]

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_URL = "https://docs.yanbal.com/cdigital/co/2026/c9/oficial/";
const PRODUCT_ENRICHMENT = 13;

// OJO: los enrichments NO traen foto de producto. El campo `aws` del hotspot es el
// ícono del carrito — los 468 productos comparten el mismo archivo. Las fotos hay
// que resolverlas aparte (yanbal.com por código, o fotografía propia).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function get(url, as = "text") {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return as === "json" ? res.json() : res.text();
}

/**
 * Saca un objeto JSON del HTML balanceando llaves desde un ancla.
 * El ancla puede ser una clave JSON (`"chunkUrls"`) o una asignación JS
 * (`window.dataStore`): en ambos casos toma la primera `{` que le siga.
 */
function extractJsonObject(html, anchor) {
  const at = html.indexOf(anchor);
  if (at === -1) throw new Error(`No encontré ${anchor} en el HTML del flipbook.`);

  const start = html.indexOf("{", at + anchor.length);
  if (start === -1) throw new Error(`No hay ningún objeto después de ${anchor}.`);
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      return JSON.parse(html.slice(start, i + 1).replaceAll("\\u0026", "&"));
    }
  }
  throw new Error(`El objeto en ${anchor} quedó sin cerrar.`);
}

/** "4719 - Yanbal Jelly Stick Cool Shine" -> "Yanbal Jelly Stick Cool Shine" */
function cleanName(raw, code) {
  return String(raw ?? "").replace(new RegExp(`^\\s*${code}\\s*-\\s*`), "").trim();
}

function toCsv(rows) {
  const cols = ["codigo", "nombre", "precio", "pagina", "paginaUrl"];
  const cell = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

async function main() {
  const url = process.argv[2] ?? DEFAULT_URL;
  console.log(`Leyendo flipbook: ${url}`);

  const html = await get(url);
  const { flipbookName: campaign = "desconocida" } = extractJsonObject(html, "window.dataStore");
  const chunkUrls = extractJsonObject(html, '"chunkUrls"');

  const ranges = Object.keys(chunkUrls);
  console.log(`Campaña: ${campaign} — ${ranges.length} bloques de páginas (${ranges.join(", ")})`);

  const enrichments = [];
  for (const range of ranges) {
    const chunk = await get(chunkUrls[range], "json");
    enrichments.push(...(chunk.enrichments ?? []));
  }

  const hotspots = enrichments.filter((e) => e.type === PRODUCT_ENRICHMENT);

  // Un producto puede aparecer en varias páginas; nos quedamos con la primera.
  const byCode = new Map();
  for (const h of hotspots) {
    const codigo = String(h.productId);
    if (byCode.has(codigo)) continue;
    const pagina = h.pageIndex + 1;
    byCode.set(codigo, {
      codigo,
      nombre: cleanName(h.name, codigo),
      precio: h.price ?? null,
      pagina,
      paginaUrl: `${url}?page=${pagina}`,
    });
  }

  const productos = [...byCode.values()].sort((a, b) => a.pagina - b.pagina);
  const conPrecio = productos.filter((p) => p.precio != null);

  const slug = campaign.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const base = resolve(process.cwd(), "data", `yanbal-${slug}`);
  await mkdir(dirname(base), { recursive: true });

  await writeFile(
    `${base}.json`,
    JSON.stringify(
      { marca: "Yanbal", campana: campaign, origen: url, extraido: new Date().toISOString(), productos },
      null,
      2,
    ),
  );
  await writeFile(`${base}.csv`, toCsv(productos));

  const precios = conPrecio.map((p) => p.precio);
  const fmt = (n) => "$" + Math.round(n).toLocaleString("es-CO");

  console.log(`\n  ${hotspots.length} marcas de producto -> ${productos.length} SKUs únicos`);
  console.log(`  ${conPrecio.length} con precio: ${fmt(Math.min(...precios))} – ${fmt(Math.max(...precios))}`);
  console.log(`  promedio ${fmt(precios.reduce((a, b) => a + b, 0) / precios.length)}`);
  console.log(`\n  ${base}.json\n  ${base}.csv`);
}

main().catch((err) => {
  console.error(`\nFalló la extracción: ${err.message}`);
  process.exit(1);
});
