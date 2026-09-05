import yanbalData from "@/data/yanbal-col-2026-c09-clasificado.json";
import naturaData from "@/data/natura-revista-ciclo-13-clasificado.json";
import { idsDestacados } from "@/lib/destacados";

/**
 * Capa de datos de la tienda.
 *
 * Lee directamente los archivos que deja el pipeline (extraer → enriquecer →
 * normalizar → clasificar, ver README.md y scripts/). No hay base de datos
 * todavía: cuando exista, esta es la única capa que hay que reescribir — el
 * resto de la app solo conoce el tipo `Producto` de abajo, nunca el JSON
 * crudo de cada marca.
 */

export type Origen = "yanbal" | "natura";

export const MARCAS: Record<Origen, string> = {
  yanbal: "Yanbal",
  natura: "Natura",
};

export interface Producto {
  /** Identificador único en la tienda: `${origen}-${codigo}`. */
  id: string;
  origen: Origen;
  /** Nombre de la marca, para mostrar. */
  marca: string;
  codigo: string;
  nombre: string;
  /** Texto de URL, sin el código — la ruta completa es /producto/{origen}/{codigo}/{slug}. */
  slug: string;
  /** Línea de producto dentro de la marca (Lumina, Tododia, Ekos...). Solo Natura la trae. */
  linea: string | null;
  categoria: string | null;
  precio: number;
  /** Precio tachado, cuando el producto está en oferta frente a su propio precio de lista. */
  precioLista: number | null;
  /** null = no lo sabemos (la marca no lo publica); true/false = si lo sabemos. */
  disponible: boolean | null;
  calificacion: number | null;
  descripcion: string | null;
  imagen: string;
  imagenesAdicionales: string[];
  /** Ficha del producto en el sitio oficial de la marca, si se encontró. */
  urlMarca: string | null;
  /** Página de la revista donde aparece, si se conoce. */
  pagina: number | null;
  /** Puntos de fidelización de la marca (solo Natura). */
  puntos: number | null;
}

interface ProductoCrudo {
  codigo: string;
  nombre: string | null;
  slug?: string | null;
  marca?: string | null;
  categoria?: string | null;
  precio: number;
  precioLista?: number | null;
  disponible?: string | boolean | null;
  calificacion?: number | null;
  descripcion?: string | null;
  imagenPrincipal?: string | null;
  imagenesAdicionales?: string[] | null;
  urlMarca?: string | null;
  pagina?: number | null;
  puntos?: number | null;
  publicable?: boolean;
}

function disponibilidad(raw: ProductoCrudo["disponible"]): boolean | null {
  if (raw === true || raw === "inStock") return true;
  if (raw === false || raw === "outOfStock") return false;
  return null;
}

/** El slug guardado es "código/texto"; la ruta ya trae el código aparte. */
function textoDeSlug(slug: string | null | undefined, codigo: string): string {
  if (!slug) return codigo;
  const i = slug.indexOf("/");
  return i === -1 ? slug : slug.slice(i + 1);
}

function aProducto(raw: ProductoCrudo, origen: Origen): Producto | null {
  // Sin nombre, foto o precio no hay ficha que mostrar — es justo lo que
  // `publicable` marca en el pipeline (ver scripts/normalizar.mjs).
  if (!raw.publicable || !raw.nombre || !raw.imagenPrincipal) return null;

  return {
    id: `${origen}-${raw.codigo}`,
    origen,
    marca: MARCAS[origen],
    codigo: raw.codigo,
    nombre: raw.nombre,
    slug: textoDeSlug(raw.slug, raw.codigo),
    linea: raw.marca ?? null,
    categoria: raw.categoria ?? null,
    precio: raw.precio,
    precioLista: raw.precioLista && raw.precioLista > raw.precio ? raw.precioLista : null,
    disponible: disponibilidad(raw.disponible),
    calificacion: raw.calificacion ?? null,
    descripcion: raw.descripcion ?? null,
    imagen: raw.imagenPrincipal,
    imagenesAdicionales: raw.imagenesAdicionales ?? [],
    urlMarca: raw.urlMarca ?? null,
    pagina: raw.pagina ?? null,
    puntos: raw.puntos ?? null,
  };
}

let cache: Producto[] | null = null;

/** Todos los productos publicables de las dos marcas, en un solo catálogo. */
export function obtenerProductos(): Producto[] {
  if (cache) return cache;
  const yanbal = (yanbalData.productos as ProductoCrudo[])
    .map((p) => aProducto(p, "yanbal"))
    .filter((p): p is Producto => p !== null);
  const natura = (naturaData.productos as ProductoCrudo[])
    .map((p) => aProducto(p, "natura"))
    .filter((p): p is Producto => p !== null);
  cache = [...yanbal, ...natura];
  return cache;
}

export function obtenerProductoPorId(origen: Origen, codigo: string): Producto | undefined {
  return obtenerProductos().find((p) => p.origen === origen && p.codigo === codigo);
}

const sinTildes = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/** Coincide por nombre, código o descripción — así funciona buscar "4719" o "kaiak". */
export function buscarProductos(productos: Producto[], termino: string): Producto[] {
  const q = sinTildes(termino.trim());
  if (!q) return productos;
  return productos.filter(
    (p) =>
      p.codigo.includes(q) ||
      sinTildes(p.nombre).includes(q) ||
      (p.linea && sinTildes(p.linea).includes(q)) ||
      (p.descripcion && sinTildes(p.descripcion).includes(q)),
  );
}

export interface Categoria {
  nombre: string;
  cantidad: number;
}

export function obtenerCategorias(productos: Producto[] = obtenerProductos()): Categoria[] {
  const cuenta = new Map<string, number>();
  for (const p of productos) {
    if (!p.categoria) continue;
    cuenta.set(p.categoria, (cuenta.get(p.categoria) ?? 0) + 1);
  }
  return [...cuenta.entries()]
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

export interface ContadorMarca {
  origen: Origen;
  marca: string;
  cantidad: number;
}

export function obtenerMarcas(productos: Producto[] = obtenerProductos()): ContadorMarca[] {
  return (Object.keys(MARCAS) as Origen[]).map((origen) => ({
    origen,
    marca: MARCAS[origen],
    cantidad: productos.filter((p) => p.origen === origen).length,
  }));
}

export type Orden = "relevancia" | "precio-asc" | "precio-desc" | "nuevos";

export interface FiltrosProductos {
  q?: string;
  origen?: Origen;
  categoria?: string;
  soloDisponibles?: boolean;
  orden?: Orden;
}

export function filtrarProductos(filtros: FiltrosProductos): Producto[] {
  let resultado = obtenerProductos();

  if (filtros.q) resultado = buscarProductos(resultado, filtros.q);
  if (filtros.origen) resultado = resultado.filter((p) => p.origen === filtros.origen);
  if (filtros.categoria) resultado = resultado.filter((p) => p.categoria === filtros.categoria);
  // disponible === null (la marca no publica el dato) se muestra igual: no es
  // lo mismo que "agotado", y ocultarlo escondería 101 productos de Yanbal sin razón.
  if (filtros.soloDisponibles) resultado = resultado.filter((p) => p.disponible !== false);

  switch (filtros.orden) {
    case "precio-asc":
      resultado = [...resultado].sort((a, b) => a.precio - b.precio);
      break;
    case "precio-desc":
      resultado = [...resultado].sort((a, b) => b.precio - a.precio);
      break;
    case "nuevos":
      resultado = [...resultado].sort((a, b) => (a.pagina ?? 999) - (b.pagina ?? 999));
      break;
    default:
      // "relevancia": mejor calificados y con foto de línea completa primero.
      resultado = [...resultado].sort((a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0));
  }

  return resultado;
}

/**
 * Los destacados de la landing: primero los elegidos a mano, luego un cupo
 * por cada marca+categoría (mejor calificado de cada una primero) para no
 * repetir la misma línea de producto seis veces — p. ej. sin esto, media
 * vitrina termina siendo Lumina de Natura porque es la línea mejor calificada.
 */
export function obtenerDestacados(cantidad = 6): Producto[] {
  const todos = obtenerProductos();
  const porId = new Map(todos.map((p) => [p.id, p]));

  const elegidos = idsDestacados.map((id) => porId.get(id)).filter((p): p is Producto => !!p);

  const grupos = new Map<string, Producto[]>();
  for (const p of todos) {
    if (idsDestacados.includes(p.id) || p.disponible === false) continue;
    const clave = `${p.origen}-${p.categoria ?? "sin-categoria"}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(p);
    else grupos.set(clave, [p]);
  }
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => (b.calificacion ?? 0) - (a.calificacion ?? 0));
  }
  const colas = [...grupos.values()].sort(
    (a, b) => (b[0].calificacion ?? 0) - (a[0].calificacion ?? 0),
  );

  const relleno: Producto[] = [];
  let quedan = true;
  while (quedan && relleno.length < cantidad) {
    quedan = false;
    for (const cola of colas) {
      const siguiente = cola.shift();
      if (siguiente) {
        relleno.push(siguiente);
        quedan = true;
      }
    }
  }

  return [...elegidos, ...relleno].slice(0, cantidad);
}

/** Productos afines para "También de {marca}" en la ficha. */
export function obtenerRelacionados(producto: Producto, cantidad = 3): Producto[] {
  return obtenerProductos()
    .filter(
      (p) =>
        p.id !== producto.id &&
        p.origen === producto.origen &&
        p.categoria === producto.categoria,
    )
    .slice(0, cantidad);
}
