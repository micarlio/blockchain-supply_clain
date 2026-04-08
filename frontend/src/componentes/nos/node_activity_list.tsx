import { CartaoPainel } from "../comum/cartao_painel"
import { BadgeStatus } from "../comum/badge_status"
import { formatarData } from "../../lib/util/formatacao"
import type { LinhaNoRede } from "../../lib/util/rede_cluster"

type Props = {
  linha: LinhaNoRede
}

export function NodeActivityList({ linha }: Props) {
  const atividades = linha.atividades.slice(0, 5)

  return (
    <CartaoPainel
      titulo={`Atividades de ${linha.no.nome}`}
      descricao="Eventos recentes observados neste nó e um resumo derivado da cadeia local."
      className="p-5"
    >
      {atividades.length > 0 ? (
        <div className="space-y-2">
          {atividades.map((atividade) => (
            <div key={atividade.id} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <BadgeStatus status={atividade.severidade} />
                    {atividade.derivada ? (
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                        derivado
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">{atividade.titulo}</p>
                  <p className="mt-1 text-sm text-on-surface-variant">{atividade.descricao}</p>
                </div>

                <span className="text-xs text-on-surface-variant">{formatarData(atividade.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500">
          Nenhuma atividade recente foi exposta por este nó até agora.
        </div>
      )}
    </CartaoPainel>
  )
}
