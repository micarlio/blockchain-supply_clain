type ExemploConsulta = {
  rotulo: string
  valor: string
}

export function TraceabilityEmptyState({
  titulo,
  descricao,
  exemplos = [],
  onSelecionarExemplo,
}: {
  titulo: string
  descricao: string
  exemplos?: ExemploConsulta[]
  onSelecionarExemplo?: (valor: string) => void
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/80 p-6 text-center md:p-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary/80">Rastreabilidade</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">{descricao}</p>

      {exemplos.length > 0 && onSelecionarExemplo ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {exemplos.map((exemplo) => (
            <button
              key={`${exemplo.rotulo}-${exemplo.valor}`}
              type="button"
              onClick={() => onSelecionarExemplo(exemplo.valor)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              {exemplo.rotulo}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
