export function CarregandoPainel({ mensagem = "Carregando dados..." }: { mensagem?: string }) {
  return (
    <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-8">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
        <span>{mensagem}</span>
      </div>
    </div>
  )
}
