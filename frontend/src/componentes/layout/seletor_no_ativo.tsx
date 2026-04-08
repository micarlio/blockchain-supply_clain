import { Check, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { cx } from "../../lib/util/classe"

type ItemSeletorNo = {
  id: string
  nome: string
  url: string
  online: boolean
}

type Props = {
  itens: ItemSeletorNo[]
  ativoId: string
  aoSelecionar: (id: string) => void
}

function formatarEndereco(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url.replace(/^https?:\/\//, "")
  }
}

export function SeletorNoAtivo({ itens, ativoId, aoSelecionar }: Props) {
  const [aberto, setAberto] = useState(false)
  const referencia = useRef<HTMLDivElement | null>(null)
  const itemAtivo = itens.find((item) => item.id === ativoId) ?? itens[0]

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

  if (!itemAtivo) {
    return null
  }

  return (
    <div className="relative" ref={referencia}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((estadoAtual) => !estadoAtual)}
        className={cx(
          "group flex items-center gap-4 rounded-lg px-2 py-1.5 text-left transition-all hover:bg-primary/5 active:scale-[0.98]",
          aberto ? "bg-primary/10" : ""
        )}
      >
        <div className="flex flex-col items-start">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400/80">
            Nó ativo
          </span>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cx("h-1.5 w-1.5 rounded-full", itemAtivo.online ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="text-[13px] font-bold text-slate-900">
              {itemAtivo.nome}
            </span>
          </div>
        </div>
        <ChevronDown 
          className={cx(
            "h-3.5 w-3.5 text-slate-400 transition-transform duration-200", 
            aberto ? "rotate-180 text-primary" : "group-hover:text-primary"
          )} 
        />
      </button>

      {aberto ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-xl backdrop-blur-sm">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Operação</p>
          </div>
          <div className="space-y-0.5" role="listbox" aria-label="Nó ativo">
            {itens.map((item) => {
              const selecionado = item.id === itemAtivo.id

              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={selecionado}
                  onClick={() => {
                    aoSelecionar(item.id)
                    setAberto(false)
                  }}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    selecionado
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", item.online ? "bg-emerald-500" : "bg-amber-500")} />

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{item.nome}</span>
                    <span className="block truncate text-[11px] opacity-60">
                      {formatarEndereco(item.url)}
                    </span>
                  </div>

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
