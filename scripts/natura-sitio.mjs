// Piezas compartidas para leer natura.com.co.
//
// El sitio corre sobre Next.js (App Router) delante de Salesforce Commerce, y
// no publica ninguna API de catálogo: los endpoints tipo VTEX o Hybris que
// probó la sonda devuelven una página de Akamai que dice "Access Denied"
// **con status 200**, así que mirar el código de respuesta no basta para saber
// si una petición sirvió. Lo que sí funciona es la navegación normal del sitio,
// y los datos vienen completos dentro del HTML.
//
// Hay dos formas de leerlos, y las dos se usan:
//   · el stream del App Router (self.__next_f.push) en las páginas de categoría
//   · el JSON-LD `product-schema.org` en la ficha de producto

/** Cabeceras de navegador. Sin las Sec-Fetch la portada responde 403. */
export const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

export const SITIO = "https://www.natura.com.co";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cuerpo de bloqueo de Akamai: llega con 200 y hay que tratarlo como fallo. */
const BLOQUEADO = /<TITLE>Access Denied<\/TITLE>/i;

export function esBloqueo(html) {
  return BLOQUEADO.test(html);
}

/**
 * GET con reintentos. Devuelve { status, html, bloqueado } y nunca lanza:
 * una página que falla no puede tumbar el recorrido entero.
 */
export async function pedir(url, { intentos = 3, espera = 600 } = {}) {
  for (let i = 0; i < intentos; i++) {
    try {
      const res = await fetch(url, { headers: CABECERAS, redirect: "follow" });
      const html = await res.text();
      const bloqueado = esBloqueo(html);
      if (!bloqueado && (res.ok || res.status === 404)) {
        return { status: res.status, html, urlFinal: res.url, bloqueado: false };
      }
      if (i === intentos - 1) return { status: res.status, html, urlFinal: res.url, bloqueado };
    } catch {
      if (i === intentos - 1) return { status: 0, html: "", urlFinal: url, bloqueado: false };
    }
    await sleep(espera * (i + 1));
  }
  return { status: 0, html: "", urlFinal: url, bloqueado: false };
}

/** Reconstruye el texto del stream del App Router: self.__next_f.push([1,"..."]). */
export function stream(html) {
  let out = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1\s*,\s*("(?:[^"\\]|\\.)*")\]\)/g)) {
    try {
      out += JSON.parse(m[1]);
    } catch {
      /* un chunk ilegible no invalida los demás */
    }
  }
  return out;
}

/**
 * Parsea el valor JSON que empieza en `i` (que debe ser `{` o `[`), contando
 * llaves y respetando las comillas. El stream no es JSON de principio a fin,
 * así que hay que recortar el trozo exacto antes de pasarlo por JSON.parse.
 */
export function jsonEn(s, i) {
  const abre = s[i];
  if (abre !== "{" && abre !== "[") return null;
  const cierra = abre === "{" ? "}" : "]";
  let prof = 0;
  let enTexto = false;
  let escapado = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (enTexto) {
      if (escapado) escapado = false;
      else if (c === "\\") escapado = true;
      else if (c === '"') enTexto = false;
      continue;
    }
    if (c === '"') enTexto = true;
    else if (c === abre) prof++;
    else if (c === cierra) {
      if (--prof === 0) {
        try {
          return JSON.parse(s.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Normaliza un producto tal como lo publica la página de categoría.
 *
 * El precio es la trampa de este sitio, y tiene dos caras:
 *   · `price.sales.value` es lo que se cobra y `price.list.value` el tachado,
 *     que vale null cuando no hay descuento — al revés de lo que sugiere el
 *     nombre "list".
 *   · en `variations[].price` el tachado se llama `listPrice` y vale **0**
 *     cuando no hay descuento, así que tomarlo como precio da cero pesos.
 * Por eso el precio sale siempre de `price.sales` y el tachado de `price.list`.
 */
export function normalizar(p) {
  if (!p?.productId) return null;
  const codigo = String(p.productId).replace(/^NATCOL-/, "");
  if (!/^\d+$/.test(codigo)) return null;
  return {
    codigo,
    productId: p.productId,
    nombre: p.custom?.natg_friendlyName || p.friendlyName || p.name || null,
    url: p.url ? SITIO + p.url : null,
    precio: p.price?.sales?.value ?? null,
    precioLista: p.price?.list?.value ?? null,
    descuentoPct: p.price?.discountPercent || null,
    disponible: typeof p.inStock === "boolean" ? p.inStock : null,
    marca: p.brand || null,
    categoria: p.categoryName || null,
    imagenes: [...new Set(p.images ?? [])].filter((u) => typeof u === "string"),
    precioUnitario: p.unitPriceDescription || null,
    calificacion: p.custom?.natg_averageRating ?? p.rating ?? null,
    sellos: (p.stamps ?? []).map((s) => s?.label).filter(Boolean),
  };
}

/** Todos los productos que aparecen en el stream de una página. */
export function productosDe(html) {
  const s = stream(html);
  const out = new Map();
  for (const m of s.matchAll(/"products":\s*(?=\[)/g)) {
    const arr = jsonEn(s, m.index + m[0].length);
    if (!Array.isArray(arr)) continue;
    for (const bruto of arr) {
      const p = normalizar(bruto);
      if (!p) continue;
      // Un mismo producto sale en varias vitrinas; gana el registro con más fotos.
      const previo = out.get(p.codigo);
      if (!previo || p.imagenes.length > previo.imagenes.length) out.set(p.codigo, p);
    }
  }
  return [...out.values()];
}

/**
 * Lee la ficha de un producto por su código de catálogo.
 *
 * `/p/<slug>/NATCOL-<código>` responde igual con cualquier slug, así que se
 * llega a cualquier producto sin conocer su URL. Un código que no existe
 * devuelve 404 y sin JSON-LD, de modo que la ficha distingue sola lo que hay
 * de lo que no.
 */
export function fichaDe(html) {
  const m = html.match(/<script id="product-schema\.org"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let d;
  try {
    d = JSON.parse(m[1]);
  } catch {
    return null;
  }
  if (d?.["@type"] !== "Product") return null;

  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
  const texto = (s) =>
    String(s ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || null;

  return {
    // El código se lee del canonical, no de la URL pedida: es la respuesta del
    // sitio y confirma a qué producto resolvió de verdad.
    codigo: canonical?.match(/NATCOL-(\d+)/)?.[1] ?? String(d.sku ?? "").replace(/^NATCOL-/, "") ?? null,
    nombre: texto(d.name),
    descripcion: texto(d.description),
    marca: d.brand?.name || null,
    categoria: d.category || null,
    url: d.offers?.url ?? canonical,
    // offers.price es el precio que se cobra, ya con el descuento aplicado.
    precio: typeof d.offers?.price === "number" ? d.offers.price : Number(d.offers?.price) || null,
    disponible: d.offers?.availability ? /InStock/i.test(d.offers.availability) : null,
    imagenes: [d.image].filter((u) => typeof u === "string" && u),
    calificacion: d.aggregateRating?.ratingValue ? Number(d.aggregateRating.ratingValue) : null,
    resenas: d.aggregateRating?.reviewCount ?? null,
  };
}

/**
 * Precio tachado del producto en su ficha.
 *
 * El JSON-LD publica `offers.price` —lo que se cobra— pero no dice si hay un
 * precio de lista detrás. Sin ese dato, un producto que la revista trae a
 * precio de lista y el sitio tiene en oferta parece una discrepancia de precio
 * cuando en realidad es el mismo producto al mismo precio de lista.
 *
 * El tachado sí está en el stream, dentro de `variations`, pero encontrarlo a
 * ojo es traicionero: la ficha cuelga vitrinas de productos similares, cada una
 * con sus propios `price`, y anclarse en la posición del texto acaba leyendo el
 * precio de otro producto. Por eso la variación se identifica por dos señales a
 * la vez —su `productId` y su `salePrice`, que debe ser el precio ya conocido
 * por el JSON-LD— y si no concuerdan se devuelve null: un tachado equivocado
 * es peor que ninguno, porque inventa un descuento que no existe.
 *
 * Ojo con `listPrice`: vale **0** cuando no hay descuento, no null.
 */
export function tachadoEnFicha(html, codigo, precioVenta) {
  if (typeof precioVenta !== "number" || !precioVenta) return null;
  const s = stream(html);
  const objetivo = `NATCOL-${codigo}`;

  for (const m of s.matchAll(/"variations":\s*(?=\[)/g)) {
    const variaciones = jsonEn(s, m.index + m[0].length);
    if (!Array.isArray(variaciones)) continue;
    for (const v of variaciones) {
      if (v?.productId !== objetivo) continue;
      if (v?.price?.salePrice !== precioVenta) continue;
      const tachado = v.price.listPrice;
      return typeof tachado === "number" && tachado > precioVenta ? tachado : null;
    }
  }
  return null;
}

/** Ejecuta `fn` sobre `items` con un límite de tareas en paralelo. */
export async function mapLimit(items, limite, fn) {
  const out = new Array(items.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: Math.min(limite, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
