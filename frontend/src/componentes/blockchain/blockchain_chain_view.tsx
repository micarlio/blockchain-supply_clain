import { GitBranch, Link2 } from "lucide-react"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

type ForkVisual = {
  id: string
  indice: number
  indiceAncestral: number
  blocoAncestral: BlocoBlockchain
  blocosFork: BlocoBlockchain[]
  blocosNoFork: number
  hashPonta: string
  trabalhoAcumulado: number
}

function CardBloco({
  bloco,
  hashSelecionado,
  onSelecionar,
  maisRecente,
  classeTom,
  marcadorFork,
}: {
  bloco: BlocoBlockchain
  hashSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
  maisRecente?: boolean
  classeTom: string
  marcadorFork?: string
}) {
  const selecionado = bloco.block_hash === hashSelecionado

  return (
    <button
      type="button"
      onClick={() => onSelecionar(bloco)}
      className={`relative w-[246px] rounded-2xl border p-4 text-left transition-colors ${classeTom} ${
        selecionado
          ? "border-primary/40 bg-primary/10"
          : "border-slate-200/80 bg-slate-50/70 hover:bg-white"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">Bloco #{bloco.index}</p>
        <div className="flex items-center gap-2">
          {marcadorFork && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
              {marcadorFork}
            </span>
          )}
          {maisRecente && (
            <span className="rounded-full bg-primary/15 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
              mais recente
            </span>
          )}
        </div>
      </div>

      <p className="mt-2 font-mono text-sm font-semibold text-primary">{encurtarHash(bloco.block_hash, 24)}</p>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <Link2 className="h-3.5 w-3.5" />
        <span>prev {encurtarHash(bloco.previous_hash, 20)}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="uppercase tracking-[0.12em] text-slate-400">Minerador</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{bloco.miner_id ?? "genesis"}</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.12em] text-slate-400">Eventos</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{bloco.event_count}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">{formatarData(bloco.timestamp)}</p>
    </button>
  )
}

function ConectorHorizontal({ classeTom }: { classeTom: string }) {
  return <div className={`absolute -left-4 top-1/2 h-0.5 w-4 -translate-y-1/2 ${classeTom}`} aria-hidden="true" />
}

export function BlockchainChainView({
  blocos,
  forks = [],
  hashSelecionado,
  onSelecionar,
}: {
  blocos: BlocoBlockchain[]
  forks?: ForkVisual[]
  hashSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
}) {
  const totalColunas = Math.max(
    blocos.length,
    ...forks.map((fork) => fork.indiceAncestral + 1 + fork.blocosFork.length),
  )
  const estiloGrade = { gridTemplateColumns: `repeat(${totalColunas}, 246px)` }
  const forksPorAncestral = new Map<number, number>()

  for (const fork of forks) {
    const totalAtual = forksPorAncestral.get(fork.indiceAncestral) ?? 0
    forksPorAncestral.set(fork.indiceAncestral, totalAtual + 1)
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="min-w-max space-y-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">cadeia ativa</span>
            <span>{blocos.length} blocos visiveis</span>
          </div>
          <div className="grid gap-4" style={estiloGrade}>
            {blocos.map((bloco, indice) => {
              const totalForks = forksPorAncestral.get(indice)

              return (
                <div key={bloco.block_hash} style={{ gridColumnStart: indice + 1 }} className="relative">
                  {indice > 0 && <ConectorHorizontal classeTom="bg-slate-300" />}
                  <CardBloco
                    bloco={bloco}
                    hashSelecionado={hashSelecionado}
                    onSelecionar={onSelecionar}
                    maisRecente={indice === blocos.length - 1}
                    classeTom=""
                    marcadorFork={
                      totalForks ? `${totalForks} fork${totalForks > 1 ? "s" : ""}` : undefined
                    }
                  />
                </div>
              )
            })}
          </div>
        </div>

        {forks.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-900">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1">
                <GitBranch className="h-3.5 w-3.5" />
                forks conhecidos
              </span>
              <span>{forks.length} ramificacoes alinhadas pelo ancestral comum</span>
            </div>

            {forks.map((fork) => (
              <div key={fork.id} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <GitBranch className="h-4 w-4 text-amber-700" />
                    <span>Fork {fork.indice}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {fork.blocosNoFork} blocos no ramo
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>ancora em #{fork.blocoAncestral.index}</span>
                    <span>trabalho {fork.trabalhoAcumulado}</span>
                    <span>ponta {encurtarHash(fork.hashPonta, 18)}</span>
                  </div>
                </div>

                <div className="grid gap-4" style={estiloGrade}>
                  <div
                    style={{ gridColumnStart: fork.indiceAncestral + 1 }}
                    className="relative flex min-h-[176px] w-[246px] items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-white/80 p-4 text-center"
                  >
                    <div className="absolute -top-8 left-1/2 h-8 w-0.5 -translate-x-1/2 bg-amber-300" aria-hidden="true" />
                    <div className="absolute -top-8 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-300" aria-hidden="true" />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">ponto de bifurcacao</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Bloco #{fork.blocoAncestral.index}</p>
                      <p className="mt-1 font-mono text-xs text-slate-500">
                        {encurtarHash(fork.blocoAncestral.block_hash, 22)}
                      </p>
                    </div>
                  </div>

                  {fork.blocosFork.map((bloco, indiceBloco) => (
                    <div
                      key={bloco.block_hash}
                      style={{ gridColumnStart: fork.indiceAncestral + indiceBloco + 2 }}
                      className="relative"
                    >
                      <ConectorHorizontal classeTom="bg-amber-300" />
                      <CardBloco
                        bloco={bloco}
                        hashSelecionado={hashSelecionado}
                        onSelecionar={onSelecionar}
                        classeTom="border-amber-200/80 bg-amber-50/60"
                        marcadorFork={indiceBloco === fork.blocosFork.length - 1 ? "ponta do fork" : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
