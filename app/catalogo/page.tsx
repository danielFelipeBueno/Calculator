import type { Metadata } from "next";
import Link from "next/link";
import {
  filtrarProductos,
  MARCAS,
  obtenerCategorias,
  obtenerMarcas,
  obtenerProductos,
  type Orden,
  type Origen,
} from "@/lib/productos";
import BuscadorForm from "@/components/BuscadorForm";
import ProductCard from "@/components/ProductCard";

export const metadata: Metadata = { title: "Catálogo" };

const POR_PAGINA = 24;

const ORDENES: { valor: Orden; etiqueta: string }[] = [
  { valor: "relevancia", etiqueta: "relevancia" },
  { valor: "precio-asc", etiqueta: "precio: menor a mayor" },
  { valor: "precio-desc", etiqueta: "precio: mayor a menor" },
  { valor: "nuevos", etiqueta: "orden de la revista" },
];

interface BandaPrecio {
  id: string;
  etiqueta: string;
  min: number;
  max: number | null;
}

const BANDAS_PRECIO: BandaPrecio[] = [
  { id: "0-50000", etiqueta: "Hasta $ 50.000", min: 0, max: 50000 },
  { id: "50000-150000", etiqueta: "$ 50.000 – $ 150.000", min: 50000, max: 150000 },
  { id: "150000-", etiqueta: "Más de $ 150.000", min: 150000, max: null },
];

type ParametrosBusqueda = Record<string, string | undefined>;

/** Arma la URL del catálogo con los filtros actuales más los cambios dados. */
function construirHref(actuales: ParametrosBusqueda, cambios: Record<string, string | null>) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(actuales)) {
    if (valor) params.set(clave, valor);
  }
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor === null) params.delete(clave);
    else params.set(clave, valor);
  }
  // Cambiar un filtro siempre vuelve a la página 1 — nunca queda "página 4 de 0 resultados".
  if (!("page" in cambios)) params.delete("page");
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

function Chip({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium hover:text-ink " +
        (activo ? "bg-ink text-ground hover:text-ground" : "border border-line text-ink")
      }
    >
      {children}
    </Link>
  );
}

function tituloDe(sp: ParametrosBusqueda): string {
  if (sp.q) return `Resultados para “${sp.q}”`;
  if (sp.categoria) return sp.categoria;
  if (sp.origen && sp.origen in MARCAS) return MARCAS[sp.origen as Origen];
  return "Todo el catálogo";
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<ParametrosBusqueda>;
}) {
  const sp = await searchParams;
  const todos = obtenerProductos();
  const marcas = obtenerMarcas(todos);
  const categorias = obtenerCategorias(todos);

  const origen = sp.origen === "yanbal" || sp.origen === "natura" ? sp.origen : undefined;
  const orden = ORDENES.some((o) => o.valor === sp.orden) ? (sp.orden as Orden) : "relevancia";
  const soloDisponibles = sp.disponible === "1";
  const banda = BANDAS_PRECIO.find((b) => b.id === sp.precio);

  let resultados = filtrarProductos({
    q: sp.q,
    origen,
    categoria: sp.categoria,
    soloDisponibles,
    orden,
  });
  if (banda) {
    resultados = resultados.filter(
      (p) => p.precio >= banda.min && (banda.max === null || p.precio < banda.max),
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(resultados.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(sp.page) || 1), totalPaginas);
  const productosPagina = resultados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  return (
    <div className="px-5 sm:px-8">
      <BuscadorForm valorInicial={sp.q} />

      <div className="grid gap-8 pb-16 pt-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Filtros */}
        <aside className="flex flex-col gap-6 text-sm">
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Marca</h3>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-start">
              {marcas.map((m) => (
                <Chip
                  key={m.origen}
                  href={construirHref(sp, { origen: origen === m.origen ? null : m.origen })}
                  activo={origen === m.origen}
                >
                  {m.marca} · {m.cantidad}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Categoría</h3>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-start">
              {categorias.map((c) => (
                <Chip
                  key={c.nombre}
                  href={construirHref(sp, { categoria: sp.categoria === c.nombre ? null : c.nombre })}
                  activo={sp.categoria === c.nombre}
                >
                  {c.nombre} · {c.cantidad}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Precio</h3>
            <div className="flex flex-wrap gap-2 lg:flex-col lg:items-start">
              {BANDAS_PRECIO.map((b) => (
                <Chip
                  key={b.id}
                  href={construirHref(sp, { precio: sp.precio === b.id ? null : b.id })}
                  activo={sp.precio === b.id}
                >
                  {b.etiqueta}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
              Disponibilidad
            </h3>
            <Chip href={construirHref(sp, { disponible: soloDisponibles ? null : "1" })} activo={soloDisponibles}>
              Solo disponibles
            </Chip>
          </div>
        </aside>

        {/* Resultados */}
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-3xl">{tituloDe(sp)}</h1>
              <p className="text-sm text-secondary">
                {resultados.length} producto{resultados.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm text-secondary">
              <span>Ordenar:</span>
              {ORDENES.map((o, i) => (
                <span key={o.valor}>
                  <Link
                    href={construirHref(sp, { orden: o.valor === "relevancia" ? null : o.valor })}
                    className={orden === o.valor ? "font-semibold text-ink hover:text-ink" : "hover:text-ink"}
                  >
                    {o.etiqueta}
                  </Link>
                  {i < ORDENES.length - 1 && " · "}
                </span>
              ))}
            </div>
          </div>

          {productosPagina.length === 0 ? (
            <div className="rounded-2xl bg-surface p-10 text-center text-secondary">
              No hay productos con estos filtros.{" "}
              <Link href="/catalogo" className="font-semibold text-ink hover:text-ink">
                Quitar filtros
              </Link>
              .
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {productosPagina.map((p) => (
                <ProductCard key={p.id} producto={p} />
              ))}
            </div>
          )}

          {totalPaginas > 1 && (
            <nav className="flex flex-wrap justify-center gap-2 pt-4 text-sm font-semibold">
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(
                  (n) => n === 1 || n === totalPaginas || Math.abs(n - pagina) <= 1,
                )
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center gap-2">
                    {i > 0 && arr[i - 1] !== n - 1 && <span className="text-secondary">…</span>}
                    <Link
                      href={construirHref(sp, { page: String(n) })}
                      className={
                        "flex h-10 min-w-10 items-center justify-center rounded-full px-3 hover:text-ink " +
                        (n === pagina ? "bg-ink text-ground hover:text-ground" : "border border-line text-ink")
                      }
                    >
                      {n}
                    </Link>
                  </span>
                ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
