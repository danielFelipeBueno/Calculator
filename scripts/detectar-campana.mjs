#!/usr/bin/env node
// Detecta si alguna marca ya publicó una campaña más nueva que la que tenemos.
//
// No hace falta que nadie nos pase la URL: las dos marcas numeran sus revistas
// de forma consecutiva y publican la siguiente ANTES de que entre en vigencia,
// así que basta con pedir el número siguiente y ver si responde.
//
//   Yanbal  docs.yanbal.com/cdigital/co/<año>/c<n>/oficial/
//   Natura  co.natura.digital-catalogue.com/co/<año>/<n>/revista/ciclo-<n>/view
//
// La campaña que tenemos hoy no se adivina: sale del campo `origen` que cada
// archivo de data/ guarda con la URL de la que se extrajo.
//
//   node scripts/detectar-campana.mjs            # informe legible
//   node scripts/detectar-campana.mjs --json     # para consumir desde CI
//
// Sale con código 0 siempre que la consulta funcione, haya novedad o no. Un
// código distinto de 0 significa que no se pudo comprobar, que no es lo mismo
// que "no hay campaña nueva".

import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** Cuántos números hacia adelante se prueban antes de rendirse. */
const ADELANTE = 3;

const MARCAS = {
  yanbal: {
    nombre: "Yanbal",
    // data/yanbal-col-2026-c09-clasificado.json → origen .../co/2026/c9/oficial/
    patronOrigen: /\/co\/(\d{4})\/c(\d+)\//,
    url: (anio, n) => `https://docs.yanbal.com/cdigital/co/${anio}/c${n}/oficial/`,
    // El flipbook de iPaper solo sirve si trae el dataStore con los enrichments;
    // una página de error puede responder 200 igual.
    valida: (cuerpo) => cuerpo.includes("chunkUrls") && cuerpo.includes("dataStore"),
  },
  natura: {
    nombre: "Natura",
    // data/natura-revista-ciclo-13-clasificado.json → origen .../co/2026/13/revista/ciclo-13/view
    patronOrigen: /\/co\/(\d{4})\/(\d+)\/revista\//,
    url: (anio, n) =>
      `https://co.natura.digital-catalogue.com/co/${anio}/${n}/revista/ciclo-${n}/view`,
    valida: (cuerpo) => cuerpo.length > 10000,
  },
};

/**
 * Pide una URL y dice si existe de verdad.
 *
 * Mirar el código de respuesta no basta: Akamai y compañía sirven páginas de
 * bloqueo y de error con un 200 encima (ver README, sección de Natura). Por eso
 * cada marca trae su propia comprobación sobre el cuerpo.
 */
async function existe(url, valida) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return { existe: false, motivo: `HTTP ${res.status}` };
    const cuerpo = await res.text();
    return valida(cuerpo)
      ? { existe: true }
      : { existe: false, motivo: `responde 200 pero el contenido no es una revista (${cuerpo.length} b)` };
  } catch (err) {
    return { existe: false, motivo: `no respondió: ${err.message}`, error: true };
  }
}

/** La campaña que tenemos hoy, leída del `origen` de los archivos de data/. */
async function campanaActual(clave, marca) {
  const dir = resolve(process.cwd(), "data");
  const archivos = (await readdir(dir)).filter(
    (f) => f.startsWith(`${clave}-`) && f.endsWith("-clasificado.json"),
  );

  let mejor = null;
  for (const archivo of archivos) {
    let datos;
    try {
      datos = JSON.parse(await readFile(resolve(dir, archivo), "utf8"));
    } catch {
      continue;
    }
    const m = marca.patronOrigen.exec(datos.origen ?? "");
    if (!m) continue;
    const anio = Number(m[1]);
    const numero = Number(m[2]);
    // Si hubiera varios archivos, manda el más nuevo.
    if (!mejor || anio > mejor.anio || (anio === mejor.anio && numero > mejor.numero)) {
      mejor = { anio, numero, archivo, origen: datos.origen };
    }
  }
  return mejor;
}

/**
 * Busca la campaña más nueva que exista a partir de la que tenemos.
 *
 * Prueba los siguientes números del mismo año y, si ninguno responde, los
 * primeros del año siguiente — el cambio de año reinicia la numeración y ahí
 * el "+1" a secas dejaría de encontrar nada.
 */
async function buscarNueva(marca, actual) {
  const candidatos = [];
  for (let i = 1; i <= ADELANTE; i++) {
    candidatos.push({ anio: actual.anio, numero: actual.numero + i });
  }
  for (let n = 1; n <= ADELANTE; n++) {
    candidatos.push({ anio: actual.anio + 1, numero: n });
  }

  let ultima = null;
  const probados = [];
  for (const c of candidatos) {
    const url = marca.url(c.anio, c.numero);
    const r = await existe(url, marca.valida);
    probados.push({ ...c, url, ...r });
    if (r.existe) ultima = { ...c, url };
    // Un hueco en la numeración del mismo año significa que no hay más;
    // el salto de año se prueba completo porque ahí sí hay discontinuidad.
    else if (c.anio === actual.anio && !ultima) break;
  }
  return { ultima, probados };
}

async function main() {
  const comoJson = process.argv.includes("--json");
  const informe = { generado: new Date().toISOString(), marcas: {}, hayNovedad: false };
  let falloAlguna = false;

  for (const [clave, marca] of Object.entries(MARCAS)) {
    const actual = await campanaActual(clave, marca);
    if (!actual) {
      informe.marcas[clave] = { error: "no encontré de qué campaña partir en data/" };
      falloAlguna = true;
      continue;
    }

    const { ultima, probados } = await buscarNueva(marca, actual);
    // Si ninguna consulta llegó siquiera a responder, no sabemos nada: eso es un
    // fallo, no un "no hay novedad".
    if (!ultima && probados.every((p) => p.error)) {
      informe.marcas[clave] = {
        actual,
        error: "ninguna consulta respondió; no se pudo comprobar",
        probados,
      };
      falloAlguna = true;
      continue;
    }

    informe.marcas[clave] = { actual, nueva: ultima, probados };
    if (ultima) informe.hayNovedad = true;
  }

  if (comoJson) {
    console.log(JSON.stringify(informe, null, 2));
  } else {
    for (const [clave, r] of Object.entries(informe.marcas)) {
      const nombre = MARCAS[clave].nombre;
      if (r.error) {
        console.log(`${nombre}: ⚠️  ${r.error}`);
        continue;
      }
      const a = `${r.actual.anio} nº ${r.actual.numero}`;
      if (r.nueva) {
        console.log(`${nombre}: hay campaña nueva — tenemos ${a}, existe ${r.nueva.anio} nº ${r.nueva.numero}`);
        console.log(`         ${r.nueva.url}`);
      } else {
        console.log(`${nombre}: al día (${a}); no hay una más nueva publicada`);
      }
    }
  }

  // Escribe para GitHub Actions si estamos dentro de un workflow.
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    const y = informe.marcas.yanbal ?? {};
    const n = informe.marcas.natura ?? {};
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `hay_novedad=${informe.hayNovedad}`,
        `yanbal_nueva=${y.nueva ? "true" : "false"}`,
        `yanbal_url=${y.nueva?.url ?? ""}`,
        `natura_nueva=${n.nueva ? "true" : "false"}`,
        `natura_url=${n.nueva?.url ?? ""}`,
      ].join("\n") + "\n",
    );
  }

  if (falloAlguna) process.exit(2);
}

main().catch((err) => {
  console.error(`No se pudo comprobar: ${err.message}`);
  process.exit(2);
});
