import { Boxes, ChevronDown, ChevronRight, FoldVertical, Leaf, Package, UnfoldVertical } from "lucide-react"
import { useMemo, useState } from "react"

import type { ItemInsumo, NoRastreabilidade, TipoEntidade } from "../../lib/api/tipos"
import { ROTULOS_ENTIDADE } from "../../lib/dominio/dominio"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { calcularMetricasRastreabilidade } from "../../lib/util/rastreabilidade"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeEvento } from "../comum/badge_evento"
import { BadgeStatus } from "../comum/badge_status"

function iconePorTipo(tipo: TipoEntidade) {
  if (tipo === "raw_material") {
    return <Leaf className="h-full w-full" />
  }
  if (tipo === "simple_product") {
    return <Package className="h-full w-full" />
  }
  return <Boxes className="h-full w-full" />
}

function classesTipo(tipo: TipoEntidade) {
  if (tipo === "raw_material") {
    return {
      destaque: "bg-sky-100 text-sky-700",
      borda: "border-sky-200",
      fundo: "from-sky-50 to-white",
      ponto: "bg-sky-500",
    }
  }
  if (tipo === "simple_product") {
    return {
      destaque: "bg-indigo-100 text-indigo-700",
      borda: "border-indigo-200",
      fundo: "from-indigo-50 to-white",
      ponto: "bg-indigo-500",
    }
  }
  return {
    destaque: "bg-slate-900 text-white",
    borda: "border-slate-300",
    fundo: "from-slate-100 to-white",
    ponto: "bg-slate-700",
  }
}

function TreeNode({
  no,
  itemPorEvento,
  eventIdSelecionado,
  caminhoSelecionado,
  colapsado,
  onAlternarColapso,
  onSelecionar,
  raiz = false,
}: {
  no: NoRastreabilidade
  itemPorEvento: Map<string, ItemInsumo>
  eventIdSelecionado: string | null
  caminhoSelecionado: Set<string>
  colapsado: Set<string>
  onAlternarColapso: (eventId: string) => void
  onSelecionar: (no: NoRastreabilidade) => void
  raiz?: boolean
}) {
  const itemCatalogo = itemPorEvento.get(no.evento.event_id) ?? null
  const selecionado = eventIdSelecionado === no.evento.event_id
  const noCaminhoSelecionado = caminhoSelecionado.has(no.evento.event_id)
  const possuiFilhos = no.insumos.length > 0
  const estaColapsado = colapsado.has(no.evento.event_id)
  const metricasSubarvore = useMemo(() => calcularMetricasRastreabilidade(no), [no])
  const classes = classesTipo(no.evento.entity_kind)

  return (
    <li className={cx("relative", !raiz && "pl-8")}>
      {!raiz ? (
        <span className={cx("absolute left-3 top-0 h-full w-px bg-slate-200", noCaminhoSelecionado && "bg-primary/35")} />
      ) : null}
      {!raiz ? (
        <span className={cx("absolute left-3 top-8 h-px w-4 bg-slate-200", noCaminhoSelecionado && "bg-primary/35")} />
      ) : null}

      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelecionar(no)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onSelecionar(no)
          }
        }}
        className={cx(
          "group relative w-full rounded-[1.5rem] border bg-gradient-to-br px-4 py-4 text-left transition-colors",
          classes.borda,
          classes.fundo,
          "cursor-pointer focus:outline-none focus:ring-4 focus:ring-primary/10",
          selecionado && "border-primary ring-4 ring-primary/10",
        )}
      >
        {!raiz ? (
          <span
            className={cx(
              "absolute -left-[21px] top-7 h-3 w-3 rounded-full ring-4 ring-white",
              classes.ponto,
              noCaminhoSelecionado && "scale-110",
            )}
          />
        ) : null}



        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className={cx("inline-flex h-9 w-9 items-center justify-center rounded-xl", classes.destaque)}>
                <div className="h-4 w-4">{iconePorTipo(no.evento.entity_kind)}</div>
              </div>
              <BadgeEvento tipo={no.evento.event_type} />
              <BadgeEntidade tipo={no.evento.entity_kind} />
              <BadgeStatus status={no.status} />
              {itemCatalogo ? <BadgeStatus status={itemCatalogo.status_consumo} /> : null}
            </div>

            <h3 className="mt-3 text-base font-semibold tracking-tight text-slate-900">{no.evento.product_name}</h3>
            <p className="mt-1 break-all text-sm text-slate-500">{no.evento.product_id}</p>
          </div>

          <div className="flex items-center gap-2">
            {possuiFilhos ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onAlternarColapso(no.evento.event_id)
                }}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:border-primary/30 hover:text-primary"
                aria-label={estaColapsado ? "Expandir ramo" : "Recolher ramo"}
              >
                {estaColapsado ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {estaColapsado ? "expandir" : "recolher"}
              </button>
            ) : null}

            <div className="rounded-full border border-slate-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
              {no.insumos.length} insumo{no.insumos.length === 1 ? "" : "s"}
            </div>

            {noCaminhoSelecionado && !selecionado ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                caminho ativo
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 xl:grid-cols-3">
          <span className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
            event_id <span className="font-semibold text-slate-700">{no.evento.event_id}</span>
          </span>
          <span className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
            origem <span className="font-semibold text-slate-700">{no.block_index !== null ? `bloco #${no.block_index}` : "mempool"}</span>
          </span>
          <span className="rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2">
            data <span className="font-semibold text-slate-700">{formatarData(no.evento.timestamp)}</span>
          </span>
        </div>

        {no.block_hash ? (
          <p className="mt-3 text-xs text-slate-500">hash {encurtarHash(no.block_hash)}</p>
        ) : null}
      </div>

      {possuiFilhos && !estaColapsado ? (
        <ul className="mt-4 space-y-4">
          {no.insumos.map((filho) => (
            <TreeNode
              key={filho.evento.event_id}
              no={filho}
              itemPorEvento={itemPorEvento}
              eventIdSelecionado={eventIdSelecionado}
              caminhoSelecionado={caminhoSelecionado}
              colapsado={colapsado}
              onAlternarColapso={onAlternarColapso}
              onSelecionar={onSelecionar}
            />
          ))}
        </ul>
      ) : possuiFilhos ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3">
          <p className="text-xs font-semibold text-slate-700">Ramo recolhido</p>
          <p className="mt-1 text-xs text-slate-500">
            Expanda para visualizar {no.insumos.length} dependência{no.insumos.length === 1 ? "" : "s"} direta{no.insumos.length === 1 ? "" : "s"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              {metricasSubarvore.totalDependencias} dependências totais
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              {metricasSubarvore.materiasPrimas} matérias-primas
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600">
              profundidade {metricasSubarvore.profundidade}
            </span>
            {metricasSubarvore.pendentes > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700">
                {metricasSubarvore.pendentes} pendente{metricasSubarvore.pendentes === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  )
}

function LegendaTipo({ tipo }: { tipo: TipoEntidade }) {
  const classes = classesTipo(tipo)

  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span className={cx("inline-flex h-7 w-7 items-center justify-center rounded-lg", classes.destaque)}>
        <div className="h-3.5 w-3.5">{iconePorTipo(tipo)}</div>
      </span>
      <span className="font-semibold text-slate-800">{ROTULOS_ENTIDADE[tipo]}</span>
    </div>
  )
}

export function TraceabilityTree({
  raiz,
  itemPorEvento,
  eventIdSelecionado,
  caminhoSelecionado,
  onSelecionarNo,
}: {
  raiz: NoRastreabilidade
  itemPorEvento: Map<string, ItemInsumo>
  eventIdSelecionado: string | null
  caminhoSelecionado: Set<string>
  onSelecionarNo: (no: NoRastreabilidade) => void
}) {
  const [colapsado, setColapsado] = useState<Set<string>>(new Set())

  const nosComFilhos = useMemo(() => {
    const resultado: string[] = []

    function percorrer(no: NoRastreabilidade) {
      if (no.insumos.length > 0) {
        resultado.push(no.evento.event_id)
      }
      for (const filho of no.insumos) {
        percorrer(filho)
      }
    }

    percorrer(raiz)
    return resultado
  }, [raiz])

  const colapsadoEfetivo = colapsado

  function alternarColapso(eventId: string) {
    setColapsado((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(eventId)) {
        proximo.delete(eventId)
      } else {
        proximo.add(eventId)
      }
      return proximo
    })
  }

  function expandirTudo() {
    setColapsado(new Set())
  }

  function recolherInternos() {
    setColapsado(new Set(nosComFilhos))
  }

  function renderizarNo(no: NoRastreabilidade, isRaiz = false) {
    return (
      <TreeNode
        key={no.evento.event_id}
        no={no}
        itemPorEvento={itemPorEvento}
        eventIdSelecionado={eventIdSelecionado}
        caminhoSelecionado={caminhoSelecionado}
        colapsado={colapsadoEfetivo}
        onAlternarColapso={alternarColapso}
        onSelecionar={onSelecionarNo}
        raiz={isRaiz}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-3">
        <p className="mr-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Legenda visual</p>
        <LegendaTipo tipo="raw_material" />
        <LegendaTipo tipo="simple_product" />
        <LegendaTipo tipo="composite_product" />
        <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
          Caminho selecionado destacado
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expandirTudo}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={recolherInternos}
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
          >
            <FoldVertical className="h-3.5 w-3.5" />
            Recolher ramos
          </button>
        </div>
      </div>

      <ul className="space-y-4">{renderizarNo(raiz, true)}</ul>
    </div>
  )
}
