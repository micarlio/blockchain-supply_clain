import type { ReactNode } from "react"

import { cx } from "../../lib/util/classe"

type Props = {
  titulo?: string
  descricao?: string
  destaque?: ReactNode
  className?: string
  children: ReactNode
}

export function CartaoPainel({ titulo, descricao, destaque, className, children }: Props) {
  return (
    <section
      className={cx(
        "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
        className,
      )}
    >
      {(titulo || destaque) && (
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            {titulo && <h3 className="text-lg font-semibold tracking-tight">{titulo}</h3>}
            {descricao && <p className="mt-1 text-sm text-on-surface-variant">{descricao}</p>}
          </div>
          {destaque}
        </header>
      )}
      {children}
    </section>
  )
}
