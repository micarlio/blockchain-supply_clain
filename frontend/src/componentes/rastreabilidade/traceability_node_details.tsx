import type { ItemInsumo, NoRastreabilidade } from "../../lib/api/tipos"
import { ROTULOS_ENTIDADE } from "../../lib/dominio/dominio"
import { obterLotIdItem } from "../../lib/util/rastreabilidade"
import { encurtarHash, formatarData, formatarJson } from "../../lib/util/formatacao"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeEvento } from "../comum/badge_evento"
import { BadgeStatus } from "../comum/badge_status"
import { CartaoPainel } from "../comum/cartao_painel"

function CampoDetalhe({ rotulo, valor, mono = false }: { rotulo: string; valor: string | number; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{rotulo}</p>
      <p className={`mt-2 break-all text-sm font-semibold text-slate-800 ${mono ? "font-mono text-[13px]" : ""}`}>{valor}</p>
    </div>
  )
}

export function TraceabilityNodeDetails({
  no,
  itemCatalogo,
  trilha,
  onUsarComoRaiz,
}: {
  no: NoRastreabilidade | null
  itemCatalogo: ItemInsumo | null
  trilha: NoRastreabilidade[]
  onUsarComoRaiz: (no: NoRastreabilidade) => void
}) {
  if (!no) {
    return (
      <CartaoPainel
        titulo="Detalhes do nó"
        descricao="Selecione um item da árvore para inspecionar seus dados e reutilizá-lo como nova raiz da consulta."
      >
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center text-sm text-slate-500">
          Nenhum nó selecionado ainda.
        </div>
      </CartaoPainel>
    )
  }

  const lotId = itemCatalogo ? obterLotIdItem(itemCatalogo) : null
  const profundidade = Math.max(trilha.length - 1, 0)
  const pai = trilha.length > 1 ? trilha[trilha.length - 2] : null

  return (
    <CartaoPainel
      titulo="Detalhes do nó"
      descricao="Painel contextual do item selecionado dentro da árvore de origem."
      className="xl:sticky xl:top-20"
      destaque={
        <button
          type="button"
          onClick={() => onUsarComoRaiz(no)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
        >
          Usar como nova raiz
        </button>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <BadgeEvento tipo={no.evento.event_type} />
            <BadgeEntidade tipo={no.evento.entity_kind} />
            <BadgeStatus status={no.status} />
            {itemCatalogo ? <BadgeStatus status={itemCatalogo.status_consumo} /> : null}
          </div>

          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">{no.evento.product_name}</h3>
          <p className="mt-1 break-all text-sm text-slate-500">{no.evento.product_id}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CampoDetalhe rotulo="event_id" valor={no.evento.event_id} mono />
          <CampoDetalhe rotulo="tipo" valor={ROTULOS_ENTIDADE[no.evento.entity_kind]} />
          <CampoDetalhe rotulo="lot_id" valor={lotId ?? "-"} />
          <CampoDetalhe rotulo="ator" valor={no.evento.actor_id} />
          <CampoDetalhe rotulo="profundidade" valor={`${profundidade} ${profundidade === 1 ? "nível" : "níveis"}`} />
          <CampoDetalhe rotulo="insumos diretos" valor={no.insumos.length} />
          <CampoDetalhe rotulo="pai imediato" valor={pai?.evento.product_name ?? "raiz da consulta"} />
          <CampoDetalhe rotulo="origem em bloco" valor={no.block_index !== null ? `#${no.block_index}` : "pendente"} />
          <CampoDetalhe rotulo="hash do bloco" valor={encurtarHash(no.block_hash)} mono />
          <CampoDetalhe rotulo="minerador" valor={no.miner_id ?? "-"} />
          <CampoDetalhe rotulo="data do evento" valor={formatarData(no.evento.timestamp)} />
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Breadcrumb da composição</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {trilha.map((item, indice) => (
              <span key={item.evento.event_id} className="contents">
                <span
                  className={`rounded-full border px-3 py-1.5 font-medium ${indice === trilha.length - 1 ? "border-primary/25 bg-primary/5 text-primary" : "border-slate-200 bg-slate-50 text-slate-600"}`}
                >
                  {item.evento.product_name}
                </span>
                {indice < trilha.length - 1 ? <span className="text-slate-300">/</span> : null}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Trilha até este nó</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {trilha.map((item, indice) => (
              <span
                key={item.evento.event_id}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600"
              >
                {indice + 1}. {item.evento.product_name}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">input_ids</p>
          {no.evento.input_ids.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {no.evento.input_ids.map((inputId) => (
                <span
                  key={inputId}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-600"
                >
                  {inputId}
                </span>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-500">
              Este nó é uma origem sem dependências anteriores.
            </div>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">metadata</p>
          <pre className="mt-3 max-h-[220px] overflow-auto rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 font-mono text-xs leading-6 text-slate-600">
            {formatarJson(no.evento.metadata)}
          </pre>
        </div>
      </div>
    </CartaoPainel>
  )
}
