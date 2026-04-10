import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Package,
  PackagePlus,
  Pickaxe,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"

import type { EventoBlockchain, ItemInsumo } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { formatarData } from "../../lib/util/formatacao"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeEvento } from "../comum/badge_evento"
import { BadgeStatus } from "../comum/badge_status"

function ChipInsumo({ item }: { item: ItemInsumo }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <BadgeEntidade tipo={item.entity_kind} />
        <BadgeStatus status={item.status_origem} />
      </div>
      <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">{item.product_name}</p>
      <p className="mt-1 text-xs text-slate-500">{item.product_id}</p>
    </div>
  )
}

export function QuickCreateCard({
  titulo,
  descricao,
  icone: Icone,
  nota,
  insumosSelecionados,
  botao,
  disabled = false,
  carregando = false,
  onExecutar,
}: {
  titulo: string
  descricao: string
  icone: LucideIcon
  nota: string
  insumosSelecionados?: ItemInsumo[]
  botao: string
  disabled?: boolean
  carregando?: boolean
  onExecutar: () => void
}) {
  return (
    <div className={cx(
      "flex flex-col h-full rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]",
      disabled ? "opacity-90" : "",
    )}>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Criação rápida</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{titulo}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">{descricao}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm leading-7 text-slate-600">
          {nota}
        </div>

        {insumosSelecionados && insumosSelecionados.length > 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Insumos escolhidos automaticamente</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {insumosSelecionados.map((item) => (
                <ChipInsumo key={item.event_id} item={item} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500">IDs, ator, metadata e timestamp serão gerados automaticamente.</p>
        <button
          type="button"
          onClick={onExecutar}
          disabled={disabled || carregando}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? "Enviando..." : botao}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function QuickPresetCard({
  titulo,
  descricao,
  etapas,
  onExecutar,
  carregando = false,
}: {
  titulo: string
  descricao: string
  etapas: string[]
  onExecutar: () => void
  carregando?: boolean
}) {
  return (
    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Sparkles className="h-5 w-5" />
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Preset</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{titulo}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-500">{descricao}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {etapas.map((etapa) => (
          <span
            key={etapa}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600"
          >
            {etapa}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Executa uma sequência real de eventos no backend atual, sem dados fake.</p>
        <button
          type="button"
          onClick={onExecutar}
          disabled={carregando}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {carregando ? "Executando..." : "Executar preset"}
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ResumoDisponibilidadeEventos({
  materiasPrimas,
  produtosSimples,
  produtosCompostos,
}: {
  materiasPrimas: number
  produtosSimples: number
  produtosCompostos: number
}) {
  const cards = [
    {
      titulo: "Matérias-primas disponíveis",
      valor: materiasPrimas,
      descricao: "Prontas para virar produto simples no modo rápido.",
      icone: Leaf,
      classe: "bg-emerald-50 text-emerald-700",
    },
    {
      titulo: "Produtos simples disponíveis",
      valor: produtosSimples,
      descricao: "Podem ser usados direto na criação de compostos.",
      icone: Package,
      classe: "bg-amber-50 text-amber-700",
    },
    {
      titulo: "Produtos compostos disponíveis",
      valor: produtosCompostos,
      descricao: "Itens finais já montados e reutilizáveis na demonstração.",
      icone: PackagePlus,
      classe: "bg-blue-50 text-blue-700",
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => {
        const Icone = card.icone
        return (
          <div key={card.titulo} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{card.titulo}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{card.valor}</p>
              </div>
              <div className={cx("inline-flex h-11 w-11 items-center justify-center rounded-2xl", card.classe)}>
                <Icone className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">{card.descricao}</p>
          </div>
        )
      })}
    </div>
  )
}

export function QuickCreateResultCard({
  status,
  titulo,
  descricao,
  eventos,
  nomeNo,
  propagado,
  rotuloOperacao,
  insumosSelecionados,
  onRepetir,
  onMinerar,
  minerando = false,
  feedbackMineracao,
}: {
  status: "sucesso" | "erro"
  titulo: string
  descricao: string
  eventos: EventoBlockchain[]
  nomeNo: string
  propagado: boolean
  rotuloOperacao: string
  insumosSelecionados?: ItemInsumo[]
  onRepetir: () => void
  onMinerar: () => void
  minerando?: boolean
  feedbackMineracao?: string | null
}) {
  const sucesso = status === "sucesso"
  const eventoFinal = eventos.at(-1) ?? null

  return (
    <div
      className={cx(
        "rounded-[1.7rem] border p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]",
        sucesso ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cx(
              "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
              sucesso ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
            )}
          >
            {sucesso ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Última operação</p>
            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{titulo}</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">{descricao}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {rotuloOperacao}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {nomeNo}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
            {propagado ? "propagado na rede" : "somente no nó atual"}
          </span>
        </div>
      </div>

      {eventos.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Eventos enviados</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {eventos.map((evento) => (
              <div key={evento.event_id} className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeEvento tipo={evento.event_type} />
                  <BadgeEntidade tipo={evento.entity_kind} />
                </div>
                <p className="mt-3 text-lg font-semibold tracking-tight text-slate-900">{evento.product_name}</p>
                <div className="mt-2 space-y-1 text-sm text-slate-500">
                  <p><span className="font-semibold text-slate-700">product_id:</span> {evento.product_id}</p>
                  <p><span className="font-semibold text-slate-700">event_id:</span> {evento.event_id}</p>
                  <p><span className="font-semibold text-slate-700">inputs:</span> {evento.input_ids.length}</p>
                  <p><span className="font-semibold text-slate-700">timestamp:</span> {formatarData(evento.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {insumosSelecionados && insumosSelecionados.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Insumos usados</p>
          <div className="grid gap-3 lg:grid-cols-2">
            {insumosSelecionados.map((item) => (
              <ChipInsumo key={item.event_id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          to="/mempool"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-opacity hover:opacity-90"
        >
          Ver na mempool
        </Link>

        {eventoFinal ? (
          <Link
            to={`/rastreabilidade?identificador=${encodeURIComponent(eventoFinal.product_id)}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            Abrir rastreabilidade
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onMinerar}
          disabled={minerando}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pickaxe className="h-3.5 w-3.5" />
          {minerando ? "Minerando..." : "Minerar neste nó"}
        </button>

        <button
          type="button"
          onClick={onRepetir}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          Criar outro igual
        </button>
      </div>

      {feedbackMineracao ? (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm text-slate-600">
          {feedbackMineracao}
        </div>
      ) : null}
    </div>
  )
}
