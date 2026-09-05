import Image from "next/image";
import Link from "next/link";
import { obtenerCategorias, obtenerDestacados, obtenerMarcas, obtenerProductos } from "@/lib/productos";
import { negocio } from "@/lib/negocio";
import { linkWhatsAppGeneral } from "@/lib/whatsapp";
import BuscadorForm from "@/components/BuscadorForm";
import ProductCardDestacado from "@/components/ProductCardDestacado";

export default function Home() {
  const productos = obtenerProductos();
  const marcas = obtenerMarcas(productos);
  const categorias = obtenerCategorias(productos).slice(0, 8);
  const destacados = obtenerDestacados(6);

  return (
    <>
      {/* Hero: la persona */}
      <section className="grid gap-10 px-5 pb-12 pt-4 sm:px-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-center lg:gap-14 lg:pb-16">
        <div className="mx-auto flex aspect-[4/5] w-full max-w-sm items-center justify-center rounded-3xl bg-line p-6 text-center text-sm text-secondary lg:mx-0 lg:max-w-none">
          {negocio.fotoUrl ? (
            <Image src={negocio.fotoUrl} alt={negocio.nombreConsultora} width={420} height={525} className="h-full w-full rounded-3xl object-cover" />
          ) : (
            <span>[TU FOTO]<br />de cuerpo entero, luz natural, con producto en la mano</span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Consultora Yanbal y Natura · {negocio.ciudad}
          </p>
          <h1 className="text-balance font-display text-4xl leading-tight sm:text-5xl lg:text-[56px]">
            Hola, soy {negocio.nombreConsultora}. Todo lo que ves aquí lo elijo, lo empaco y lo
            envío yo.
          </h1>
          <p className="max-w-xl text-lg text-secondary">
            Llevo {negocio.anios} años vendiendo Yanbal y Natura. Si no sabes qué perfume regalar
            o qué crema le sirve a tu piel, escríbeme: te asesoro antes de que compres, no
            después.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={linkWhatsAppGeneral()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-full bg-accent px-6 py-3.5 font-semibold text-ground hover:text-ground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
              </svg>
              Escríbeme por WhatsApp
            </a>
            <Link href="/catalogo" className="rounded-full border-[1.5px] border-ink px-6 py-3.5 font-semibold text-ink hover:text-ink">
              Ver el catálogo
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              "Producto original garantizado",
              `Contra entrega en ${negocio.ciudadesContraentrega.join(", ")}`,
              `Llega en ${negocio.diasEntregaTexto}`,
              `Código de consultora ${negocio.codigoConsultora}`,
            ].map((texto) => (
              <span key={texto} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium">
                {texto}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Buscador */}
      <section className="px-5 sm:px-8">
        <BuscadorForm />
      </section>

      {/* Dos marcas */}
      <section className="grid gap-4 px-5 pt-8 sm:px-8 md:grid-cols-2">
        {marcas.map((m) => {
          const campana = negocio.campanas[m.origen];
          return (
            <Link
              key={m.origen}
              href={`/catalogo?origen=${m.origen}`}
              className="flex items-center justify-between gap-4 rounded-2xl bg-surface p-6 hover:text-ink"
            >
              <div className="flex flex-col gap-1">
                <span className="font-display text-2xl">{m.marca}</span>
                <span className="text-sm text-secondary">{m.cantidad} productos</span>
              </div>
              <span className="whitespace-nowrap rounded-full bg-line px-3.5 py-2 text-sm font-semibold">
                {campana.nombre} · {campana.vigenciaTexto}
              </span>
            </Link>
          );
        })}
      </section>

      {/* Categorías */}
      <section className="flex flex-wrap gap-2.5 px-5 pt-6 sm:px-8">
        {categorias.map((c) => (
          <Link
            key={c.nombre}
            href={`/catalogo?categoria=${encodeURIComponent(c.nombre)}`}
            className="rounded-full border-[1.5px] border-ink px-4 py-2.5 text-sm font-semibold text-ink hover:text-ink"
          >
            {c.nombre} · {c.cantidad}
          </Link>
        ))}
      </section>

      {/* Destacados */}
      {destacados.length > 0 && (
        <section className="flex flex-col gap-7 px-5 pb-4 pt-16 sm:px-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-3xl sm:text-[36px]">
              Lo que más me piden esta campaña
            </h2>
            <p className="text-secondary">
              {destacados.length} de los {productos.length} productos del catálogo.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {destacados.map((p) => (
              <ProductCardDestacado key={p.id} producto={p} />
            ))}
          </div>
          <Link
            href="/catalogo"
            className="mx-auto rounded-full border-[1.5px] border-ink px-7 py-3.5 font-semibold text-ink hover:text-ink"
          >
            Ver los {productos.length} productos
          </Link>
        </section>
      )}

      {/* Cómo funciona */}
      <section id="como-comprar" className="mx-5 my-16 grid scroll-mt-24 gap-8 rounded-3xl bg-surface p-8 sm:mx-8 sm:p-10 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl">Eliges</h3>
          <p className="text-sm text-secondary">
            Aquí o en la revista. Si tienes dudas, me escribes y te ayudo a escoger.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl">Confirmamos por WhatsApp</h3>
          <p className="text-sm text-secondary">
            Te confirmo disponibilidad, total y fecha de entrega antes de que pagues nada.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-xl">Recibes y pagas</h3>
          <p className="text-sm text-secondary">
            Contra entrega en {negocio.ciudadesContraentrega.join(", ")}; Nequi o transferencia
            para el resto del país.
          </p>
        </div>
      </section>

      {/* Reseñas: espacio a llenar, sin inventar contenido */}
      <section className="flex flex-col gap-5 px-5 pb-16 sm:px-8">
        <h2 className="font-display text-[26px]">Lo que dicen quienes ya compraron</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-dashed border-secondary p-5 text-sm text-secondary">
              <span className="font-semibold">[Reseña con foto del pedido]</span>
              <span>
                {i === 1 && "Se activa con las primeras compras. Cada reseña con foto suma estrellas."}
                {i === 2 && "Nombre, ciudad y qué compró."}
                {i === 3 && "Ningún competidor tiene una. Esta sección es la ventaja."}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
