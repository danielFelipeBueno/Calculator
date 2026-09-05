import type { MetadataRoute } from "next";
import { obtenerProductos } from "@/lib/productos";

/**
 * La URL del producto es permanente y no lleva el ciclo — sobrevive al cambio
 * de campaña (ver README.md, sección de arquitectura). Por eso tiene sentido
 * generar el sitemap completo: son URLs que valen la pena que Google indexe
 * y conserve.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Reemplaza esto por el dominio real antes de publicar.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://alejandria.example.com";

  const paginas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "daily", priority: 0.9 },
  ];

  const productos: MetadataRoute.Sitemap = obtenerProductos().map((p) => ({
    url: `${base}/producto/${p.origen}/${p.codigo}/${p.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...paginas, ...productos];
}
