import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  obtenerProductoPorId,
  obtenerProductos,
  obtenerRelacionados,
  type Origen,
} from "@/lib/productos";
import { formatoPesos } from "@/lib/formato";
import { negocio, textoEnvio } from "@/lib/negocio";
import { linkWhatsAppPregunta, linkWhatsAppProducto } from "@/lib/whatsapp";
import { linkRevista } from "@/lib/revista";
import { notasConsultora } from "@/lib/notas";
import BadgeDisponibilidad from "@/components/BadgeDisponibilidad";
import ProductCard from "@/components/ProductCard";

interface Params {
  origen: string;
  codigo: string;
  slug: string;
}

function esOrigen(valor: string): valor is Origen {
  return valor === "yanbal" || valor === "natura";
}

export async function generateStaticParams() {
  return obtenerProductos().map((p) => ({
    origen: p.origen,
    codigo: p.codigo,
    slug: p.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { origen, codigo } = await params;
  if (!esOrigen(origen)) return {};
  const producto = obtenerProductoPorId(origen, codigo);
  if (!producto) return {};
  return {
    title: producto.nombre,
    description:
      producto.descripcion?.slice(0, 155) ??
      `${producto.nombre} · ${producto.marca} · ${formatoPesos(producto.precio)}`,
  };
}

export default async function ProductoPage({ params }: { params: Promise<Params> }) {
  const { origen, codigo } = await params;
  if (!esOrigen(origen)) notFound();

  const producto = obtenerProductoPorId(origen, codigo);
  if (!producto) notFound();

  const relacionados = obtenerRelacionados(producto);
  const nota = notasConsultora[producto.id];
  const urlPagina = linkRevista(producto.origen, producto.pagina);
  const imagenes = [producto.imagen, ...producto.imagenesAdicionales];

  return (
    <div className="px-5 pb-16 sm:px-8">
      <nav className="flex flex-wrap gap-1.5 py-4 text-sm text-secondary">
        <Link href="/catalogo" className="hover:text-ink">
          Catálogo
        </Link>
        <span>›</span>
        <Link href={`/catalogo?origen=${producto.origen}`} className="hover:text-ink">
          {producto.marca}
        </Link>
        {producto.categoria && (
          <>
            <span>›</span>
            <Link href={`/catalogo?categoria=${encodeURIComponent(producto.categoria)}`} className="hover:text-ink">
              {producto.categoria}
            </Link>
          </>
        )}
        <span>›</span>
        <span className="text-ink">{producto.nombre}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[480px_minmax(0,1fr)] lg:items-start">
        {/* Galería */}
        <div className="flex flex-col gap-3">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-surface p-8">
            <Image
              src={imagenes[0]}
              alt={producto.nombre}
              fill
              priority
              sizes="(min-width: 1024px) 480px, 100vw"
              className="object-contain p-8"
            />
          </div>
          {imagenes.length > 1 && (
            <div className="flex gap-3">
              {imagenes.map((src, i) => (
                <div
                  key={src + i}
                  className={
                    "relative h-24 w-24 overflow-hidden rounded-2xl bg-surface p-2.5 " +
                    (i === 0 ? "border-2 border-ink" : "")
                  }
                >
                  <Image src={src} alt="" fill sizes="96px" className="object-contain p-2.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Información y decisión */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-line px-3 py-1.5 text-xs font-semibold">
              {producto.marca}
              {producto.linea ? ` · ${producto.linea}` : ""}
            </span>
            {producto.categoria && <span className="text-sm text-secondary">{producto.categoria}</span>}
          </div>

          <h1 className="text-balance font-display text-3xl leading-tight sm:text-4xl">
            {producto.nombre}
          </h1>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
            <span>
              Código <span className="font-semibold text-ink">{producto.codigo}</span>
            </span>
            {producto.calificacion && (
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-ink">
                  <path d="m12 2 3 6.6 7 .9-5.2 4.8L18.2 22 12 18.4 5.8 22l1.4-7.7L2 9.5l7-.9z" />
                </svg>
                <span className="font-semibold text-ink">{producto.calificacion.toFixed(1)}</span>
                {producto.urlMarca && <span>en el sitio de {producto.marca.toLowerCase()}</span>}
              </span>
            )}
            {producto.puntos && <span>{producto.puntos} pts</span>}
          </div>

          <div className="flex items-baseline gap-3 pt-1">
            <span className="text-4xl font-bold tabular-nums">{formatoPesos(producto.precio)}</span>
            {producto.precioLista && (
              <span className="text-base text-secondary line-through tabular-nums">
                {formatoPesos(producto.precioLista)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <BadgeDisponibilidad disponible={producto.disponible} />
            <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
              {textoEnvio()}
            </span>
            <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
              Llega en {negocio.diasEntregaTexto}
            </span>
            <span className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
              Contra entrega en {negocio.ciudadesContraentrega.join(", ")}
            </span>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <a
              href={linkWhatsAppProducto(producto)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center rounded-full bg-ink px-6 py-4 font-semibold text-ground hover:text-ground"
            >
              Lo quiero
            </a>
            <a
              href={linkWhatsAppPregunta(producto)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-accent px-6 py-4 font-semibold text-ground hover:text-ground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
              </svg>
              Preguntar por WhatsApp
            </a>
          </div>
          <p className="text-center text-xs text-secondary">
            Original garantizado · Devolución en {negocio.diasDevolucion} días · El chat se abre
            con el producto y el código ya escritos
          </p>

          {nota && (
            <div className="mt-2 flex gap-3.5 rounded-2xl bg-surface p-4.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-line text-[9px] text-secondary">
                {negocio.fotoUrl ? (
                  <Image src={negocio.fotoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  "FOTO"
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm italic">“{nota}”</p>
                <p className="text-xs text-secondary">{negocio.nombreConsultora}, consultora</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detalles y descripción */}
      <div className="grid gap-8 pt-10 lg:grid-cols-[480px_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-3.5 rounded-2xl bg-surface p-6">
          <h2 className="font-display text-xl">Detalles</h2>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-secondary">Marca</dt>
            <dd className="font-medium">{producto.marca}</dd>
            {producto.linea && (
              <>
                <dt className="text-secondary">Línea</dt>
                <dd className="font-medium">{producto.linea}</dd>
              </>
            )}
            {producto.categoria && (
              <>
                <dt className="text-secondary">Categoría</dt>
                <dd className="font-medium">{producto.categoria}</dd>
              </>
            )}
            <dt className="text-secondary">Código</dt>
            <dd className="font-medium">{producto.codigo}</dd>
          </dl>
        </div>

        <div className="flex flex-col gap-3.5">
          <h2 className="font-display text-xl">Sobre este producto</h2>
          {producto.descripcion ? (
            <p className="whitespace-pre-line text-[15px] leading-relaxed">{producto.descripcion}</p>
          ) : (
            <p className="text-sm text-secondary">
              [Sin descripción del fabricante — agrega aquí tu propio texto sobre este producto.]
            </p>
          )}
          {producto.pagina && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-4.5 py-3.5 text-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-secondary">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>
                Lo viste en la revista: <span className="font-semibold">página {producto.pagina}</span>
              </span>
              {urlPagina && (
                <a
                  href={urlPagina}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto font-semibold text-accent hover:text-accent-dark"
                >
                  Abrir la revista →
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reseñas: sin fabricar contenido */}
      <div className="flex flex-col gap-3 pt-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="font-display text-xl">Reseñas</h2>
          <span className="text-sm text-secondary">
            Se activan con las primeras compras. Cada reseña con foto suma estrellas.
          </span>
        </div>
        <div className="rounded-2xl border-[1.5px] border-dashed border-secondary p-5 text-sm text-secondary">
          [Primera reseña con foto del pedido] — nombre, ciudad, estrellas y foto del producto
          recibido.
        </div>
      </div>

      {relacionados.length > 0 && (
        <div className="flex flex-col gap-5 pt-12">
          <h2 className="font-display text-2xl">También de {producto.marca}</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {relacionados.map((p) => (
              <ProductCard key={p.id} producto={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
