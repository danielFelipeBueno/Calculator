import type { NextConfig } from "next";

// Las fotos de producto vienen directo del CDN de cada marca — el pipeline en
// scripts/ y data/ nunca las descarga ni las copia. Si se suma otra marca con
// enriquecimiento de fotos, su dominio de imágenes entra aquí.
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.yanbal.com", pathname: "/medias/**" },
      { protocol: "https", hostname: "production.na01.natura.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
