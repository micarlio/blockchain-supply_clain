import type { ItemInsumo, NoRastreabilidade } from "../../lib/api/tipos"
import { ROTULOS_ENTIDADE } from "../../lib/dominio/dominio"
import type { MetricasRastreabilidade } from "../../lib/util/rastreabilidade"
import { obterLotIdItem } from "../../lib/util/rastreabilidade"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeEvento } from "../comum/badge_evento"
import { BadgeStatus } from "../comum/badge_status"
import { CartaoPainel } from "../comum/cartao_painel"

function CampoResumo({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{rotulo}</p>
      <p className="mt-2 break-all text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  )
}

export function TraceabilityRootCard({
  raiz,
  itemCatalogo,
  metricas,
  identificadorConsultado,
}: {
  raiz: NoRastreabilidade
  itemCatalogo: ItemInsumo | null
  metricas: MetricasRastreabilidade
  identificadorConsultado: string
}) {
  const lotId = itemCatalogo ? obterLotIdItem(itemCatalogo) : null
  const origemBloco = raiz.block_index !== null ? `bloco #${raiz.block_index} • ${encurtarHash(raiz.block_hash)}` : "Evento ainda pendente na mempool"

  return (
    <CartaoPainel
      titulo="Contexto do item consultado"
      descricao="Resumo do nó raiz para deixar explícito qual item está sendo analisado e como ele foi formado."
      className="p-6"
    >
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgeEvento tipo={raiz.evento.event_type} />
            <BadgeEntidade tipo={raiz.evento.entity_kind} />
            <BadgeStatus status={raiz.status} />
            {itemCatalogo ? <BadgeStatus status={itemCatalogo.status_consumo} /> : null}
          </div>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">{raiz.evento.product_name}</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            Consulta atual em <span className="font-semibold text-slate-700">{identificadorConsultado}</span>. A árvore usa o evento criador e os `input_ids` recursivos para reconstruir a origem completa do item.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CampoResumo rotulo="Identificador principal" valor={raiz.evento.product_id} />
            <CampoResumo rotulo="event_id" valor={raiz.evento.event_id} />
            <CampoResumo rotulo="Origem em bloco" valor={origemBloco} />
            <CampoResumo rotulo="Dependências diretas" valor={metricas.dependenciasDiretas} />
            <CampoResumo rotulo="Profundidade" valor={`${metricas.profundidade} ${metricas.profundidade === 1 ? "nível" : "níveis"}`} />
            <CampoResumo rotulo="Data do evento" valor={formatarData(raiz.evento.timestamp)} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Leitura rápida</p>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex justify-between gap-4">
              <dt>Tipo</dt>
              <dd className="font-semibold text-slate-900">{ROTULOS_ENTIDADE[raiz.evento.entity_kind]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Status de origem</dt>
              <dd className="font-semibold text-slate-900">{raiz.status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Status de disponibilidade</dt>
              <dd className="font-semibold text-slate-900">{itemCatalogo?.status_consumo ?? "não inferido"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>lot_id</dt>
              <dd className="font-semibold text-slate-900">{lotId ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Ator de origem</dt>
              <dd className="font-semibold text-slate-900">{raiz.evento.actor_id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Minerador</dt>
              <dd className="font-semibold text-slate-900">{raiz.miner_id ?? "-"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </CartaoPainel>
  )
}
