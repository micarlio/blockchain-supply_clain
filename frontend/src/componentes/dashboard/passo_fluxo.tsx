import type { LucideIcon } from "lucide-react"

type Props = {
  titulo: string
  valor: number | string
  subtitulo: string
  icone: LucideIcon
}

export function PassoFluxo({ titulo, valor, subtitulo, icone: Icone }: Props) {
  return (
    <div className="relative min-w-[132px] rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icone className="h-4 w-4" />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{titulo}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{subtitulo}</p>
    </div>
  )
}
