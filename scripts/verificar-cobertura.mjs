#!/usr/bin/env node
// Compara la cobertura de una campaña nueva contra la que ya está publicada.
//
// Existe porque este pipeline ya falló en silencio dos veces: un regex cogió el
// precio tachado en vez del real e inventó descuentos del 45 %, y un merge mal
// hecho dejó 14 descripciones de 367. En los dos casos el script terminó con
// código 0 y cara de éxito. Lo único que los delató fue contar antes y después.
//
//   node scripts/verificar-cobertura.mjs <nuevo.json> <anterior.json> [--puntos 10]
//
// Compara PORCENTAJES, no cantidades: una campaña nueva legítimamente trae más
// o menos productos que la anterior, pero no tiene por qué bajar la proporción
// de los que llevan foto. Sale con 1 si alguna proporción cae más de `--puntos`
// puntos porcentuales, que es la señal de que algo se rompió y no de que la
// campaña cambió.

import { readFile } from "node:fs/promises";

/** Puntos porcentuales de caída que se toleran antes de dar la alarma. */
const PUNTOS_POR_DEFECTO = 10;

const MEDIDAS = [
  { clave: "conFoto", etiqueta: "con foto", test: (p) => !!p.imagenPrincipal },
  { clave: "conDescripcion", etiqueta: "con descripción", test: (p) => !!p.descripcion },
  { clave: "conPrecio", etiqueta: "con precio", test: (p) => typeof p.precio === "number" && p.precio > 0 },
  { clave: "conCategoria", etiqueta: "con categoría", test: (p) => !!p.categoria },
  { clave: "publicables", etiqueta: "publicables", test: (p) => !!p.publicable },
];

function medir(productos) {
  const total = productos.length;
  const r = { total };
  for (const m of MEDIDAS) {
    const n = productos.filter(m.test).length;
    r[m.clave] = { n, pct: total ? (n / total) * 100 : 0 };
  }
  return r;
}

const pct = (x) => `${x.toFixed(1)} %`;

async function cargar(ruta) {
  const datos = JSON.parse(await readFile(ruta, "utf8"));
  if (!Array.isArray(datos.productos)) {
    throw new Error(`${ruta} no tiene un arreglo \`productos\``);
  }
  return datos;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const iPuntos = process.argv.indexOf("--puntos");
  const umbral = iPuntos === -1 ? PUNTOS_POR_DEFECTO : Number(process.argv[iPuntos + 1]);

  if (args.length < 2) {
    console.error("Uso: node scripts/verificar-cobertura.mjs <nuevo.json> <anterior.json> [--puntos 10]");
    process.exit(2);
  }
  if (!Number.isFinite(umbral) || umbral < 0) {
    console.error(`--puntos tiene que ser un número ≥ 0, no "${process.argv[iPuntos + 1]}"`);
    process.exit(2);
  }

  const [rutaNueva, rutaVieja] = args;
  const nueva = await cargar(rutaNueva);
  const vieja = await cargar(rutaVieja);

  const a = medir(vieja.productos);
  const b = medir(nueva.productos);

  console.log(`Anterior: ${vieja.campana ?? rutaVieja} — ${a.total} productos`);
  console.log(`Nueva:    ${nueva.campana ?? rutaNueva} — ${b.total} productos`);
  console.log();
  console.log("| Medida | Antes | Ahora | Δ |");
  console.log("|---|---|---|---|");

  const caidas = [];
  for (const m of MEDIDAS) {
    const antes = a[m.clave];
    const ahora = b[m.clave];
    const delta = ahora.pct - antes.pct;
    const señal = delta < -umbral ? " ⚠️" : "";
    console.log(
      `| ${m.etiqueta} | ${antes.n} (${pct(antes.pct)}) | ${ahora.n} (${pct(ahora.pct)}) | ` +
        `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} pp${señal} |`,
    );
    if (delta < -umbral) caidas.push({ ...m, antes, ahora, delta });
  }
  console.log();

  if (caidas.length === 0) {
    console.log(`✅ Sin caídas mayores a ${umbral} puntos porcentuales.`);
    return;
  }

  console.log(`⚠️  ${caidas.length} medida(s) cayeron más de ${umbral} puntos porcentuales:`);
  for (const c of caidas) {
    console.log(`   · ${c.etiqueta}: ${pct(c.antes.pct)} → ${pct(c.ahora.pct)} (${c.delta.toFixed(1)} pp)`);
  }
  console.log();
  console.log("Esto no significa necesariamente que la campaña esté mal: puede que");
  console.log("la marca todavía no haya publicado las fichas del ciclo nuevo. Pero sí");
  console.log("significa que NO se debe publicar sin mirarlo primero.");
  process.exit(1);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(2);
});
