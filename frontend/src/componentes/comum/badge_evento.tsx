import { CORES_EVENTO, ROTULOS_EVENTO } from "../../lib/dominio/dominio"
import type { TipoEvento } from "../../lib/api/tipos"

export function BadgeEvento({ tipo }: { tipo: TipoEvento }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${CORES_EVENTO[tipo]}`}
    >
      {ROTULOS_EVENTO[tipo]}
    </span>
  )
}
