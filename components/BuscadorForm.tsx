function IconoBuscar() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 text-secondary"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** Un <form> normal con method="get": funciona sin JavaScript. */
export default function BuscadorForm({
  valorInicial,
  placeholder = "Nombre o código de la revista — “4719”, “Kaiak”, “esmalte”",
}: {
  valorInicial?: string;
  placeholder?: string;
}) {
  return (
    <form
      action="/catalogo"
      method="GET"
      className="flex items-center gap-3.5 rounded-2xl bg-surface p-3 pl-5 sm:p-3.5 sm:pl-6"
    >
      <IconoBuscar />
      <input
        type="text"
        name="q"
        defaultValue={valorInicial}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-secondary focus:outline-none sm:text-base"
      />
      <button
        type="submit"
        className="whitespace-nowrap rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-ground hover:text-ground sm:px-5"
      >
        Buscar
      </button>
    </form>
  );
}
