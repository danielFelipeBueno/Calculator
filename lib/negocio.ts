import { formatoPesos } from "@/lib/formato";

/**
 * Los datos del negocio en un solo lugar. Todo lo marcado con [CORCHETES] es
 * lo que faltaba llenar en el diseño (ver diseno/README.md) — reemplázalo
 * antes de publicar. El resto (campañas, cifras del catálogo) sale del
 * pipeline y se actualiza solo cuando se corre `npm run clasificar:*`.
 */
export const negocio = {
  nombreConsultora: "[TU NOMBRE]",
  ciudad: "[TU CIUDAD]",
  anios: "[N]",
  codigoConsultora: "[TU CÓDIGO]",
  fotoUrl: null as string | null,

  /** Sin '+' ni espacios: indicativo de país + número. Ej: 573001234567. */
  whatsappNumero: "[57XXXXXXXXXX]",

  ciudadesContraentrega: ["[TU CIUDAD]"],
  /** En pesos colombianos. Deja null mientras no estén definidos. */
  envioCosto: null as number | null,
  envioGratisDesde: null as number | null,
  diasEntregaTexto: "3 a 5 días hábiles",
  diasDevolucion: 5,

  campanas: {
    yanbal: { nombre: "C09", vigenciaTexto: "hasta el 11 de septiembre" },
    natura: { nombre: "ciclo 13", vigenciaTexto: "vigente" },
  },
} as const;

/** El chip de envío de la ficha de producto — honesto sobre lo que falta definir. */
export function textoEnvio(): string {
  if (negocio.envioCosto == null) return "Envío — define el costo en lib/negocio.ts";
  const base = `Envío ${formatoPesos(negocio.envioCosto)}`;
  return negocio.envioGratisDesde != null
    ? `${base} · gratis desde ${formatoPesos(negocio.envioGratisDesde)}`
    : base;
}
