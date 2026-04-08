import { Blocks, Database, Hash, UserRound } from "lucide-react"
import { useMemo } from "react"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { totalEventosConfirmados } from "../../lib/util/blockchain"
import { KpiCompacto } from "../dashboard/kpi_compacto"

export function BlockchainSummaryCards({ cadeiaAtiva }: { cadeiaAtiva: BlocoBlockchain[] }) {
  const totalBlocos = cadeiaAtiva.length
  const ultimoBloco = cadeiaAtiva.at(-1)

  const altura = ultimoBloco?.index ?? 0
  const totalEventos = useMemo(() => totalEventosConfirmados(cadeiaAtiva), [cadeiaAtiva])
  const ultimoMinerador = ultimoBloco?.miner_id ?? "genesis"

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <KpiCompacto
        titulo="Altura da cadeia"
        valor={altura}
        subtitulo="indice do topo no no ativo"
        icone={Hash}
      />
      <KpiCompacto
        titulo="Total de blocos"
        valor={totalBlocos}
        subtitulo="cadeia ativa visivel neste no"
        icone={Blocks}
      />
      <KpiCompacto
        titulo="Eventos confirmados"
        valor={totalEventos}
        subtitulo="eventos confirmados em blocos"
        icone={Database}
      />
      <KpiCompacto
        titulo="Ultimo minerador"
        valor={ultimoMinerador}
        subtitulo={ultimoBloco ? `bloco #${ultimoBloco.index}` : "somente genesis"}
        icone={UserRound}
      />
    </section>
  )
}
