#!/usr/bin/env node
/*
 * Sonda de natura.com.co y avon.com.co
 * ------------------------------------
 * Desde el entorno en la nube esos dos sitios responden 403 y 503: bloquean
 * las IPs de datacenter. Esta sonda comprueba si desde una conexión normal
 * en Colombia sí responden, y en ese caso qué vía de extracción ofrecen.
 *
 * Córrela en tu máquina y pega la salida completa en el chat:
 *
 *     node scripts/sonda-natura.mjs
 *
 * No instala nada, no escribe archivos y no manda datos a ninguna parte:
 * solo hace unas 20 peticiones GET, con pausa entre ellas, e imprime el
 * resultado en pantalla. Requiere Node 18 o superior.
 */

const NODE_MIN = 18;
const mayor = Number(process.versions.node.split(".")[0]);
if (mayor < NODE_MIN) {
  console.error(`Necesitas Node ${NODE_MIN} o superior. Tienes ${process.versions.node}.`);
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const CABECERAS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

// Productos reales del ciclo 13, extraídos del catálogo oficial.
const MUESTRA = { codigo: "167286", nombre: "Shampoo restauración 300 ml", precio: 40500 };
const TERMINO = "kaiak"; // el perfume más vendido de Natura Colombia

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const linea = (c = "─") => console.log(c.repeat(72));

let respondeNatura = false;
const hallazgos = [];

async function pedir(url, comoJson = false) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: comoJson ? { ...CABECERAS, Accept: "application/json" } : CABECERAS,
      redirect: "follow",
    });
    const cuerpo = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      tipo: res.headers.get("content-type") ?? "",
      servidor: res.headers.get("server") ?? "",
      urlFinal: res.url,
      cuerpo,
      ms: Date.now() - t0,
    };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, cuerpo: "", ms: Date.now() - t0 };
  }
}

async function probar(etiqueta, url, opciones = {}) {
  const r = await pedir(url, opciones.json);
  const marca = r.status === 200 ? "OK " : r.status === 0 ? "ERR" : "── ";
  const detalle = r.error ? r.error.slice(0, 40) : `${r.cuerpo.length} bytes`;
  console.log(`  [${marca}] ${String(r.status).padEnd(3)} ${etiqueta.padEnd(34)} ${detalle}`);
  await sleep(400);
  return r;
}

async function seccionSitio(nombre, base) {
  linea();
  console.log(`${nombre.toUpperCase()}  —  ¿responde desde tu conexión?`);
  linea();

  const home = await probar("portada", base);

  if (home.status !== 200) {
    console.log(`\n  ✗ ${nombre} NO responde desde tu máquina tampoco (${home.status}).`);
    if (home.status === 403 || home.status === 503) {
      console.log("    Es la misma protección anti-bot que veo desde la nube.");
      console.log("    Siguiente opción: un navegador real (Playwright), no peticiones planas.");
    }
    return false;
  }

  console.log(`\n  ✓ ${nombre} SÍ responde. Servidor: ${home.servidor || "no declarado"}`);
  hallazgos.push(`${nombre}: responde (200)`);

  // ---- plataforma ----
  const h = home.cuerpo;
  const marcadores = [
    ["VTEX", /vtex|vtexassets|vtexcommercestable/i],
    ["Next.js", /__NEXT_DATA__|_next\/static/],
    ["Salesforce Commerce", /demandware|salesforce/i],
    ["Shopify", /cdn\.shopify\.com/i],
    ["SAP Hybris", /\/_ui\/responsive|hybris/i],
    ["Adobe/Magento", /magento|mage-init/i],
  ];
  const encontradas = marcadores.filter(([, re]) => re.test(h)).map(([n]) => n);
  console.log(`  Plataforma detectada: ${encontradas.join(", ") || "no identificada"}`);
  if (encontradas.length) hallazgos.push(`${nombre}: plataforma ${encontradas.join("+")}`);

  // ---- rutas de producto en la portada ----
  const rutas = [...new Set([...h.matchAll(/href="((?:https?:\/\/[^"]*)?\/p\/[^"?]{4,90})"/g)].map((m) => m[1]))];
  if (rutas.length) {
    console.log(`  Rutas de producto encontradas (${rutas.length}), muestra:`);
    rutas.slice(0, 3).forEach((r) => console.log(`      ${r}`));
    hallazgos.push(`${nombre}: ${rutas.length} rutas /p/ en portada`);
  } else {
    console.log("  Sin rutas /p/ visibles en la portada (puede cargarlas por JavaScript).");
  }
  return true;
}

async function seccionApis(base) {
  linea();
  console.log("¿HAY UNA API DE CATÁLOGO?  —  esto es lo que decide todo");
  linea();

  const pruebas = [
    ["VTEX · listado", `${base}/api/catalog_system/pub/products/search?_from=0&_to=1`],
    ["VTEX · por código de referencia", `${base}/api/catalog_system/pub/products/search?fq=alternateIds_RefId:${MUESTRA.codigo}`],
    ["VTEX · búsqueda por término", `${base}/api/catalog_system/pub/products/search/${TERMINO}`],
    ["VTEX · autocompletar", `${base}/buscaautocomplete/?productNameContains=${TERMINO}`],
    ["VTEX · búsqueda inteligente", `${base}/api/io/_v/api/intelligent-search/product_search/?query=${TERMINO}&count=2`],
    ["Hybris · autocompletar", `${base}/search/autocomplete/SearchBox?term=${TERMINO}`],
    ["Página de búsqueda", `${base}/busca?ft=${TERMINO}`],
  ];

  const buenas = [];
  for (const [etiqueta, url] of pruebas) {
    const r = await probar(etiqueta, url, { json: true });
    if (r.status === 200 && r.tipo.includes("json") && r.cuerpo.length > 40) {
      buenas.push([etiqueta, url, r]);
    }
  }

  if (!buenas.length) {
    console.log("\n  ✗ Ninguna API de catálogo respondió con JSON.");
    console.log("    Quedan las páginas HTML de producto como vía, que es más frágil.");
    return;
  }

  console.log(`\n  ✓ ${buenas.length} endpoint(s) devolvieron JSON. El mejor:`);
  const [etiqueta, url, r] = buenas[0];
  console.log(`      ${etiqueta}\n      ${url}\n`);
  hallazgos.push(`API que responde: ${etiqueta}`);

  try {
    const d = JSON.parse(r.cuerpo);
    const arr = Array.isArray(d) ? d : d.products ?? d.items ?? d.data ?? [];
    console.log(`  Registros devueltos: ${Array.isArray(arr) ? arr.length : "estructura no reconocida"}`);
    const p = Array.isArray(arr) ? arr[0] : d;
    if (p && typeof p === "object") {
      console.log("  Campos del primer registro:");
      console.log("      " + Object.keys(p).slice(0, 24).join(", "));

      // Lo que de verdad importa: ¿trae foto, precio y stock?
      const txt = JSON.stringify(p);
      const tiene = (re) => (re.test(txt) ? "SÍ" : "no");
      console.log("\n  Lo que buscamos:");
      console.log(`      foto        ${tiene(/"(imageUrl|images?|picture|thumbnail)"/i)}`);
      console.log(`      precio      ${tiene(/"(Price|price|listPrice|sellingPrice)"/i)}`);
      console.log(`      stock       ${tiene(/"(AvailableQuantity|stock|availability|isAvailable)"/i)}`);
      console.log(`      descripción ${tiene(/"(description|shortDescription|metaTagDescription)"/i)}`);
      console.log(`      código      ${tiene(/"(productReference|refId|RefId|sku|productId)"/i)}`);

      const img = txt.match(/"(?:imageUrl|image)":"(https?:\/\/[^"]{10,140})"/);
      if (img) console.log(`\n  Ejemplo de URL de foto:\n      ${img[1]}`);
    }
  } catch {
    console.log("  (respondió JSON pero no pude interpretarlo; pega igual la salida)");
  }
}

async function seccionProducto(base) {
  linea();
  console.log(`¿SE PUEDE LLEGAR A UN PRODUCTO POR SU CÓDIGO DE CATÁLOGO?`);
  linea();
  console.log(`  Producto de prueba: (${MUESTRA.codigo}) ${MUESTRA.nombre} — $${MUESTRA.precio.toLocaleString("es-CO")}\n`);

  const intentos = [
    ["por código en la ruta", `${base}/${MUESTRA.codigo}/p`],
    ["por código como NATCOL", `${base}/p/NATCOL-${MUESTRA.codigo}`],
    ["búsqueda del código", `${base}/busca?ft=${MUESTRA.codigo}`],
    ["búsqueda del nombre", `${base}/busca?ft=${encodeURIComponent("shampoo restauracion")}`],
  ];
  for (const [etiqueta, url] of intentos) {
    const r = await probar(etiqueta, url);
    if (r.status === 200 && new RegExp(MUESTRA.codigo).test(r.cuerpo)) {
      console.log(`         ↑ el código ${MUESTRA.codigo} aparece en la respuesta — buena señal`);
      hallazgos.push(`el código de catálogo se puede buscar en el sitio`);
    }
  }
}

async function main() {
  console.log("\nSonda de catálogos — Alejandría");
  console.log(`Node ${process.versions.node} · ${new Date().toISOString()}\n`);
  console.log("Copia TODA la salida y pégala en el chat.\n");

  respondeNatura = await seccionSitio("Natura", "https://www.natura.com.co");
  if (respondeNatura) {
    await seccionApis("https://www.natura.com.co");
    await seccionProducto("https://www.natura.com.co");
  }

  for (const [nombre, base] of [["Avon", "https://www.avon.com.co"], ["Avon (.co)", "https://www.avon.co"]]) {
    const ok = await seccionSitio(nombre, base);
    if (ok) await seccionApis(base);
  }

  linea("═");
  console.log("RESUMEN");
  linea("═");
  if (!hallazgos.length) {
    console.log("  Nada respondió. El bloqueo no es de IP: haría falta un navegador real.");
  } else {
    hallazgos.forEach((h) => console.log(`  · ${h}`));
  }
  console.log("\nListo. Pega esta salida completa en el chat.\n");
}

main().catch((e) => {
  console.error(`\nLa sonda falló: ${e.message}`);
  console.error("Pega también este error en el chat.");
  process.exit(1);
});
