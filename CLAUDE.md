# Alejandría

Tienda de venta directa (Yanbal y Natura) para Colombia. Next.js 16 + React 19 +
TypeScript + Tailwind v4, sin base de datos: la tienda lee los JSON que deja el
pipeline de `scripts/`.

**Antes de proponer trabajo, lee [`docs/estado-y-plan.md`](docs/estado-y-plan.md):**
qué está hecho, qué falta y qué ya se decidió (y por qué). Evita rehacer lo hecho
y volver sobre decisiones cerradas.

El README explica el pipeline y el porqué de cada decisión técnica. Esto son las
reglas que no se ven en el código y que cuestan caro romper.

## No inventar datos. Nunca.

Todo el valor del proyecto está en que los datos son reales y verificados contra
la fuente. Está prohibido inventar precios, productos, códigos, fechas de
vigencia, reseñas, testimonios, tiempos de entrega o texto legal.

Cuando falta un dato que solo puede decidir una persona, va un placeholder en
`[CORCHETES]` y se muestra tal cual en el sitio. Es feo a propósito: un corchete
en pantalla se arregla, un dato inventado se publica.

Los que faltan hoy están en `lib/negocio.ts`, `lib/destacados.ts`, `lib/notas.ts`
y las tres páginas de `app/politicas/`. **No los llenes con valores plausibles.**

## Contar antes y después

Este pipeline falló en silencio dos veces —terminó con código 0 y cara de éxito
mientras entregaba basura—: un regex cogió el precio tachado en vez del real e
inventó descuentos del 45 %, y un merge dejó 14 descripciones de 367.

Lo único que los delató fue comparar cifras antes y después. Por eso existe
`scripts/verificar-cobertura.mjs`, y por eso ni el workflow ni `--auto` publican
si la cobertura cae. No relajes ese umbral para que "pase"; si cae, hay una razón.

## Detectada no es vigente

Las marcas publican la revista de la campaña siguiente días antes de que entre en
vigencia, pero su tienda sigue sirviendo la vieja — y de la tienda salen las
fotos. Enriquecer una campaña antes de tiempo da datos malos (la C10 dio 35 % de
cobertura donde la C09 tiene 94 %).

Nunca mergees datos de una campaña que todavía no rige.

## Qué corre dónde

`natura.com.co` responde 403 a toda IP de datacenter. La parte de Natura solo se
puede completar desde una conexión residencial colombiana:

```bash
node scripts/actualizar-campana.mjs          # las dos marcas, desde una máquina que alcance ambas
node scripts/detectar-campana.mjs            # ¿hay campaña nueva?
```

Yanbal sí corre desde cualquier lado, y de eso se encarga
`.github/workflows/campana.yml`.

## Convenciones

- **Español** en comentarios, mensajes de commit y todo lo que ve el usuario.
- Los comentarios explican **por qué**, no qué. Si documentas una trampa,
  documenta cómo se manifiesta (qué se ve cuando falla), no solo la regla.
- Los scripts de `scripts/` son **ESM sin dependencias**. Mantenlo así: se corren
  en máquinas ajenas y en CI, y cada dependencia es una razón más para que fallen.
- Antes de dar algo por bueno: `npm run build` y `npx eslint .`. El build genera
  801 páginas; si algo del formato de datos cambió, se cae ahí.
- No commitear datos de una campaña que no rige (ver arriba).

## Trampas ya pagadas

- `app/globals.css`: las reglas sueltas van dentro de `@layer base`. Tailwind v4
  mete sus utilidades en capas, y **el CSS sin capa siempre gana** — un
  `a { color: … }` fuera de capa dejó los botones de WhatsApp con el texto
  invisible durante un rato.
- `eslint.config.mjs`: `eslint-config-next` ya exporta flat config. Pasarlo por
  `FlatCompat` revienta con un JSON circular. Y la versión de React va fija:
  `eslint-plugin-react` detecta la versión llamando a una API que ESLint 10 quitó.
- Los nombres de la revista de Natura no son identidad —doce productos se llaman
  "Crema nutritiva para el cuerpo 400 ml"—. Manda `nombreSitio` cuando existe.
