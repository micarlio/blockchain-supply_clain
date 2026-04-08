import type { ReactNode } from "react"

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200/70 bg-slate-50/70 p-8 text-center md:p-10">
      <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{titulo}</h3>
      <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-500">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}
