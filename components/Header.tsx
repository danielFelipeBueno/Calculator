"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { linkWhatsAppGeneral } from "@/lib/whatsapp";

const NAV = [
  { href: "/catalogo", etiqueta: "Catálogo" },
  { href: "/catalogo?origen=yanbal", etiqueta: "Yanbal" },
  { href: "/catalogo?origen=natura", etiqueta: "Natura" },
  { href: "/#como-comprar", etiqueta: "Cómo comprar" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8 sm:py-5">
      <Link href="/" className="font-display text-2xl text-ink hover:text-ink sm:text-3xl">
        Alejandría
      </Link>

      <nav className="hidden items-center gap-7 text-sm font-medium text-secondary md:flex">
        {NAV.map((item) => {
          // Solo "Catálogo" se resalta por ruta — Yanbal y Natura comparten la
          // misma ruta con distinto filtro, así que no hay forma honesta de
          // marcarlos activos sin leer los parámetros de búsqueda.
          const activo = item.href === "/catalogo" && pathname === "/catalogo";
          return (
            <Link
              key={item.href}
              href={item.href}
              className={activo ? "font-semibold text-ink hover:text-ink" : "hover:text-ink"}
            >
              {item.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <Link
          href="/catalogo"
          aria-label="Buscar en el catálogo"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink hover:text-ink md:hidden"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
        <a
          href={linkWhatsAppGeneral()}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-full bg-ink px-3 py-2.5 text-sm font-semibold text-ground hover:text-ground sm:px-5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 0 1-13.5 7.8L3 21l1.2-4.5A9 9 0 1 1 21 12z" />
          </svg>
          <span className="hidden sm:inline">Hablemos</span>
        </a>
      </div>
    </header>
  );
}
