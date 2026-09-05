import type { Metadata } from "next";
import PaginaPolitica from "@/components/PaginaPolitica";

export const metadata: Metadata = { title: "Envíos" };

export default function Page() {
  return (
    <PaginaPolitica
      titulo="Envíos"
      nota="CONTENIDO PENDIENTE — describe aquí costo de envío, umbral de envío gratis, ciudades con contraentrega y tiempos de entrega reales. lib/negocio.ts ya tiene los campos listos para esto."
    />
  );
}
