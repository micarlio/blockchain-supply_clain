import { CORES_ENTIDADE, ROTULOS_ENTIDADE } from "../../lib/dominio/dominio"
import type { TipoEntidade } from "../../lib/api/tipos"

export function BadgeEntidade({ tipo }: { tipo: TipoEntidade }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${CORES_ENTIDADE[tipo]}`}
    >
      {ROTULOS_ENTIDADE[tipo]}
    </span>
  )
}
