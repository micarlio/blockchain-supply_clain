import { Eye, X } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { formatarData, formatarJson, ordenarDescPorTimestamp } from "../../lib/util/formatacao"
import type { ItemInsumo } from "../../lib/api/tipos"
import { BadgeEntidade } from "./badge_entidade"
import { BadgeEvento } from "./badge_evento"
import { BadgeStatus } from "./badge_status"
import { CartaoPainel } from "./cartao_painel"
import { EstadoVazio } from "./estado_vazio"

type FiltroStatus = "todos" | "confirmado" | "pendente" | "disponivel" | "consumido"

const CLASSE_CAMPO =
  "w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 text-sm text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"

function obterLotId(item: ItemInsumo) {
  const valor = item.metadata?.lot_id
  return typeof valor === "string" ? valor : null
}

function CampoDetalhe({
  rotulo,
  valor,
  mono = false,
}: {
  rotulo: string
  valor: string | number
  mono?: boolean
}) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{rotulo}</p>
      <p className={`mt-2 break-all text-sm font-medium text-slate-700 ${mono ? "font-mono text-[13px]" : ""}`}>{valor}</p>
    </div>
  )
}

function ModalDetalhesItem({
  item,
  onClose,
}: {
  item: ItemInsumo
  onClose: () => void
}) {
  const lotId = obterLotId(item)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/28 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhes-item-titulo"
        className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Detalhes do item</p>
            <h3 id="detalhes-item-titulo" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {item.product_name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{formatarData(item.timestamp)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar detalhes"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(85vh-88px)] space-y-5 overflow-y-auto p-5">
          <div className="flex flex-wrap gap-2">
            <BadgeEvento tipo={item.event_type} />
            <BadgeEntidade tipo={item.entity_kind} />
            <BadgeStatus status={item.status_origem} />
            <BadgeStatus status={item.status_consumo} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <CampoDetalhe rotulo="product_id" valor={item.product_id} />
            <CampoDetalhe rotulo="event_id" valor={item.event_id} mono />
            <CampoDetalhe rotulo="ator" valor={item.ator_origem} />
            <CampoDetalhe rotulo="nó de origem" valor={item.no_origem ?? "-"} />
            <CampoDetalhe rotulo="lot_id" valor={lotId ?? "-"} />
            <CampoDetalhe rotulo="insumos usados" valor={item.input_ids.length} />
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">input_ids</p>
            {item.input_ids.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.input_ids.map((inputId) => (
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
                Este evento não utiliza `input_ids`.
              </div>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">metadata</p>
            <pre className="mt-3 overflow-x-auto rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 font-mono text-xs leading-6 text-slate-600">
              {formatarJson(item.metadata)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function correspondeAoFiltro(item: ItemInsumo, filtro: FiltroStatus) {
  if (filtro === "todos") {
    return true
  }
  if (filtro === "confirmado" || filtro === "pendente") {
    return item.status_origem === filtro
  }
  return item.status_consumo === filtro
}

export function CatalogoItens({
  itens,
  titulo = "Catálogo de itens",
  descricao = "Lista de itens rastreáveis conhecidos pelo frontend.",
}: {
  itens: ItemInsumo[]
  titulo?: string
  descricao?: string
}) {
  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<FiltroStatus>("todos")
  const [itemSelecionado, setItemSelecionado] = useState<ItemInsumo | null>(null)

  const itensOrdenados = useMemo(() => ordenarDescPorTimestamp(itens), [itens])
  const metricasResumo = useMemo(() => {
    let disponiveis = 0
    let consumidos = 0
    let pendentes = 0

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
    }

    return [
      { rotulo: "Total", valor: itens.length },
      { rotulo: "Disponíveis", valor: disponiveis },
      { rotulo: "Consumidos", valor: consumidos },
      { rotulo: "Pendentes", valor: pendentes },
    ]
  }, [itens])

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itensOrdenados.filter((item) => {
      const lotId = typeof item.metadata?.lot_id === "string" ? item.metadata.lot_id : ""
      const correspondeBusca =
        termo.length === 0 ||
        item.product_id.toLowerCase().includes(termo) ||
        item.product_name.toLowerCase().includes(termo) ||
        item.event_id.toLowerCase().includes(termo) ||
        (item.no_origem ?? "").toLowerCase().includes(termo) ||
        lotId.toLowerCase().includes(termo)
      return correspondeBusca && correspondeAoFiltro(item, filtro)
    })
  }, [busca, filtro, itensOrdenados])

  useEffect(() => {
    if (!itemSelecionado) {
      return
    }

    function aoPressionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setItemSelecionado(null)
      }
    }

    window.addEventListener("keydown", aoPressionarTecla)
    return () => window.removeEventListener("keydown", aoPressionarTecla)
  }, [itemSelecionado])

  return (
    <>
      <CartaoPainel
        titulo={titulo}
        descricao={descricao}
        className="p-6"
      >
        <div className="mb-6 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          {metricasResumo.map((item) => (
            <div
              key={item.rotulo}
              className="flex min-h-[84px] flex-col justify-between rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.rotulo}</p>
              <p className="text-[28px] font-bold leading-none tracking-tight text-slate-900">{item.valor}</p>
            </div>
          ))}
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-[1.4fr_0.8fr]">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            className={CLASSE_CAMPO}
            placeholder="Buscar por product_id, event_id, nome ou lot_id"
          />
          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as FiltroStatus)}
            className={CLASSE_CAMPO}
          >
            <option value="todos">Todos os itens</option>
            <option value="confirmado">Somente confirmados</option>
            <option value="pendente">Somente pendentes</option>
            <option value="disponivel">Somente disponíveis</option>
            <option value="consumido">Somente consumidos</option>
          </select>
        </div>

        {itensFiltrados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum item encontrado"
            descricao="Ajuste os filtros ou gere novos eventos para popular o catálogo."
          />
        ) : (
          <div className="space-y-3">
            {itensFiltrados.map((item) => {
              const lotId = obterLotId(item)

              return (
                <div key={item.event_id} className="rounded-[1.35rem] border border-slate-200/70 bg-white px-4 py-4 transition-colors hover:bg-slate-50/40">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <BadgeEvento tipo={item.event_type} />
                        <BadgeEntidade tipo={item.entity_kind} />
                        <BadgeStatus status={item.status_origem} />
                        <BadgeStatus status={item.status_consumo} />
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <p className="text-lg font-semibold tracking-tight text-slate-900">{item.product_name}</p>
                        <span className="rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
                          {formatarData(item.timestamp)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                        <span>
                          <span className="font-semibold text-slate-700">product_id:</span> {item.product_id}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">event_id:</span> {item.event_id}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">ator:</span> {item.ator_origem}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">nó:</span> {item.no_origem ?? "-"}
                        </span>
                        <span>
                          <span className="font-semibold text-slate-700">lot_id:</span> {lotId ?? "-"}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setItemSelecionado(item)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <Eye className="h-4 w-4" />
                      Mais detalhes
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CartaoPainel>

      {itemSelecionado ? (
        <ModalDetalhesItem item={itemSelecionado} onClose={() => setItemSelecionado(null)} />
      ) : null}
    </>
  )
}
