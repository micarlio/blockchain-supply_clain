import type { BlocoBlockchain } from "../../lib/api/tipos"
import { gerarResumoSemantico, textoResumoSemantico } from "../../lib/util/blockchain"

export function BlockSemanticSummary({ bloco }: { bloco: BlocoBlockchain }) {
  const itensResumo = gerarResumoSemantico(bloco)

  return (
    <section className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Resumo de negocio</p>
      <p className="mt-2 text-sm font-medium text-slate-700">{textoResumoSemantico(bloco)}</p>

      {itensResumo.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {itensResumo.map((item) => (
            <span
              key={item.tipo}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
            >
              {item.quantidade}x {item.tipo}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}
