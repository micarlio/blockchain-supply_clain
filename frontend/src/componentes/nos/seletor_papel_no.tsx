import { Check, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { PapelNo } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"

type Props = {
  name: string
  valorInicial: PapelNo
  disabled?: boolean
  onChange?: (valor: PapelNo) => void
}

const OPCOES_PAPEL: PapelNo[] = ["minerador", "controle", "observador"]
const ROTULOS_PAPEL: Record<PapelNo, string> = {
  minerador: "Minerador",
  controle: "Controle",
  observador: "Observador",
}

export function SeletorPapelNo({ name, valorInicial, disabled = false, onChange }: Props) {
  const [aberto, setAberto] = useState(false)
  const [valorSelecionado, setValorSelecionado] = useState<PapelNo>(valorInicial)
  const referencia = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setValorSelecionado(valorInicial)
  }, [valorInicial])

  useEffect(() => {
    if (disabled) {
      setAberto(false)
    }
  }, [disabled])

  useEffect(() => {
    function aoPressionarFora(evento: PointerEvent) {
      const alvo = evento.target
      if (!(alvo instanceof Node)) {
        return
      }

      if (!referencia.current?.contains(alvo)) {
        setAberto(false)
      }
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false)
      }
    }

    window.addEventListener("pointerdown", aoPressionarFora)
    window.addEventListener("keydown", aoPressionarTecla)

    return () => {
      window.removeEventListener("pointerdown", aoPressionarFora)
      window.removeEventListener("keydown", aoPressionarTecla)
    }
  }, [])

  return (
    <div className="relative" ref={referencia}>
      <input type="hidden" name={name} value={valorSelecionado} readOnly />

      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((estadoAtual) => !estadoAtual)}
        disabled={disabled}
        className={cx(
          "group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)] outline-none transition-all focus-visible:border-primary/30 focus-visible:ring-4 focus-visible:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-70",
          aberto ? "border-primary/25 bg-primary/5" : "hover:border-slate-300 hover:bg-white",
        )}
      >
        <span className="truncate">{ROTULOS_PAPEL[valorSelecionado]}</span>
        <ChevronDown
          className={cx(
            "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
            aberto ? "rotate-180 text-primary" : "group-hover:text-primary",
          )}
        />
      </button>

      {aberto ? (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-full rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-xl backdrop-blur-sm">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Papel do nó</p>
          </div>

          <div className="space-y-0.5" role="listbox" aria-label="Papel do nó">
            {OPCOES_PAPEL.map((opcao) => {
              const selecionado = opcao === valorSelecionado

              return (
                <button
                  key={opcao}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => {
                    setValorSelecionado(opcao)
                    onChange?.(opcao)
                    setAberto(false)
                  }}
                  className={cx(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    selecionado
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <span className="font-semibold">{ROTULOS_PAPEL[opcao]}</span>
                  {selecionado ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
