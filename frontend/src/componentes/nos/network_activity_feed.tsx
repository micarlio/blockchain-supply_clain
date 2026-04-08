import { CartaoPainel } from "../comum/cartao_painel"
import { BadgeStatus } from "../comum/badge_status"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import type { AtividadeCluster } from "../../lib/util/rede_cluster"

type Props = {
  titulo: string
  descricao: string
  atividades: AtividadeCluster[]
  vazio: string
  limite?: number
}

export function NetworkActivityFeed({ titulo, descricao, atividades, vazio, limite = 10 }: Props) {
  const itens = atividades.slice(0, limite)

  return (
    <CartaoPainel titulo={titulo} descricao={descricao} className="p-5">
      {itens.length > 0 ? (
        <div className="space-y-2">
          {itens.map((atividade) => (
            <div key={atividade.id} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-start">
                <div className="flex items-center gap-2">
                  <BadgeStatus status={atividade.severidade} />
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {atividade.nomeNo}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight text-slate-900">{atividade.titulo}</p>
                    {atividade.derivada ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                        derivado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{atividade.descricao}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {atividade.hashRelacionado ? (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 font-mono">
                        {encurtarHash(atividade.hashRelacionado, 18)}
                      </span>
                    ) : null}
                    {atividade.eventIdRelacionado ? (
                      <span className="rounded-full bg-slate-50 px-2.5 py-1 font-mono">
                        {encurtarHash(atividade.eventIdRelacionado, 18)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <span className="shrink-0 text-xs text-slate-400">{formatarData(atividade.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500">{vazio}</div>
      )}
    </CartaoPainel>
  )
}
