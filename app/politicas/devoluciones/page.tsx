import type { Metadata } from "next";
import PaginaPolitica from "@/components/PaginaPolitica";

export const metadata: Metadata = { title: "Devoluciones" };

export default function Page() {
  return (
    <PaginaPolitica
      titulo="Devoluciones"
      nota="CONTENIDO PENDIENTE — describe aquí en cuántos días se recibe una devolución, en qué estado debe estar el producto y cómo se hace el cambio o el reembolso."
    />
  );
}
