import type { BlocoBlockchain } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { BadgeEntidade } from "./badge_entidade"
import { BadgeEvento } from "./badge_evento"

export function DetalhesBloco({ bloco }: { bloco?: BlocoBlockchain }) {
  if (!bloco) {
    return (
      <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-8 text-sm text-slate-500">
        Selecione um bloco para ver o cabeçalho completo, eventos e hashes calculados.
      </div>
    )
  }

  return (
    <div className="space-y-6 rounded-[1.4rem] border border-slate-200/70 bg-slate-50/50 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Cabeçalho do bloco</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Índice</p>
            <p className="mt-2 text-lg font-semibold">#{bloco.index}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Minerador</p>
            <p className="mt-2 text-lg font-semibold">{bloco.miner_id ?? "gênesis"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Timestamp</p>
            <p className="mt-2 text-sm font-medium">{formatarData(bloco.timestamp)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Dificuldade / Nonce</p>
            <p className="mt-2 text-sm font-medium">
              {bloco.difficulty} • {bloco.nonce}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-xl bg-slate-950 p-4 text-slate-100">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">previous_hash</p>
          <p className="mt-2 break-all font-mono text-sm">{bloco.previous_hash}</p>
        </div>
        <div className="rounded-xl bg-slate-950 p-4 text-slate-100">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">data_hash</p>
          <p className="mt-2 break-all font-mono text-sm">{bloco.data_hash}</p>
        </div>
        <div className="rounded-xl bg-slate-950 p-4 text-slate-100">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">block_hash</p>
          <p className="mt-2 break-all font-mono text-sm">{bloco.block_hash}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Eventos do bloco
        </p>
        <div className="mt-4 space-y-4">
          {bloco.events.map((evento) => (
            <div key={evento.event_id} className="rounded-2xl border border-slate-200/70 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeEvento tipo={evento.event_type} />
                <BadgeEntidade tipo={evento.entity_kind} />
              </div>
              <p className="mt-3 text-base font-semibold tracking-tight">{evento.product_name}</p>
              <div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500">
                <span>{evento.product_id}</span>
                <span className="font-mono">{encurtarHash(evento.event_id, 18)}</span>
                <span>{evento.actor_id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
