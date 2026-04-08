import { Eye, Pickaxe, Shield, SlidersHorizontal } from "lucide-react"

import { cx } from "../../lib/util/classe"
import { obterMetaPapelNo } from "../../lib/util/rede_cluster"

type Props = {
  papel: string
  compacto?: boolean
}

const estilos = {
  minerador: {
    caixa: "border-primary/15 bg-primary/5 text-primary",
    icone: "bg-primary/10 text-primary",
  },
  controle: {
    caixa: "border-amber-200/70 bg-amber-50 text-amber-900",
    icone: "bg-amber-100 text-amber-700",
  },
  observador: {
    caixa: "border-slate-200/80 bg-slate-50 text-slate-700",
    icone: "bg-slate-200/80 text-slate-600",
  },
  desconhecido: {
    caixa: "border-slate-200/80 bg-white text-slate-700",
    icone: "bg-slate-100 text-slate-500",
  },
} as const

function IconePapel({
  chave,
  className,
  strokeWidth,
}: {
  chave: ReturnType<typeof obterMetaPapelNo>["chave"]
  className: string
  strokeWidth: number
}) {
  if (chave === "minerador") {
    return <Pickaxe className={className} strokeWidth={strokeWidth} />
  }

  if (chave === "controle") {
    return <SlidersHorizontal className={className} strokeWidth={strokeWidth} />
  }

  if (chave === "observador") {
    return <Eye className={className} strokeWidth={strokeWidth} />
  }

  return <Shield className={className} strokeWidth={strokeWidth} />
}

export function NetworkRoleBadge({ papel, compacto = false }: Props) {
  const meta = obterMetaPapelNo(papel)
  const estilo = estilos[meta.chave]

  if (compacto) {
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
          estilo.caixa,
        )}
      >
        <IconePapel chave={meta.chave} className="h-3.5 w-3.5" strokeWidth={2.3} />
        {meta.rotulo}
      </span>
    )
  }

  return (
    <div className={cx("flex items-start gap-3 rounded-2xl border p-3", estilo.caixa)}>
      <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", estilo.icone)}>
        <IconePapel chave={meta.chave} className="h-4 w-4" strokeWidth={2.4} />
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold tracking-tight">{meta.rotulo}</p>
        <p className="mt-0.5 text-xs text-current/75">{meta.descricao}</p>
      </div>
    </div>
  )
}
