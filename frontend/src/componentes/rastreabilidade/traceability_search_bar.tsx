import { ArrowRight, Search } from "lucide-react"

import type { SugestaoRastreabilidade } from "../../lib/util/rastreabilidade"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeStatus } from "../comum/badge_status"
import { CartaoPainel } from "../comum/cartao_painel"

function rotuloCampo(campo: SugestaoRastreabilidade["campo"]) {
  if (campo === "event_id") {
    return "event_id"
  }
  if (campo === "product_id") {
    return "product_id"
  }
  if (campo === "lot_id") {
    return "lot_id"
  }
  return "nome"
}

export function TraceabilitySearchBar({
  valor,
  onAlterar,
  onConsultar,
  onSelecionarSugestao,
  sugestoes,
  carregando = false,
  dicaResolucao,
}: {
  valor: string
  onAlterar: (valor: string) => void
  onConsultar: () => void
  onSelecionarSugestao: (sugestao: SugestaoRastreabilidade) => void
  sugestoes: SugestaoRastreabilidade[]
  carregando?: boolean
  dicaResolucao?: string | null
}) {
  const exibirSugestoes = valor.trim().length > 0 && sugestoes.length > 0
  const identificadoresSuportados = ["product_id", "event_id", "lot_id", "nome"]

  return (
    <CartaoPainel
      titulo="Consulta rápida"
      descricao="Busque por product_id, event_id, lot_id ou nome. Se o backend não suportar diretamente, a tela resolve usando o catálogo local conhecido."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          onConsultar()
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={valor}
              onChange={(event) => onAlterar(event.target.value)}
              className="w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-11 py-3.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"
              placeholder="Ex.: BICICLETA-E2E-01, EVT-102 ou Chapa de Aço"
            />
          </div>

          <button
            type="submit"
            disabled={carregando || valor.trim().length === 0}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary-gradient px-5 py-3 text-sm font-semibold text-on-primary transition-[transform,opacity] hover:opacity-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowRight className="h-4 w-4" />
            {carregando ? "Consultando..." : "Consultar"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Entradas aceitas</p>
          {identificadoresSuportados.map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>

        {dicaResolucao ? <p className="text-xs text-slate-500">{dicaResolucao}</p> : null}

        {exibirSugestoes ? (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-2">
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Sugestões conhecidas</p>
              <p className="text-[11px] text-slate-500">Selecione para consultar sem digitar o ID completo</p>
            </div>

            <div className="space-y-2">
              {sugestoes.map((sugestao) => (
                <button
                  key={`${sugestao.item.event_id}-${sugestao.campo}`}
                  type="button"
                  onClick={() => onSelecionarSugestao(sugestao)}
                  className="flex w-full items-start justify-between gap-3 rounded-2xl border border-transparent bg-white px-4 py-3 text-left transition-all hover:border-primary/20 hover:bg-primary/5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{sugestao.item.product_name}</p>
                      <BadgeEntidade tipo={sugestao.item.entity_kind} />
                      <BadgeStatus status={sugestao.item.status_origem} />
                      <BadgeStatus status={sugestao.item.status_consumo} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {rotuloCampo(sugestao.campo)}: <span className="font-semibold text-slate-700">{sugestao.valorCorrespondente}</span>
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      product_id {sugestao.item.product_id} • event_id {sugestao.item.event_id}
                    </p>
                  </div>

                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    consultar
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </CartaoPainel>
  )
}
