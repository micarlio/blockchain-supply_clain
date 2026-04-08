import type { BlocoBlockchain } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

type Props = {
  bloco: BlocoBlockchain
  destaque?: boolean
}

export function LinhaBlocoRecente({ bloco, destaque = false }: Props) {
  return (
    <div
      className={cx(
        "grid gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm md:grid-cols-[84px_minmax(0,1.3fr)_150px_140px]",
        destaque && "border-primary/20 bg-primary/5",
      )}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Índice</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-tight">#{bloco.index}</p>
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hash</p>
        <p className="mt-1 truncate font-mono text-sm text-primary">{encurtarHash(bloco.block_hash, 24)}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Previous</p>
        <p className="mt-1 truncate font-mono text-xs text-slate-500">
          {encurtarHash(bloco.previous_hash, 20)}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Minerador</p>
        <p className="mt-1 font-semibold text-slate-900">{bloco.miner_id ?? "gênesis"}</p>
        <p className="mt-2 text-xs text-slate-500">{bloco.event_count} eventos</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Timestamp</p>
        <p className="mt-1 text-sm text-slate-900">{formatarData(bloco.timestamp)}</p>
      </div>
    </div>
  )
}
