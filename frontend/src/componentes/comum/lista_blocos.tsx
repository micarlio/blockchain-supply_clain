import { Link2 } from "lucide-react"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

export function ListaBlocos({
  blocos,
  blocoSelecionado,
  onSelecionar,
}: {
  blocos: BlocoBlockchain[]
  blocoSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
}) {
  return (
    <div className="space-y-4">
      {blocos.map((bloco) => {
        const ativo = bloco.block_hash === blocoSelecionado
        return (
          <button
            key={bloco.block_hash}
            type="button"
            onClick={() => onSelecionar(bloco)}
            className={`w-full rounded-2xl border border-slate-200/70 p-5 text-left transition-colors ${
              ativo
                ? "border-primary/30 bg-primary/5"
                : "bg-white hover:border-primary/30 hover:bg-slate-50/70"
            }`}
          >
            <div className="grid gap-4 md:grid-cols-[120px_1fr_140px_120px]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Índice
                </p>
                <p className="mt-1 font-mono text-lg font-semibold">#{bloco.index}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Hash do bloco
                </p>
                <p className="mt-1 font-mono text-sm text-primary">{encurtarHash(bloco.block_hash, 20)}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <Link2 className="h-3.5 w-3.5" />
                  <span>prev {encurtarHash(bloco.previous_hash, 16)}</span>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Minerador
                </p>
                <p className="mt-1 text-sm font-semibold">{bloco.miner_id ?? "gênesis"}</p>
                <p className="mt-2 text-xs text-slate-500">{formatarData(bloco.timestamp)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Eventos
                </p>
                <p className="mt-1 text-sm font-semibold">{bloco.event_count}</p>
                <p className="mt-2 text-xs text-slate-500">nonce {bloco.nonce}</p>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
