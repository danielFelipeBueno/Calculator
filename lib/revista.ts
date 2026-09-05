import type { Origen } from "@/lib/productos";

/**
 * URL de la página exacta del flipbook, cuando se conoce el patrón. Verificado
 * para Yanbal (`?page=N` en docs.yanbal.com); para Natura el visor no tiene un
 * parámetro de página confirmado, así que se omite el enlace en vez de
 * arriesgar uno roto — mejor no mostrar el chip que mostrar uno que no sirve.
 */
const BASES_REVISTA: Partial<Record<Origen, string>> = {
  yanbal: "https://docs.yanbal.com/cdigital/co/2026/c9/oficial/",
};

export function linkRevista(origen: Origen, pagina: number | null): string | null {
  if (!pagina) return null;
  const base = BASES_REVISTA[origen];
  return base ? `${base}?page=${pagina}` : null;
}
