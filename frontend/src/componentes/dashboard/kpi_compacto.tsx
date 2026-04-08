import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cx } from "../../lib/util/classe"

type Props = {
  titulo: string
  valor: ReactNode
  subtitulo: string
  icone: LucideIcon
  destaque?: ReactNode
  className?: string
  valorClassName?: string
}

export function KpiCompacto({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  destaque,
  className,
  valorClassName,
}: Props) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-[transform,box-shadow,background-color] hover:translate-y-px hover:bg-slate-50/80 hover:shadow-[inset_0_2px_6px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">{titulo}</p>
        <div className="flex items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50/80 p-2 text-primary">
          <Icone className="h-4 w-4" strokeWidth={2.5} />
        </div>
      </div>

      <div className="mt-3 min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <div className={cx("min-w-0 text-3xl font-bold tracking-tight text-slate-900", valorClassName)}>
            {valor}
          </div>
          {destaque}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
          {subtitulo}
        </p>
      </div>
    </div>
  )
}
