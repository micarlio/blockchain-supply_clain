import { Eye, Pickaxe, SlidersHorizontal } from "lucide-react"

import { cx } from "../../lib/util/classe"
import { BadgeStatus } from "../comum/badge_status"

type Props = {
  nome: string
  id: string
  papel: string
  status: "online" | "offline"
  altura: number | string
  mempool: number | string
  dificuldade?: number | string
  forks?: number | string
  hashPonta: string
  ativo?: boolean
}

function obterVisualPapel(papel: string) {
  const chave = papel.toLowerCase()

  if (chave.includes("controle")) {
    return {
      Icone: SlidersHorizontal,
      fundoCor: "bg-amber-50",
      textoCor: "text-amber-600",
      bordaCor: "border-amber-200/60",
    }
  }

  if (chave.includes("observador")) {
    return {
      Icone: Eye,
      fundoCor: "bg-slate-50",
      textoCor: "text-slate-500",
      bordaCor: "border-slate-200/60",
    }
  }

  return {
    Icone: Pickaxe,
    fundoCor: "bg-primary/5",
    textoCor: "text-primary",
    bordaCor: "border-primary/20",
  }
}

export function CartaoNoCluster({
  nome,
  id,
  papel,
  status,
  altura,
  mempool,
  dificuldade = "-",
  forks = "-",
  hashPonta,
  ativo = false,
}: Props) {
  const visual = obterVisualPapel(papel)
  const IconePapel = visual.Icone

  return (
    <div
      className={cx(
        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-5 transition-colors",
        ativo && "border-primary/20 ring-4 ring-primary/10"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", visual.fundoCor, visual.bordaCor, visual.textoCor)}>
            <IconePapel className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-slate-900">{nome}</h3>
              {ativo && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Ativo
                </span>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-[9px] tracking-wider text-slate-400">
              <span className="uppercase">{papel}</span>
              <span className="text-slate-300">•</span>
              <span>{id}</span>
            </p>
          </div>
        </div>
        <BadgeStatus status={status} />
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2 rounded-lg bg-slate-50/80 p-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Altura</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900">{altura}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Mempool</p>
          <div className="mt-1 flex items-center gap-1.5">
            <p className="text-sm font-semibold tracking-tight text-slate-900">{mempool}</p>
            {Number(mempool) > 0 && <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400" />}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Dificuldade</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900">{dificuldade}</p>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Forks</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900">{forks}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Hash da ponta</p>
        <p className="mt-1 break-all font-mono text-[10px] font-medium tracking-tight text-slate-600">
          {hashPonta}
        </p>
      </div>
    </div>
  )
}
