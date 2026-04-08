import { cx } from "../../lib/util/classe"

type Props = {
  status: string
}

const estilos: Record<string, string> = {
  online: "bg-emerald-100 text-emerald-800",
  sincronizado: "bg-emerald-100 text-emerald-800",
  divergente: "bg-amber-100 text-amber-800",
  atrasado: "bg-blue-100 text-blue-800",
  offline: "bg-red-100 text-red-800",
  confirmado: "bg-blue-100 text-blue-800",
  pendente: "bg-amber-100 text-amber-800",
  nao_encontrado: "bg-slate-200 text-slate-700",
  disponivel: "bg-emerald-100 text-emerald-800",
  consumido: "bg-red-100 text-red-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  error: "bg-red-100 text-red-700",
  ativo: "bg-primary/10 text-primary",
}

const rotulos: Record<string, string> = {
  nao_encontrado: "não encontrado",
  disponivel: "disponível",
}

export function BadgeStatus({ status }: Props) {
  const chave = status.toLowerCase()
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        estilos[chave] ?? "bg-surface-container-high text-on-surface-variant",
      )}
    >
      {rotulos[chave] ?? status.replaceAll("_", " ")}
    </span>
  )
}
