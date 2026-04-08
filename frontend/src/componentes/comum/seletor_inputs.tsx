import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react"

import type { ItemInsumo } from "../../lib/api/tipos"
import { descricaoDisponibilidade } from "../../lib/util/insumos"
import { BadgeEntidade } from "./badge_entidade"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { cx } from "../../lib/util/classe"

type Props = {
  itens: ItemInsumo[]
  selecionados: string[]
  onChange: (proximos: string[]) => void
}

export function SeletorInputs({ itens, selecionados, onChange }: Props) {
  function alternar(eventId: string) {
    if (selecionados.includes(eventId)) {
      onChange(selecionados.filter((item) => item !== eventId))
      return
    }
    onChange([...selecionados, eventId])
  }

  const disponiveis = itens.filter((item) => item.status_consumo === "disponivel")
  const indisponiveis = itens.filter((item) => item.status_consumo !== "disponivel")

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
          Insumos válidos
        </p>
        <div className="mt-3 space-y-3">
          {disponiveis.length === 0 && (
            <p className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm text-slate-500">
              Nenhum insumo disponível para este tipo de evento.
            </p>
          )}
          {disponiveis.map((item) => {
            const ativo = selecionados.includes(item.event_id)
            return (
              <button
                key={item.event_id}
                type="button"
                onClick={() => alternar(item.event_id)}
                className={cx(
                  "w-full rounded-2xl border p-4 text-left transition-all",
                  ativo
                    ? "border-primary/20 bg-primary/5 shadow-[0_10px_24px_rgba(37,99,235,0.08)]"
                    : "border-slate-200/70 bg-white hover:border-slate-300 hover:bg-slate-50/70",
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeEntidade tipo={item.entity_kind} />
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800">
                        {descricaoDisponibilidade(item)}
                      </span>
                    </div>
                    <p className="mt-3 text-base font-semibold tracking-tight">{item.product_name}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-on-surface-variant">
                      <span>{item.product_id}</span>
                      <span className="font-mono">{encurtarHash(item.event_id)}</span>
                      <span>{item.no_origem ?? "origem não observada"}</span>
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant">{formatarData(item.timestamp)}</p>
                  </div>
                  <div className="mt-1">
                    {ativo ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <CircleDot className="h-5 w-5 text-on-surface-variant" />
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {indisponiveis.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
            Insumos indisponíveis
          </p>
          <div className="mt-3 space-y-3">
            {indisponiveis.map((item) => (
              <div key={item.event_id} className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <BadgeEntidade tipo={item.entity_kind} />
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-800">
                        {descricaoDisponibilidade(item)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{item.product_name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {item.product_id} • {encurtarHash(item.event_id)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
