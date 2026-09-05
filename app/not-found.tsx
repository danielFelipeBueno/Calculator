import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-24 text-center">
      <h1 className="font-display text-4xl">No encontramos esta página</h1>
      <p className="max-w-md text-secondary">
        El producto pudo agotarse de una campaña anterior o el enlace está mal escrito.
      </p>
      <Link href="/catalogo" className="rounded-full bg-ink px-6 py-3 font-semibold text-ground hover:text-ground">
        Ver el catálogo
      </Link>
    </div>
  );
}
