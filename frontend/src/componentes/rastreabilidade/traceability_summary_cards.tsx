import { Boxes, Clock3, GitBranch, Leaf, Network } from "lucide-react"

import type { MetricasRastreabilidade } from "../../lib/util/rastreabilidade"
import { KpiCompacto } from "../dashboard/kpi_compacto"

const PLACEHOLDER = "--"

export function TraceabilitySummaryCards({ metricas }: { metricas: MetricasRastreabilidade | null }) {
  const itens = [
    {
      titulo: "Profundidade",
      valor: metricas?.profundidade ?? PLACEHOLDER,
      subtitulo: "Níveis da árvore de origem",
      icone: GitBranch,
    },
    {
      titulo: "Dependências",
      valor: metricas?.totalDependencias ?? PLACEHOLDER,
      subtitulo: "Itens ancestrais na cadeia",
      icone: Network,
    },
    {
      titulo: "Matérias-primas",
      valor: metricas?.materiasPrimas ?? PLACEHOLDER,
      subtitulo: "Nós finais da composição",
      icone: Leaf,
    },
    {
      titulo: "Intermediários",
      valor: metricas?.produtosIntermediarios ?? PLACEHOLDER,
      subtitulo: "Produtos simples ou compostos no caminho",
      icone: Boxes,
    },
    {
      titulo: "Pendentes",
      valor: metricas?.pendentes ?? PLACEHOLDER,
      subtitulo: "Itens ainda fora de bloco",
      icone: Clock3,
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {itens.map((item) => (
        <KpiCompacto
          key={item.titulo}
          titulo={item.titulo}
          valor={item.valor}
          subtitulo={item.subtitulo}
          icone={item.icone}
          className="rounded-[1.4rem] border border-slate-200/70 bg-white p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
        />
      ))}
    </div>
  )
}
