# Diseño

Fuente del lienzo de diseño publicado en claude.ai/code. Dirección elegida: **C · La consultora** —
la persona como protagonista de la tienda.

| Archivo | Pantalla |
|---|---|
| `Main.dc.html` | Landing (escritorio) |
| `Catalogo.dc.html` | Catálogo con filtros |
| `Ficha.dc.html` | Ficha de producto (Essencial Oud, datos reales) |
| `LandingMovil.dc.html` | Landing a 390 px |
| `DireccionA.dc.html`, `DireccionB.dc.html` | Bocetos descartados |
| `canvas.json` | Disposición de los tableros y páginas |
| `*.jpg` | Fotos reales de producto, reducidas a ≤ 60 KB |

Sistema visual: fondo `#EEF1EA`, tinta `#2B2E26`, secundario `#56604F`, acento `#3F5A3C`,
superficies blancas con radio 20 px, botones en píldora. Tipografías Gloock (títulos) y
Albert Sans (texto), de Google Fonts.

Los productos, precios y cifras vienen del pipeline de `data/`. Lo que va entre `[CORCHETES]`
son datos del negocio que faltan: nombre, foto, ciudad, código, ciudades con contra entrega,
costo de envío, días de devolución y duración de los perfumes.
