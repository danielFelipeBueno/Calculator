import type { Metadata } from "next";
import PaginaPolitica from "@/components/PaginaPolitica";

export const metadata: Metadata = { title: "Privacidad" };

export default function Page() {
  return (
    <PaginaPolitica
      titulo="Privacidad"
      nota="CONTENIDO PENDIENTE — describe aquí qué datos se piden por WhatsApp (nombre, dirección, teléfono) y qué se hace con ellos. Es un requisito legal en Colombia, no un detalle opcional."
    />
  );
}
