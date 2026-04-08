import { X } from "lucide-react"
import { useEffect } from "react"
import { createPortal } from "react-dom"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { avaliarIntegridadeBloco, textoResumoSemantico } from "../../lib/util/blockchain"
import { formatarData } from "../../lib/util/formatacao"
import { BlockEventList } from "./block_event_list"
import { BlockSemanticSummary } from "./block_semantic_summary"

function ItemEstado({
  rotulo,
  valor,
}: {
  rotulo: string
  valor: boolean | null
}) {
  const texto = valor === null ? "nao aplicavel" : valor ? "ok" : "atencao"
  const classeCor =
    valor === null
      ? "bg-slate-200"
      : valor
        ? "bg-emerald-500"
        : "bg-rose-500"

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
      <span className="font-medium text-slate-700">{rotulo}</span>
      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        <span className={`h-2.5 w-2.5 rounded-full ${classeCor}`} />
        {texto}
      </span>
    </div>
  )
}

function CampoComparacao({
  rotulo,
  valorFixado,
  valorAtual,
}: {
  rotulo: string
  valorFixado: string | number
  valorAtual: string | number
}) {
  const diferente = String(valorFixado) !== String(valorAtual)

  return (
    <div
      className={`grid grid-cols-3 gap-3 rounded-lg border px-3 py-2 text-sm ${
        diferente ? "border-amber-200 bg-amber-50/60" : "border-slate-200/80 bg-white"
      }`}
    >
      <p className="font-semibold text-slate-700">{rotulo}</p>
      <p className="font-medium text-slate-600">{String(valorFixado)}</p>
      <p className="font-medium text-slate-900">{String(valorAtual)}</p>
    </div>
  )
}

export function BlockDetailsDrawer({
  aberto,
  bloco,
  blocoFixado,
  blocosConhecidos,
  onFixarBloco,
  onDesfixarBloco,
  onFechar,
}: {
  aberto: boolean
  bloco?: BlocoBlockchain
  blocoFixado?: BlocoBlockchain
  blocosConhecidos: BlocoBlockchain[]
  onFixarBloco: () => void
  onDesfixarBloco: () => void
  onFechar: () => void
}) {
  useEffect(() => {
    if (!aberto) {
      return
    }

    function aoPressionarTecla(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onFechar()
      }
    }

    window.addEventListener("keydown", aoPressionarTecla)
    return () => window.removeEventListener("keydown", aoPressionarTecla)
  }, [aberto, onFechar])

  if (!aberto || !bloco) {
    return null
  }

  const integridade = avaliarIntegridadeBloco(bloco, blocosConhecidos)
  const blocoFixadoIgualSelecionado = blocoFixado?.block_hash === bloco.block_hash

  if (typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/30" onClick={onFechar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhes-bloco-titulo"
        className="h-full w-full max-w-3xl overflow-hidden border-l border-slate-200/80 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Detalhe do bloco</p>
            <h2 id="detalhes-bloco-titulo" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Bloco #{bloco.index}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{formatarData(bloco.timestamp)}</p>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar detalhes do bloco"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-[calc(100vh-89px)] space-y-6 overflow-y-auto p-5">
          <section className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Comparacao rapida
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Fixe um bloco e depois selecione outro para comparar no mesmo drawer.
                </p>
              </div>

              {blocoFixado ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                    fixado #{blocoFixado.index}
                  </span>
                  <button
                    type="button"
                    onClick={onDesfixarBloco}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    Desfixar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onFixarBloco}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Fixar bloco atual
                </button>
              )}
            </div>

            {blocoFixado && blocoFixadoIgualSelecionado && (
              <p className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                Bloco fixado #{blocoFixado.index}. Selecione outro bloco para iniciar a comparacao.
              </p>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Header do bloco</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Indice</p>
                <p className="mt-1 text-base font-semibold text-slate-900">#{bloco.index}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Minerador</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{bloco.miner_id ?? "genesis"}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Nonce</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{bloco.nonce}</p>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Dificuldade</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{bloco.difficulty}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl bg-slate-950 p-3 text-slate-100">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">block_hash</p>
                <p className="mt-1 break-all font-mono text-xs">{bloco.block_hash}</p>
              </div>
              <div className="rounded-xl bg-slate-950 p-3 text-slate-100">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">previous_hash</p>
                <p className="mt-1 break-all font-mono text-xs">{bloco.previous_hash}</p>
              </div>
              <div className="rounded-xl bg-slate-950 p-3 text-slate-100">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">data_hash</p>
                <p className="mt-1 break-all font-mono text-xs">{bloco.data_hash}</p>
              </div>
            </div>

            <BlockSemanticSummary bloco={bloco} />
          </section>

          {blocoFixado && !blocoFixadoIgualSelecionado && (
            <section className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Comparacao lado a lado
              </p>

              <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                <p>Campo</p>
                <p>Fixado #{blocoFixado.index}</p>
                <p>Atual #{bloco.index}</p>
              </div>

              <CampoComparacao
                rotulo="Minerador"
                valorFixado={blocoFixado.miner_id ?? "genesis"}
                valorAtual={bloco.miner_id ?? "genesis"}
              />
              <CampoComparacao
                rotulo="Timestamp"
                valorFixado={formatarData(blocoFixado.timestamp)}
                valorAtual={formatarData(bloco.timestamp)}
              />
              <CampoComparacao
                rotulo="Dificuldade"
                valorFixado={blocoFixado.difficulty}
                valorAtual={bloco.difficulty}
              />
              <CampoComparacao rotulo="Nonce" valorFixado={blocoFixado.nonce} valorAtual={bloco.nonce} />
              <CampoComparacao
                rotulo="Eventos"
                valorFixado={blocoFixado.event_count}
                valorAtual={bloco.event_count}
              />
              <CampoComparacao
                rotulo="Hash"
                valorFixado={blocoFixado.block_hash}
                valorAtual={bloco.block_hash}
              />
              <CampoComparacao
                rotulo="Previous hash"
                valorFixado={blocoFixado.previous_hash}
                valorAtual={bloco.previous_hash}
              />
              <CampoComparacao
                rotulo="Resumo semantico"
                valorFixado={textoResumoSemantico(blocoFixado)}
                valorAtual={textoResumoSemantico(bloco)}
              />
            </section>
          )}

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Integridade e prova de trabalho
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <ItemEstado rotulo="Hash presente" valor={integridade.hashPresente} />
              <ItemEstado rotulo="Previous hash presente" valor={integridade.previousHashPresente} />
              <ItemEstado rotulo="Nonce presente" valor={integridade.noncePresente} />
              <ItemEstado rotulo="Dificuldade presente" valor={integridade.dificuldadePresente} />
              <ItemEstado rotulo="Data hash presente" valor={integridade.dataHashPresente} />
              <ItemEstado rotulo="Timestamp valido" valor={integridade.timestampValido} />
              <ItemEstado rotulo="Numero de eventos consistente" valor={integridade.contagemEventosValida} />
              <ItemEstado rotulo="Encadeamento consistente" valor={integridade.encadeamentoConsistente} />
              <ItemEstado rotulo="Dados do bloco presentes" valor={integridade.dadosBlocoPresentes} />
              <ItemEstado rotulo="Estrutura valida" valor={integridade.estruturaValida} />
              <ItemEstado rotulo="Hash atende dificuldade" valor={integridade.hashAtendeDificuldade} />
              <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">Total de eventos no bloco</span>
                <span className="font-semibold text-slate-900">{bloco.event_count}</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Eventos do bloco</p>
            <BlockEventList eventos={bloco.events} />
          </section>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
