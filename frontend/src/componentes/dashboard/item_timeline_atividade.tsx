import { CheckCircle2, CircleAlert, CircleX, Info } from "lucide-react"

import type { AtividadeRede } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { formatarData } from "../../lib/util/formatacao"

function obterVisualSeveridade(severidade: string) {
  const chave = severidade.toLowerCase()

  if (chave === "success") {
    return {
      Icone: CheckCircle2,
      chip: "bg-emerald-100 text-emerald-800",
      ponto: "bg-emerald-500",
      rotulo: "success",
    }
  }

  if (chave === "warning") {
    return {
      Icone: CircleAlert,
      chip: "bg-amber-100 text-amber-800",
      ponto: "bg-amber-500",
      rotulo: "warning",
    }
  }

  if (chave === "error" || chave === "erro") {
    return {
      Icone: CircleX,
      chip: "bg-rose-100 text-rose-800",
      ponto: "bg-rose-500",
      rotulo: "erro",
    }
  }

  return {
    Icone: Info,
    chip: "bg-slate-100 text-slate-700",
    ponto: "bg-slate-400",
    rotulo: "info",
  }
}

type Props = {
  atividade: AtividadeRede
  ultimo?: boolean
}

export function ItemTimelineAtividade({ atividade, ultimo = false }: Props) {
  const visual = obterVisualSeveridade(atividade.severidade)
  const Icone = visual.Icone

  return (
    <div className="relative pl-11">
      {!ultimo ? <div className="absolute left-[15px] top-9 h-[calc(100%-1rem)] w-px bg-slate-200" /> : null}

      <div className={cx("absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full", visual.chip)}>
        <Icone className="h-4 w-4" />
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className={cx("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]", visual.chip)}>
            {visual.rotulo}
          </span>
          <span className="text-xs text-slate-500">{formatarData(atividade.timestamp)}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold capitalize text-slate-900">{atividade.tipo.replaceAll("_", " ")}</p>
          <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500">
            {atividade.node_id}
          </span>
        </div>

        <p className="mt-2 text-sm leading-6 text-slate-500">{atividade.descricao}</p>
      </div>
    </div>
  )
}
