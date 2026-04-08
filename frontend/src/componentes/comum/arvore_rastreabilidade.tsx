import { BadgeEntidade } from "./badge_entidade"
import { BadgeEvento } from "./badge_evento"
import { BadgeStatus } from "./badge_status"
import type { NoRastreabilidade } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

function NoItem({ no, nivel = 0 }: { no: NoRastreabilidade; nivel?: number }) {
  return (
    <div className="relative">
      {nivel > 0 && <div className="absolute left-4 top-0 h-full w-px bg-slate-200" />}
      <div className="relative ml-0 flex gap-4 pb-6" style={{ marginLeft: `${nivel * 28}px` }}>
        <div className="relative z-10 mt-5 h-3 w-3 rounded-full bg-primary ring-4 ring-primary-fixed" />
        <div className="flex-1 rounded-2xl border border-slate-200/70 bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeEvento tipo={no.evento.event_type} />
            <BadgeEntidade tipo={no.evento.entity_kind} />
            <BadgeStatus status={no.status} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Item rastreado
              </p>
              <p className="mt-1 text-lg font-semibold tracking-tight">{no.evento.product_name}</p>
              <p className="mt-1 text-sm text-slate-500">{no.evento.product_id}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Origem em bloco
              </p>
              <p className="mt-1 text-sm font-medium">
                bloco #{no.block_index ?? "-"} • {encurtarHash(no.block_hash)}
              </p>
              <p className="mt-1 text-sm text-slate-500">{formatarData(no.evento.timestamp)}</p>
            </div>
          </div>

          {no.evento.input_ids.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Insumos referenciados
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {no.evento.input_ids.map((inputId) => (
                  <span
                    key={inputId}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-500"
                  >
                    {inputId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {no.insumos.map((filho) => (
          <NoItem key={filho.evento.event_id} no={filho} nivel={nivel + 1} />
        ))}
      </div>
    </div>
  )
}

export function ArvoreRastreabilidade({ raiz }: { raiz: NoRastreabilidade }) {
  return (
    <div className="space-y-4">
      <NoItem no={raiz} />
    </div>
  )
}
