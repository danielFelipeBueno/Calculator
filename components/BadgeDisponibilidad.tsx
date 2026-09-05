/**
 * `disponible === null` significa que la marca no publica el dato — es el
 * caso de 101 productos de Yanbal y 14 de Natura. No es lo mismo que
 * "agotado", así que no se muestra chip: inventar un estado sería peor que
 * no decir nada.
 */
export default function BadgeDisponibilidad({ disponible }: { disponible: boolean | null }) {
  if (disponible === null) return null;

  if (disponible) {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-available px-2.5 py-1 text-xs font-semibold text-available-ink">
        Disponible
      </span>
    );
  }

  return (
    <span className="inline-block whitespace-nowrap rounded-full bg-unavailable px-2.5 py-1 text-xs font-semibold text-unavailable-ink">
      Agotado
    </span>
  );
}
