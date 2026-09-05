import Link from "next/link";

export default function Footer() {
  return (
    <footer className="flex flex-col gap-2 px-5 py-8 text-xs text-secondary sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <span>
        Alejandría · tienda independiente. Yanbal y Natura son marcas de sus respectivos
        titulares.
      </span>
      <nav className="flex gap-4">
        <Link href="/politicas/envios" className="hover:text-ink">
          Envíos
        </Link>
        <Link href="/politicas/devoluciones" className="hover:text-ink">
          Devoluciones
        </Link>
        <Link href="/politicas/privacidad" className="hover:text-ink">
          Privacidad
        </Link>
      </nav>
    </footer>
  );
}
