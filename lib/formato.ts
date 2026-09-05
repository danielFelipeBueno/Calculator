/** "$ 251.900" — el formato de precio de las cuatro pantallas de diseño. */
export function formatoPesos(valor: number): string {
  return `$ ${Math.round(valor).toLocaleString("es-CO")}`;
}
