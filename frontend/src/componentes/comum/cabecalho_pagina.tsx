export function CabecalhoPagina({
  titulo,
  descricao,
}: {
  titulo: string
  descricao: string
}) {
  return (
    <section className="space-y-2">
      <h1 className="text-4xl font-semibold tracking-tight text-on-surface">{titulo}</h1>
      <p className="text-lg text-on-surface-variant">{descricao}</p>
    </section>
  )
}
