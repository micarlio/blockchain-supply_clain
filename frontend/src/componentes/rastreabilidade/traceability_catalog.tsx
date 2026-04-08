import { ArrowUpRight, Search } from "lucide-react"
import { useMemo, useState } from "react"

import type { ItemInsumo, TipoEntidade } from "../../lib/api/tipos"
import { obterLotIdItem } from "../../lib/util/rastreabilidade"
import { formatarData } from "../../lib/util/formatacao"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeStatus } from "../comum/badge_status"
import { CartaoPainel } from "../comum/cartao_painel"
import { TraceabilityEmptyState } from "./traceability_empty_state"

type FiltroStatus = "todos" | "confirmado" | "pendente" | "disponivel" | "consumido"
type FiltroTipo = "todos" | TipoEntidade

const CLASSE_CAMPO =
  "w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"

function correspondeStatus(item: ItemInsumo, filtro: FiltroStatus) {
  if (filtro === "todos") {
    return true
  }
  if (filtro === "confirmado" || filtro === "pendente") {
    return item.status_origem === filtro
  }
  return item.status_consumo === filtro
}

function correspondeTipo(item: ItemInsumo, filtro: FiltroTipo) {
  return filtro === "todos" || item.entity_kind === filtro
}

export function TraceabilityCatalog({
  itens,
  identificadorAtivo,
  onConsultarItem,
}: {
  itens: ItemInsumo[]
  identificadorAtivo?: string | null
  onConsultarItem: (identificador: string) => void
}) {
  const [busca, setBusca] = useState("")
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>("todos")
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos")

  const { totais, totaisPorTipo } = useMemo(() => {
    let disponiveis = 0
    let consumidos = 0
    let pendentes = 0
    let materiasPrimas = 0
    let produtosSimples = 0
    let produtosCompostos = 0

    for (const item of itens) {
      if (item.status_consumo === "disponivel") {
        disponiveis += 1
      }
      if (item.status_consumo === "consumido") {
        consumidos += 1
      }
      if (item.status_origem === "pendente") {
        pendentes += 1
      }

      if (item.entity_kind === "raw_material") {
        materiasPrimas += 1
      } else if (item.entity_kind === "simple_product") {
        produtosSimples += 1
      } else if (item.entity_kind === "composite_product") {
        produtosCompostos += 1
      }
    }

    return {
      totais: [
        { rotulo: "Total", valor: itens.length },
        { rotulo: "Disponíveis", valor: disponiveis },
        { rotulo: "Consumidos", valor: consumidos },
        { rotulo: "Pendentes", valor: pendentes },
      ],
      totaisPorTipo: [
        { rotulo: "Matérias-primas", valor: materiasPrimas },
        { rotulo: "Produtos simples", valor: produtosSimples },
        { rotulo: "Produtos compostos", valor: produtosCompostos },
      ],
    }
  }, [itens])

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return itens.filter((item) => {
      const lotId = obterLotIdItem(item) ?? ""
      const correspondeBusca =
        termo.length === 0 ||
        item.product_id.toLowerCase().includes(termo) ||
        item.product_name.toLowerCase().includes(termo) ||
        item.event_id.toLowerCase().includes(termo) ||
        lotId.toLowerCase().includes(termo)

      return correspondeBusca && correspondeTipo(item, filtroTipo) && correspondeStatus(item, filtroStatus)
    })
  }, [busca, filtroStatus, filtroTipo, itens])

  return (
    <CartaoPainel
      titulo="Itens disponíveis para consulta"
      descricao="Catálogo derivado da cadeia ativa, mempool e demonstrações dos nós. Use a lista para localizar rapidamente itens rastreáveis e abrir a árvore sem depender do ID de memória."
      className="p-6"
    >
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
        {totais.map((total) => (
          <div key={total.rotulo} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{total.rotulo}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{total.valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {totaisPorTipo.map((tipo) => (
          <span
            key={tipo.rotulo}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"
          >
            {tipo.rotulo}: {tipo.valor}
          </span>
        ))}
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-[1.2fr_0.7fr_0.7fr]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className={`${CLASSE_CAMPO} pl-11`}
            placeholder="Buscar por identificador, nome, event_id ou lot_id"
          />
        </label>

        <select
          value={filtroTipo}
          onChange={(event) => setFiltroTipo(event.target.value as FiltroTipo)}
          className={CLASSE_CAMPO}
        >
          <option value="todos">Todos os tipos</option>
          <option value="raw_material">Matérias-primas</option>
          <option value="simple_product">Produtos simples</option>
          <option value="composite_product">Produtos compostos</option>
        </select>

        <select
          value={filtroStatus}
          onChange={(event) => setFiltroStatus(event.target.value as FiltroStatus)}
          className={CLASSE_CAMPO}
        >
          <option value="todos">Todos os status</option>
          <option value="confirmado">Origem confirmada</option>
          <option value="pendente">Origem pendente</option>
          <option value="disponivel">Disponível</option>
          <option value="consumido">Consumido</option>
        </select>
      </div>

      {itensFiltrados.length === 0 ? (
        <div className="mt-5">
          <TraceabilityEmptyState
            titulo="Nenhum item encontrado com os filtros atuais"
            descricao="Ajuste a busca, troque o tipo ou gere novos eventos para expandir o catálogo conhecido pelo frontend."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {itensFiltrados.map((item) => {
            const lotId = obterLotIdItem(item)
            const emFoco = identificadorAtivo === item.product_id || identificadorAtivo === item.event_id || identificadorAtivo === lotId

            return (
              <button
                key={item.event_id}
                type="button"
                onClick={() => onConsultarItem(lotId ?? item.product_id)}
                className={`group w-full rounded-[1.45rem] border px-4 py-4 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 ${emFoco ? "border-primary/30 bg-primary/5" : "border-slate-200/70 bg-white"}`}
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeEntidade tipo={item.entity_kind} />
                      <BadgeStatus status={item.status_origem} />
                      <BadgeStatus status={item.status_consumo} />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className="text-lg font-semibold tracking-tight text-slate-900">{item.product_name}</p>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                        {formatarData(item.timestamp)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-2 xl:grid-cols-3">
                      <span>
                        <span className="font-semibold text-slate-700">Identificador:</span> {item.product_id}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">event_id:</span> {item.event_id}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">lot_id:</span> {lotId ?? "-"}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">Origem:</span> {item.status_origem}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">Status:</span> {item.status_consumo}
                      </span>
                      <span>
                        <span className="font-semibold text-slate-700">Entradas:</span> {item.input_ids.length}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                        consulta por {lotId ? "lot_id" : "product_id"}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">
                        {item.input_ids.length === 0 ? "origem sem insumos" : `${item.input_ids.length} entrada${item.input_ids.length === 1 ? "" : "s"} usada${item.input_ids.length === 1 ? "" : "s"}`}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors group-hover:text-primary">
                    <ArrowUpRight className="h-4 w-4" />
                    Consultar
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </CartaoPainel>
  )
}
