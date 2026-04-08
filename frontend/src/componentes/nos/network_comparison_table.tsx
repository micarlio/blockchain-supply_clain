import { NetworkRoleBadge } from "./network_role_badge"
import { NetworkSyncIndicator } from "./network_sync_indicator"
import { BadgeStatus } from "../comum/badge_status"
import { CartaoPainel } from "../comum/cartao_painel"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import type { LinhaNoRede, ResumoCluster } from "../../lib/util/rede_cluster"

type Props = {
  linhas: LinhaNoRede[]
  resumo: ResumoCluster
}

function classeDiferenca(ativa: boolean) {
  return ativa ? "font-semibold text-amber-700" : "text-slate-900"
}

export function NetworkComparisonTable({ linhas, resumo }: Props) {
  const estadoComparacao = resumo.redeConsistente
    ? "Rede consistente: altura, hash da ponta e mempool estão alinhados nos nós online."
    : "Diferenças detectadas entre altura, hash da ponta ou mempool."

  return (
    <CartaoPainel titulo="Comparação lado a lado" descricao={estadoComparacao} className="p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {resumo.redeConsistente ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            rede alinhada
          </span>
        ) : (
          <BadgeStatus status="divergente" />
        )}
        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
          referência: altura {resumo.alturaReferencia} • {encurtarHash(resumo.hashReferencia, 16)}
        </span>
        {resumo.haDivergenciaAltura ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            alturas divergentes
          </span>
        ) : null}
        {resumo.haDivergenciaHash ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            hashes divergentes
          </span>
        ) : null}
        {resumo.haDivergenciaMempool ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
            mempool divergente
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-white">
        <div className="grid min-w-[1040px] grid-cols-[1.45fr_1.1fr_0.65fr_0.65fr_1.15fr_1.25fr_0.9fr] gap-4 border-b border-slate-200/70 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
          <div>Nó</div>
          <div>Papel</div>
          <div>Altura</div>
          <div>Mempool</div>
          <div>Hash da ponta</div>
          <div>Sincronização</div>
          <div>Último contato</div>
        </div>

        <div className="divide-y divide-slate-100">
          {linhas.map((linha) => {
            const alturaDivergente = linha.online && linha.altura !== resumo.alturaReferencia
            const mempoolDivergente =
              linha.online && resumo.mempoolReferencia !== null && linha.mempool !== resumo.mempoolReferencia
            const hashDivergente = linha.online && linha.hashPonta !== resumo.hashReferencia

            return (
              <div
                key={linha.no.id}
                className={cx(
                  "grid min-w-[1040px] grid-cols-[1.45fr_1.1fr_0.65fr_0.65fr_1.15fr_1.25fr_0.9fr] gap-4 px-4 py-3.5 text-sm",
                  linha.ativo ? "bg-primary/[0.03]" : "bg-white",
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold tracking-tight text-slate-900">{linha.no.nome}</p>
                    {linha.ativo ? <BadgeStatus status="ativo" /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{linha.no.url}</p>
                </div>

                <div>
                  <NetworkRoleBadge papel={linha.papel} compacto />
                </div>

                <div className={classeDiferenca(alturaDivergente)}>{linha.altura ?? "-"}</div>

                <div className={classeDiferenca(mempoolDivergente)}>{linha.mempool ?? "-"}</div>

                <div className={cx("font-mono text-xs", classeDiferenca(hashDivergente))}>
                  {encurtarHash(linha.hashPonta, 18)}
                </div>

                <div>
                  <NetworkSyncIndicator
                    estado={linha.syncEstado}
                    percentual={linha.alinhamentoPercentual}
                    descricao={linha.syncDescricao}
                    compacto
                  />
                </div>

                <div className="text-xs text-slate-500">{formatarData(linha.ultimoContato)}</div>
              </div>
            )
          })}
        </div>
      </div>
    </CartaoPainel>
  )
}
