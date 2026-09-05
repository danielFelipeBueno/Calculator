import Image from "next/image";
import Link from "next/link";
import type { Producto } from "@/lib/productos";
import { formatoPesos } from "@/lib/formato";
import { notasConsultora } from "@/lib/notas";

/** La tarjeta grande de "Lo que más me piden esta campaña", con la nota personal si existe. */
export default function ProductCardDestacado({ producto }: { producto: Producto }) {
  const nota = notasConsultora[producto.id];

  return (
    <Link
      href={`/producto/${producto.origen}/${producto.codigo}/${producto.slug}`}
      className="flex flex-col gap-3.5 rounded-2xl bg-surface p-5 hover:text-ink"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl p-5">
        <Image
          src={producto.imagen}
          alt={producto.nombre}
          fill
          sizes="(min-width: 1024px) 360px, (min-width: 640px) 33vw, 90vw"
          className="object-contain p-5"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-base font-semibold leading-snug">{producto.nombre}</div>
        <div className="text-xs text-secondary">
          {producto.marca}
          {producto.categoria ? ` · ${producto.categoria}` : ""}
          {producto.calificacion ? ` · ★ ${producto.calificacion.toFixed(1)}` : ""}
        </div>
      </div>
      {nota && (
        <p className="border-l-2 border-line pl-3 text-sm italic text-secondary">“{nota}”</p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-lg font-bold tabular-nums">{formatoPesos(producto.precio)}</span>
        <span className="whitespace-nowrap rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-ground">
          Lo quiero
        </span>
      </div>
    </Link>
  );
}
