export default function PaginaPolitica({
  titulo,
  nota,
}: {
  titulo: string;
  nota: string;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <h1 className="font-display text-4xl">{titulo}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-secondary/60 p-6 text-sm text-secondary">
        [{nota}]
      </div>
    </div>
  );
}
