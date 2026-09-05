import { negocio } from "@/lib/negocio";
import { formatoPesos } from "@/lib/formato";
import type { Producto } from "@/lib/productos";

/**
 * El chat se abre con el producto y el código ya escritos: quien pregunta no
 * tiene que explicar qué está mirando, y la consultora no pierde el contexto
 * de qué trajo a la clienta (ver el documento de elementos — es la regla que
 * separa "WhatsApp como parche" de "WhatsApp como canal principal").
 */
export function linkWhatsApp(mensaje: string): string {
  return `https://wa.me/${negocio.whatsappNumero}?text=${encodeURIComponent(mensaje)}`;
}

export function linkWhatsAppGeneral(): string {
  return linkWhatsApp("Hola! Vi tu catálogo de Alejandría y tengo una pregunta.");
}

/** Botón "Lo quiero" — intención de compra directa. */
export function linkWhatsAppProducto(producto: Producto): string {
  const precio = formatoPesos(producto.precio);
  return linkWhatsApp(
    `Hola! Quiero este producto de Alejandría:\n\n${producto.nombre}\n` +
      `Código ${producto.codigo} · ${producto.marca}\n` +
      `Precio: ${precio}\n\n¿Está disponible?`,
  );
}

/** Botón "Preguntar" — todavía decidiendo, sin comprometerse a comprar. */
export function linkWhatsAppPregunta(producto: Producto): string {
  return linkWhatsApp(
    `Hola! Tengo una pregunta sobre este producto de Alejandría:\n\n${producto.nombre}\n` +
      `Código ${producto.codigo} · ${producto.marca}`,
  );
}
