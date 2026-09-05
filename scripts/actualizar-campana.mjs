#!/usr/bin/env node
// Actualiza el catálogo entero a la campaña vigente, en un solo comando.
//
// Pensado para correr en una máquina con conexión residencial colombiana. El
// workflow de GitHub (.github/workflows/campana.yml) hace la parte de Yanbal
// solo, pero no puede con Natura: natura.com.co responde 403 a toda IP de
// datacenter. Este script hace las dos, y comprueba antes qué alcanza de verdad
// desde donde se está ejecutando.
//
//   node scripts/actualizar-campana.mjs                 # lo que haya nuevo
//   node scripts/actualizar-campana.mjs --forzar        # aunque no haya novedad
//   node scripts/actualizar-campana.mjs --marca natura  # solo una marca
//   node scripts/actualizar-campana.mjs --auto          # para tarea programada
//
// Por defecto no commitea ni pushea: deja los archivos y dice qué hacer con
// ellos. Con --auto empuja una RAMA si la cobertura pasó —nunca a main, y nunca
// si los datos vinieron mal—. Publicar es una decisión, no un paso del pipeline:
// las marcas sacan la campaña siguiente ANTES de que entre en vigencia, así que
// mergear apenas aparece mostraría precios que todavía no rigen.

import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Lo que cada marca necesita alcanzar para poder completarse. */
const REQUISITOS = {
  yanbal: {
    nombre: "Yanbal",
    sitio: "https://www.yanbal.com/co/",
    // Yanbal se alcanza igual desde la nube; aquí solo se comprueba por si
    // la máquina no tiene salida a internet.
    siFalla: "Sin el sitio de Yanbal no hay fotos ni stock.",
  },
  natura: {
    nombre: "Natura",
    sitio: "https://www.natura.com.co/",
    siFalla:
      "natura.com.co bloquea las IPs de datacenter. Este paso necesita una\n" +
      "   conexión residencial colombiana — corre el script desde tu casa, no\n" +
      "   desde un servidor, una VPN extranjera ni un runner de GitHub.",
  },
};

const azul = (s) => `\x1b[36m${s}\x1b[0m`;
const verde = (s) => `\x1b[32m${s}\x1b[0m`;
const rojo = (s) => `\x1b[31m${s}\x1b[0m`;
const gris = (s) => `\x1b[90m${s}\x1b[0m`;

/** Corre un script del repo dejando que su salida fluya a la consola. */
function correr(script, args = []) {
  return new Promise((cumplir, fallar) => {
    console.log(gris(`\n  $ node scripts/${script} ${args.join(" ")}`));
    const hijo = spawn(process.execPath, [resolve("scripts", script), ...args], {
      stdio: "inherit",
    });
    hijo.on("error", fallar);
    hijo.on("close", (codigo) =>
      codigo === 0 ? cumplir() : fallar(new Error(`${script} salió con código ${codigo}`)),
    );
  });
}

/** ¿Esta máquina alcanza el sitio, o le están cerrando la puerta? */
async function alcanza(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { ok: false, motivo: `HTTP ${res.status}` };
    // Un cuerpo diminuto con 200 encima es la firma de una página de bloqueo.
    const cuerpo = await res.text();
    return cuerpo.length > 5000
      ? { ok: true }
      : { ok: false, motivo: `responde 200 pero con ${cuerpo.length} b — parece página de bloqueo` };
  } catch (err) {
    return { ok: false, motivo: err.message };
  }
}

/** El último clasificado de una marca, para comparar cobertura contra él. */
async function ultimoClasificado(clave) {
  const dir = resolve("data");
  const archivos = (await readdir(dir))
    .filter((f) => f.startsWith(`${clave}-`) && f.endsWith("-clasificado.json"))
    .sort();
  return archivos.length ? resolve(dir, archivos[archivos.length - 1]) : null;
}

/** Detección de campaña nueva, reutilizando el script que ya la sabe hacer. */
async function detectar() {
  return new Promise((cumplir, fallar) => {
    const hijo = spawn(process.execPath, [resolve("scripts", "detectar-campana.mjs"), "--json"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let salida = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.on("error", fallar);
    hijo.on("close", () => {
      try {
        cumplir(JSON.parse(salida));
      } catch {
        fallar(new Error("detectar-campana.mjs no devolvió JSON legible"));
      }
    });
  });
}

/**
 * El nombre de archivo que dejará extract-natura para una URL dada.
 * Replica su regla (`<marca>-<penúltimos dos segmentos>`) para poder encadenar
 * los pasos siguientes sin adivinar.
 */
function archivoNatura(url) {
  const base = url.replace(/\/+$/, "");
  return `data/natura-${base.split("/").slice(-3, -1).join("-")}.json`;
}

async function actualizarYanbal(url) {
  const anterior = await ultimoClasificado("yanbal");
  const antes = new Set(await readdir(resolve("data")));

  await correr("extract-yanbal.mjs", [url]);

  const despues = await readdir(resolve("data"));
  const crudo = despues.find(
    (f) => !antes.has(f) && f.endsWith(".json") && !/-(enriquecido|normalizado|clasificado)\.json$/.test(f),
  );
  if (!crudo) throw new Error("extract-yanbal no dejó ningún archivo nuevo en data/");

  const ruta = `data/${crudo}`;
  await correr("indexar-yanbal.mjs");
  await correr("enrich-yanbal.mjs", [ruta]);
  await correr("normalizar.mjs", [ruta.replace(/\.json$/, "-enriquecido.json")]);
  await correr("clasificar.mjs", [ruta.replace(/\.json$/, "-normalizado.json")]);

  return { nuevo: ruta.replace(/\.json$/, "-clasificado.json"), anterior };
}

async function actualizarNatura(url) {
  const anterior = await ultimoClasificado("natura");
  const ruta = archivoNatura(url);

  await correr("extract-natura.mjs", [url, "Natura"]);
  await correr("indexar-natura.mjs");
  await correr("enrich-natura.mjs", [ruta]);
  await correr("normalizar.mjs", [ruta.replace(/\.json$/, "-enriquecido.json")]);
  await correr("clasificar.mjs", [ruta.replace(/\.json$/, "-normalizado.json")]);

  return { nuevo: ruta.replace(/\.json$/, "-clasificado.json"), anterior };
}

/**
 * Empuja los datos nuevos en una rama aparte. Solo se llama en modo --auto y
 * solo si la cobertura pasó.
 *
 * Empuja una RAMA, nunca a main: lo que se publica lo decide una persona. Y
 * hace falta que lo decida, porque las marcas publican la campaña siguiente
 * antes de que entre en vigencia.
 */
function git(args, { silencioso = false } = {}) {
  return new Promise((cumplir, fallar) => {
    const hijo = spawn("git", args, {
      stdio: silencioso ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let salida = "";
    if (silencioso) hijo.stdout.on("data", (d) => (salida += d));
    hijo.on("error", fallar);
    hijo.on("close", (c) =>
      c === 0 ? cumplir(salida) : fallar(new Error(`git ${args[0]} salió con código ${c}`)),
    );
  });
}

async function publicarRama(resultados) {
  // Sin cambios no hay nada que empujar. Pasa de verdad: --forzar re-extrae una
  // campaña que ya estaba, y `git commit` sin nada preparado sale con error.
  const cambios = await git(["status", "--porcelain", "data/"], { silencioso: true });
  if (!cambios.trim()) return null;

  const volverA = (await git(["branch", "--show-current"], { silencioso: true })).trim();

  // Dos corridas el mismo día —una a mano y la programada, o un reintento— no
  // pueden chocar por el nombre. Se busca hasta dar con uno libre: probar un
  // solo alternativo no basta, porque ese también puede estar tomado.
  const base = `datos/campana-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;
  let rama = base;
  for (let n = 2; (await git(["branch", "--list", rama], { silencioso: true })).trim(); n++) {
    rama = `${base}-${n}`;
  }

  try {
    await git(["switch", "-c", rama]);
    await git(["add", "data/"]);
    await git(["commit", "-m", `Datos: ${resultados.map((r) => r.nombre).join(" y ")} al día`]);
    await git(["push", "-u", "origin", rama]);
  } finally {
    // Volver siempre a la rama de partida: si no, la corrida de mañana saldría
    // de la rama de hoy y las ramas de datos se irían encadenando unas sobre
    // otras.
    if (volverA) await git(["switch", volverA], { silencioso: true }).catch(() => {});
  }
  return rama;
}

async function main() {
  const forzar = process.argv.includes("--forzar");
  const auto = process.argv.includes("--auto");
  const iMarca = process.argv.indexOf("--marca");
  const soloMarca = iMarca === -1 ? null : process.argv[iMarca + 1];

  if (soloMarca && !REQUISITOS[soloMarca]) {
    console.error(`--marca tiene que ser "yanbal" o "natura", no "${soloMarca}"`);
    process.exit(2);
  }

  // 1. Comprobar qué alcanza esta máquina ANTES de empezar. Descubrirlo a la
  //    mitad deja los datos a medio hacer, que es peor que no empezar.
  console.log(azul("\n▸ Comprobando qué alcanza esta máquina\n"));
  const alcanzables = {};
  for (const [clave, req] of Object.entries(REQUISITOS)) {
    if (soloMarca && clave !== soloMarca) continue;
    const r = await alcanza(req.sitio);
    alcanzables[clave] = r.ok;
    console.log(`  ${r.ok ? verde("✓") : rojo("✗")} ${req.nombre.padEnd(7)} ${req.sitio}`);
    if (!r.ok) {
      console.log(gris(`     ${r.motivo}`));
      console.log(gris(`     ${req.siFalla}`));
    }
  }

  if (!Object.values(alcanzables).some(Boolean)) {
    console.log(rojo("\nNo se alcanza ningún sitio de marca. Sin eso no hay nada que hacer."));
    process.exit(1);
  }

  // 2. ¿Hay campaña nueva?
  console.log(azul("\n▸ Buscando campaña nueva\n"));
  const informe = await detectar();

  const trabajo = [];
  for (const [clave, req] of Object.entries(REQUISITOS)) {
    if (soloMarca && clave !== soloMarca) continue;
    const m = informe.marcas[clave];
    if (!m || m.error) {
      console.log(`  ${rojo("✗")} ${req.nombre}: ${m?.error ?? "sin datos"}`);
      continue;
    }
    const url = m.nueva?.url ?? (forzar ? m.actual.origen : null);
    if (!url) {
      console.log(`  ${gris("·")} ${req.nombre}: al día (nº ${m.actual.numero})`);
      continue;
    }
    if (!alcanzables[clave]) {
      console.log(`  ${rojo("✗")} ${req.nombre}: hay campaña nueva pero esta máquina no puede completarla`);
      continue;
    }
    console.log(`  ${verde("✓")} ${req.nombre}: ${m.nueva ? `campaña nueva nº ${m.nueva.numero}` : "re-corrida forzada"}`);
    trabajo.push({ clave, nombre: req.nombre, url });
  }

  if (trabajo.length === 0) {
    console.log(verde("\nNada que hacer. El catálogo está al día.\n"));
    return;
  }

  // 3. Correr el pipeline de cada marca.
  const resultados = [];
  for (const t of trabajo) {
    console.log(azul(`\n▸ ${t.nombre}\n`));
    const r = t.clave === "yanbal" ? await actualizarYanbal(t.url) : await actualizarNatura(t.url);
    resultados.push({ ...t, ...r });
  }

  // 4. Comparar cobertura. Si cae, se avisa pero no se borra nada: el archivo
  //    queda ahí para poder mirarlo.
  console.log(azul("\n▸ Cobertura frente a la campaña vigente\n"));
  let algunaCayo = false;
  for (const r of resultados) {
    if (!r.anterior) {
      console.log(gris(`  ${r.nombre}: no hay campaña previa con la que comparar.`));
      continue;
    }
    try {
      await correr("verificar-cobertura.mjs", [r.nuevo, r.anterior]);
    } catch {
      algunaCayo = true;
    }
  }

  // 5. Qué hacer ahora.
  console.log(azul("\n▸ Listo\n"));
  for (const r of resultados) console.log(`  ${r.nuevo}`);

  if (algunaCayo) {
    console.log(rojo("\n  ⚠️  La cobertura cayó en alguna marca. NO publiques sin mirar por qué."));
    console.log(gris("     Puede que la marca no haya publicado aún las fichas del ciclo nuevo."));
  }

  // 5. En modo automático (tarea programada), empujar la rama si los datos
  //    están sanos. Si no lo están, no se empuja nada y ya está: la tarea
  //    vuelve a correr mañana y el problema se arregla solo el día que la
  //    tienda de la marca cambie de campaña.
  if (auto) {
    if (algunaCayo) {
      console.log(gris("\n  Modo --auto: no se empuja nada. Se reintenta en la próxima corrida.\n"));
      return;
    }
    console.log(azul("\n▸ Empujando rama\n"));
    const rama = await publicarRama(resultados);
    if (!rama) {
      console.log(gris("  Los datos no cambiaron respecto a lo que ya está commiteado. Nada que empujar.\n"));
      return;
    }
    console.log(verde(`\n  Rama ${rama} empujada.`));
    console.log(gris("  Falta actualizar lib/negocio.ts y abrir el PR — eso no lo decide un script.\n"));
    return;
  }

  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  console.log(`
  Falta, y son decisiones tuyas:

  1. Actualizar la campaña y su vigencia en ${azul("lib/negocio.ts")}.
  2. ${azul("npm run build")} — comprobar que el sitio compila con los datos nuevos.
  3. Publicar ${rojo("el día que venza la campaña vieja")}, no antes: las marcas
     publican la siguiente por adelantado, y adelantarse mostraría precios
     que todavía no rigen.

     git checkout -b datos/campana-${hoy}
     git add data/ lib/negocio.ts
     git commit -m "Datos: campaña nueva"
     git push -u origin HEAD
`);
}

main().catch((err) => {
  console.error(rojo(`\nSe detuvo: ${err.message}`));
  console.error(gris("Los archivos que alcanzó a escribir siguen en data/ — revísalos antes de repetir."));
  process.exit(1);
});
