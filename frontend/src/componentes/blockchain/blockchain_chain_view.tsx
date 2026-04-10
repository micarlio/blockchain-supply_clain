import { GitBranch, Link2 } from "lucide-react"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

type ForkVisual = {
  id: string
  indice: number
  indiceAncestral: number
  blocoAncestral: BlocoBlockchain
  blocosAtivos: BlocoBlockchain[]
  blocosFork: BlocoBlockchain[]
  blocosAtivosNoRamo: number
  blocosNoFork: number
  hashPonta: string
  hashPontaAtiva: string
  trabalhoAcumulado: number
  trabalhoAcumuladoAtivo: number
}

const NODE_ID_MALICIOSO = "node-evil"
const MARCADOR_BLOCO_MALICIOSO = "bloco mal."

function ramoTemBlocoMalicioso(blocos: BlocoBlockchain[]) {
  return blocos.some((bloco) => bloco.miner_id === NODE_ID_MALICIOSO)
}

function rotulosRamos(fork: ForkVisual) {
  const ativoMalicioso = ramoTemBlocoMalicioso(fork.blocosAtivos)
  const alternativoMalicioso = ramoTemBlocoMalicioso(fork.blocosFork)

  if (ativoMalicioso && !alternativoMalicioso) {
    return {
      ativo: "historia maliciosa vencedora",
      alternativo: "historia honesta sobreposta",
      ativoMalicioso: true,
      alternativoMalicioso: false,
    }
  }

  if (!ativoMalicioso && alternativoMalicioso) {
    return {
      ativo: "historia honesta vencedora",
      alternativo: "historia maliciosa sobreposta",
      ativoMalicioso: false,
      alternativoMalicioso: true,
    }
  }

  return {
    ativo: "ramo ativo / vencedor",
    alternativo: "ramo alternativo / sobreposto",
    ativoMalicioso,
    alternativoMalicioso,
  }
}

function CardBloco({
  bloco,
  hashSelecionado,
  onSelecionar,
  classeTom,
  marcadorFork,
  marcadorMalicioso,
}: {
  bloco: BlocoBlockchain
  hashSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
  classeTom: string
  marcadorFork?: string
  marcadorMalicioso?: string
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
          {marcadorMalicioso && (
            <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-red-800">
              {marcadorMalicioso}
            </span>
          )}
          {marcadorFork && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">
              {marcadorFork}
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

function TrilhaRamo({
  titulo,
  subtitulo,
  badgeClasse,
  pontaHash,
  blocos,
  hashSelecionado,
  onSelecionar,
  classeBloco,
  classeConector,
  marcadorPonta,
  malicioso,
}: {
  titulo: string
  subtitulo: string
  badgeClasse: string
  pontaHash: string
  blocos: BlocoBlockchain[]
  hashSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
  classeBloco: string
  classeConector: string
  marcadorPonta: string
  malicioso: boolean
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/85 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={badgeClasse}>{titulo}</span>
            {malicioso && (
              <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-red-800">
                blocos maliciosos em destaque
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">{subtitulo}</p>
        </div>

        <div className="text-right text-xs text-slate-500">
          <p className="font-semibold uppercase tracking-[0.14em] text-slate-400">Ponta</p>
          <p className="mt-1 font-mono text-[11px] text-slate-700">{encurtarHash(pontaHash, 20)}</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-4 pr-2">
          {blocos.map((bloco, indice) => (
            <div key={bloco.block_hash} className="relative">
              {indice > 0 && <ConectorHorizontal classeTom={classeConector} />}
              <CardBloco
                bloco={bloco}
                hashSelecionado={hashSelecionado}
                onSelecionar={onSelecionar}
                classeTom={classeBloco}
                marcadorFork={indice === blocos.length - 1 ? marcadorPonta : undefined}
                marcadorMalicioso={
                  bloco.miner_id === NODE_ID_MALICIOSO ? MARCADOR_BLOCO_MALICIOSO : undefined
                }
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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

  const hashesRamoAtivoMalicioso = new Set(
    forks
      .filter((fork) => rotulosRamos(fork).ativoMalicioso)
      .flatMap((fork) => fork.blocosAtivos.map((bloco) => bloco.block_hash)),
  )

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
                    classeTom=""
                    marcadorFork={
                      totalForks ? `${totalForks} fork${totalForks > 1 ? "s" : ""}` : undefined
                    }
                    marcadorMalicioso={
                      hashesRamoAtivoMalicioso.has(bloco.block_hash)
                        ? MARCADOR_BLOCO_MALICIOSO
                        : undefined
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
                comparacao de ramos
              </span>
              <span>{forks.length} ramificacoes alinhadas pelo ancestral comum</span>
            </div>

            <p className="text-sm text-slate-700">
              A cadeia ativa acima mostra apenas o ramo vencedor. A comparação abaixo explicita, no
              próprio encadeamento, qual história ficou ativa e qual ramo alternativo ficou para trás.
            </p>

            {forks.map((fork) => (
              <div key={fork.id} className="space-y-2">
                {(() => {
                  const rotulos = rotulosRamos(fork)

                  return (
                    <>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                    <GitBranch className="h-4 w-4 text-amber-700" />
                    <span>Fork {fork.indice}</span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {fork.blocosAtivosNoRamo} blocos no ramo vencedor
                    </span>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {fork.blocosNoFork} blocos no ramo sobreposto
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>ancora em #{fork.blocoAncestral.index}</span>
                    <span>ativo {fork.trabalhoAcumuladoAtivo}</span>
                    <span>alternativo {fork.trabalhoAcumulado}</span>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="rounded-2xl border border-dashed border-amber-300 bg-white/80 p-5 text-center">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800">
                      ponto de bifurcacao
                    </p>
                    <p className="mt-3 text-base font-semibold text-slate-900">
                      Bloco #{fork.blocoAncestral.index}
                    </p>
                    <p className="mt-2 font-mono text-xs text-slate-500">
                      {encurtarHash(fork.blocoAncestral.block_hash, 22)}
                    </p>
                    <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
                      Ultimo bloco comum antes da troca de historia da cadeia.
                    </div>
                  </div>

                  <div className="space-y-4">
                    <TrilhaRamo
                      titulo={rotulos.ativo}
                      subtitulo="Blocos que permaneceram na cadeia ativa depois da disputa de consenso."
                      badgeClasse={
                        rotulos.ativoMalicioso
                          ? "rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-red-800"
                          : "rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800"
                      }
                      pontaHash={fork.hashPontaAtiva}
                      blocos={fork.blocosAtivos}
                      hashSelecionado={hashSelecionado}
                      onSelecionar={onSelecionar}
                      classeBloco={
                        rotulos.ativoMalicioso
                          ? "border-red-200/80 bg-red-50/70"
                          : "border-emerald-200/80 bg-emerald-50/70"
                      }
                      classeConector={rotulos.ativoMalicioso ? "bg-red-300" : "bg-emerald-300"}
                      marcadorPonta="ponta ativa"
                      malicioso={rotulos.ativoMalicioso}
                    />

                    <TrilhaRamo
                      titulo={rotulos.alternativo}
                      subtitulo="Blocos que perderam a disputa e ficaram fora da cadeia ativa." 
                      badgeClasse={
                        rotulos.alternativoMalicioso
                          ? "rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-red-800"
                          : "rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-amber-800"
                      }
                      pontaHash={fork.hashPonta}
                      blocos={fork.blocosFork}
                      hashSelecionado={hashSelecionado}
                      onSelecionar={onSelecionar}
                      classeBloco={
                        rotulos.alternativoMalicioso
                          ? "border-red-200/80 bg-red-50/60"
                          : "border-amber-200/80 bg-amber-50/60"
                      }
                      classeConector={rotulos.alternativoMalicioso ? "bg-red-300" : "bg-amber-300"}
                      marcadorPonta="ponta sobreposta"
                      malicioso={rotulos.alternativoMalicioso}
                    />
                  </div>
                </div>
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
