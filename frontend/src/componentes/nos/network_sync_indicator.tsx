import { AlertTriangle, CheckCircle2, CloudOff, Clock3 } from "lucide-react"

import { cx } from "../../lib/util/classe"
import { encurtarHash } from "../../lib/util/formatacao"
import type { EstadoSincronizacaoRede } from "../../lib/util/rede_cluster"

type Props = {
  estado: EstadoSincronizacaoRede
  percentual: number
  descricao: string
  hashPonta?: string | null
  hashReferencia?: string | null
  compacto?: boolean
}

const estiloPorEstado = {
  sincronizado: {
    rotulo: "alinhado",
    barra: "bg-emerald-400",
    badge: "bg-slate-100 text-slate-700",
  },
  atrasado: {
    rotulo: "atrasado",
    barra: "bg-blue-500",
    badge: "bg-blue-100 text-blue-800",
  },
  divergente: {
    rotulo: "divergente",
    barra: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800",
  },
  offline: {
    rotulo: "offline",
    barra: "bg-red-400",
    badge: "bg-red-100 text-red-700",
  },
} as const

function IconeSincronizacao({
  estado,
  className,
}: {
  estado: EstadoSincronizacaoRede
  className: string
}) {
  if (estado === "sincronizado") {
    return <CheckCircle2 className={className} strokeWidth={2.5} />
  }

  if (estado === "atrasado") {
    return <Clock3 className={className} strokeWidth={2.5} />
  }

  if (estado === "divergente") {
    return <AlertTriangle className={className} strokeWidth={2.5} />
  }

  return <CloudOff className={className} strokeWidth={2.5} />
}

export function NetworkSyncIndicator({
  estado,
  percentual,
  descricao,
  hashPonta,
  hashReferencia,
  compacto = false,
}: Props) {
  const visual = estiloPorEstado[estado]

  if (compacto) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {estado === "sincronizado" ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              alinhado
            </span>
          ) : (
            <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em]", visual.badge)}>
              <IconeSincronizacao estado={estado} className="h-3 w-3" />
              {visual.rotulo}
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cx("h-full rounded-full transition-all", visual.barra)}
            style={{ width: `${Math.max(0, Math.min(percentual, 100))}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Sincronização</p>
          <div className="mt-1.5 flex items-center gap-2">
            {estado === "sincronizado" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                alinhado
              </span>
            ) : (
              <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", visual.badge)}>
                <IconeSincronizacao estado={estado} className="h-3.5 w-3.5" />
                {visual.rotulo}
              </span>
            )}
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-500">{percentual}% alinhado</span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={cx("h-full rounded-full transition-all", visual.barra)}
          style={{ width: `${Math.max(0, Math.min(percentual, 100))}%` }}
        />
      </div>

      <p className="mt-2.5 text-sm text-slate-600">{descricao}</p>

      <div className="mt-3 grid gap-2 text-[11px] text-slate-500 sm:grid-cols-2">
        <div className="rounded-xl bg-white px-3 py-2">
          <span className="font-semibold text-slate-700">Ponta atual:</span> {encurtarHash(hashPonta, 18)}
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <span className="font-semibold text-slate-700">Referência:</span> {encurtarHash(hashReferencia, 18)}
        </div>
      </div>
    </div>
  )
}
