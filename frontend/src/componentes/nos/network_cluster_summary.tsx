import { Blocks, Fingerprint, Pickaxe, ShieldCheck, Wifi } from "lucide-react"

import { KpiCompacto } from "../dashboard/kpi_compacto"
import { formatarData } from "../../lib/util/formatacao"
import { nomeNoPorId, type ResumoCluster } from "../../lib/util/rede_cluster"
import type { ConfiguracaoNo } from "../../lib/api/tipos"

type Props = {
  resumo: ResumoCluster
  nos: ConfiguracaoNo[]
}

function HashComTooltip({ hash }: { hash: string | null }) {
  if (!hash) {
    return <span>-</span>
  }

  return (
    <span className="group relative block min-w-0" title={hash}>
      <span className="block truncate">{hash}</span>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-[18rem] rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-medium leading-relaxed text-white shadow-[0_10px_30px_rgba(15,23,42,0.28)] group-hover:block">
        {hash}
      </span>
    </span>
  )
}

export function NetworkClusterSummary({ resumo, nos }: Props) {
  const ultimoMinerador = nomeNoPorId(resumo.ultimoMinerador, nos)

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCompacto
          titulo="Nós online"
          valor={`${resumo.nosOnline}/${resumo.totalNos}`}
          subtitulo="respondendo nas APIs do cluster"
          icone={Wifi}
        />

        <KpiCompacto
          titulo="Nós sincronizados"
          valor={`${resumo.nosSincronizados}/${Math.max(resumo.nosOnline, 1)}`}
          subtitulo="alinhados com a referência atual"
          icone={ShieldCheck}
        />

        <KpiCompacto
          titulo="Hash do topo"
          valor={<HashComTooltip hash={resumo.hashReferencia} />}
          valorClassName="truncate font-mono text-[2rem] leading-none sm:text-[2.15rem]"
          subtitulo={
            resumo.hashReferencia
              ? `${resumo.hashCompartilhadoPor} nós compartilham essa ponta`
              : "nenhum hash compartilhado ainda"
          }
          icone={Fingerprint}
        />

        <KpiCompacto
          titulo="Último bloco observado"
          valor={resumo.ultimoBloco ? `#${resumo.ultimoBloco.index}` : "Gênesis"}
          subtitulo={resumo.ultimoBloco ? formatarData(resumo.ultimoBloco.timestamp) : "apenas bloco inicial"}
          icone={Blocks}
        />

        <KpiCompacto
          titulo="Último nó que minerou"
          valor={ultimoMinerador}
          subtitulo={resumo.ultimoBloco ? "inferido pela cadeia observada" : "sem bloco minerado observado"}
          icone={Pickaxe}
        />
      </div>
    </section>
  )
}
