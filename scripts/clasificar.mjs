#!/usr/bin/env node
// Asigna categoría a cada producto de un catálogo normalizado.
//
// Las revistas no publican la categoría, y el campo `categoria` que trae el sitio
// de Natura son etiquetas de campaña ("aniversario", "carrito20", "2x1"), no una
// taxonomía. Hay que derivarla del nombre.
//
//   node scripts/clasificar.mjs data/<marca>-<campaña>-normalizado.json
//
// El orden de las reglas es la parte que importa: un nombre puede disparar varias
// y gana la primera. "Base antiedad" es maquillaje aunque diga antiedad; "Crema
// para peinar" es cabello aunque diga crema; "Desodorante perfumado roll on" es
// desodorante aunque diga perfumado. Las reglas van de la más específica a la más
// general por eso.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const sinTildes = (s) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

/** De más específica a más general. La primera que coincide, gana. */
const REGLAS = [
  // Un set que enumera productos de categorías distintas —"Set Cielo: Eau de
  // Parfum + Jabón + desodorante"— no pertenece a ninguna de ellas. Un set de
  // una sola categoría, como "Set Collares Aimee", sí, y por eso la regla exige
  // el separador de enumeración.
  ["Sets y regalos", /^(set|kit|combo)\b.*[:+]/],

  // Las colecciones de bijouterie se nombran solo por su nombre propio, sin
  // decir de qué pieza se trata.
  ["Joyería", /\b(collar(es)?|aretes?|argollas?|pulseras?|anillos?|sortijas?|dijes?|colgantes?|gemelos|doretti|dorezzi|topos|cadenas?|coleccion (amira|nuvia|aimee|classic))\b/],

  ["Desodorantes", /\b(desodorante|antitranspirante|roll on|rollon)\b/],

  ["Maquillaje", /\b(labial|lip |hydra-lip|gloss|brillo labial|balsamo labial|esmaltes?|base |bases |polvos?|rubor(es)?|sombras?|paletas?|correctores?|corrector|iluminador(es)?|delineador(es)?|rimel|pestanina|mascara para pestanas|mascara alargadora|brochas?|pinceles?|pincel|primer|bronceador facial|matificante|tinta|labios|cejas|unas|bb cream|cc cream|barra multiusos|jelly stick|uniquecil|duo multiusos|prep)\b/],

  ["Cabello", /\b(shampoo|champu|acondicionador|crema para peinar|mascarilla(?!\s+facial)|mascara capilar|tratamiento capilar|serum capilar|anticaida|anticaspa|rizos|alisado|leave|capilar|cabellos?|frizz|puntas|polinutricion|matizador|protector termico|antidecoloracion|pro-reconstructor|ampolla)\b/],

  ["Cuidado facial", /\b(serum|crema facial|limpiador|tonico|antisenales|contorno|ojeras|para ojos|micelar|desmaquillante|suero|antimanchas|hialuronico|rejuvenecedor(a)?|elixir de vida|aqua fix|antigrasa|poros|extracto divino|sensi derm|leche limpiadora|desmaquillador|piel sensible|mousse de limpieza|espuma de limpieza|esencia de tratamiento|chronos|antiedad|antiarrugas|hidratante facial|rostro|bruma facial|mascarilla facial|gel facial|exfoliante facial)\b/],

  ["Protección solar", /\b(protector solar|proteccion solar|total block|fps|spf|bloqueador)\b/],

  ["Cuidado corporal", /\b(crema (nutritiva|hidratante|corporal|reparadora)|pulpa hidratante|locion hidratante|body|corporal|cuerpo|jabon(es)?|manos|pies|exfoliante|aceite (bifasico|trifasico|corporal)|talco|crema para el cuerpo)\b/],

  ["Perfumería", /\b(parfum|perfume|colonia|eau |splash|body spray|locion perfumada|fragancia|deo colonia|agua de colonia)\b/],

  ["Bebé y niños", /\b(baby|bebe|ninas?|ninos?|teens|mama y bebe|infantil)\b/],

  ["Sets y regalos", /\b(set |kit |combo|caja de regalo|bolsa|estuche|regalo|neceser)\b/],

  ["Accesorios", /\b(diadema|espejo|cepillo|termo|mug|toalla|scrunchie|llavero|libreta)\b/],
];

/**
 * Respaldo por línea de producto, para lo que ninguna palabra clave atrapa.
 * Solo se listan las líneas cuya categoría dominante supera el 70 % en los datos
 * reales; Tododia y Ekos quedan fuera a propósito porque reparten entre cuidado
 * corporal y cabello, y adivinar ahí ensucia más de lo que arregla.
 */
const LINEAS = new Map([
  ["Lumina", "Cabello"],
  ["Chronos Derma", "Cuidado facial"],
  ["Chronos", "Cuidado facial"],
  ["Essencial", "Perfumería"],
  ["Natura Solar", "Protección solar"],
  ["Kaiak", "Perfumería"],
  ["Humor", "Perfumería"],
  ["Sr. N", "Perfumería"],
  ["Aguas Natura", "Perfumería"],
  ["Águas de Natura", "Perfumería"],
  ["Una", "Maquillaje"],
]);

/**
 * Devuelve la categoría y de dónde salió. Las palabras clave mandan; la línea
 * de producto solo entra cuando ninguna coincide, y queda marcada para que se
 * pueda revisar aparte.
 */
function clasificar(nombre, marca) {
  const n = sinTildes(nombre);
  for (const [categoria, patron] of REGLAS) {
    if (patron.test(n)) return { categoria, origen: "nombre" };
  }
  const porLinea = marca && LINEAS.get(marca);
  if (porLinea) return { categoria: porLinea, origen: "linea" };
  return { categoria: null, origen: null };
}

async function main() {
  const entrada = process.argv[2];
  if (!entrada) {
    console.error("Uso: node scripts/clasificar.mjs <archivo-normalizado.json>");
    process.exit(1);
  }
  const ruta = resolve(process.cwd(), entrada);
  const d = JSON.parse(await readFile(ruta, "utf8"));

  const productos = d.productos.map((p) => {
    const { categoria, origen } = clasificar(p.nombre, p.marca);
    return { ...p, categoria, origenCategoria: origen };
  });

  const cuenta = new Map();
  for (const p of productos) {
    const k = p.categoria ?? "(sin clasificar)";
    cuenta.set(k, (cuenta.get(k) ?? 0) + 1);
  }

  const salida = ruta.replace(/-normalizado\.json$/, "-clasificado.json");
  await writeFile(salida, JSON.stringify({ ...d, clasificado: true, productos }, null, 2));

  const total = productos.length;
  const sin = cuenta.get("(sin clasificar)") ?? 0;
  console.log(`  ${total} productos · clasificados ${total - sin} (${Math.round(((total - sin) / total) * 100)} %)\n`);
  for (const [k, v] of [...cuenta].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(v).padStart(4)}  ${k}`);
  }

  const porLinea = productos.filter((p) => p.origenCategoria === "linea").length;
  if (porLinea) console.log(`\n  ${porLinea} clasificados por línea de producto (revisables)`);

  const pendientes = productos.filter((p) => !p.categoria);
  if (pendientes.length) {
    console.log(`\n  Sin clasificar, muestra:`);
    for (const p of pendientes.slice(0, 15)) console.log(`     ${p.nombre.slice(0, 62)}`);
  }
  console.log(`\n  ${salida}`);
}

main().catch((e) => {
  console.error(`\nFalló: ${e.message}`);
  process.exit(1);
});
