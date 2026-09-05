import Image from "next/image";
import Link from "next/link";
import type { Producto } from "@/lib/productos";
import { formatoPesos } from "@/lib/formato";
import BadgeDisponibilidad from "@/components/BadgeDisponibilidad";

export default function ProductCard({ producto }: { producto: Producto }) {
  return (
    <Link
      href={`/producto/${producto.origen}/${producto.codigo}/${producto.slug}`}
      className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 hover:text-ink"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-ground p-3.5">
        <Image
          src={producto.imagen}
          alt={producto.nombre}
          fill
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
          className="object-contain p-3.5"
        />
      </div>
      <div className="text-xs text-secondary">
        {producto.marca}
        {producto.categoria ? ` · ${producto.categoria}` : ""}
        {producto.calificacion ? ` · ★ ${producto.calificacion.toFixed(1)}` : ""}
      </div>
      <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
        {producto.nombre}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[17px] font-bold tabular-nums">{formatoPesos(producto.precio)}</span>
        <BadgeDisponibilidad disponible={producto.disponible} />
      </div>
    </Link>
  );
}
