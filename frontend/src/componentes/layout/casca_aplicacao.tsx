import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"

import { cx } from "../../lib/util/classe"
import { BarraLateral } from "./barra_lateral"
import { BarraSuperior } from "./barra_superior"

const CHAVE_BARRA_RECOLHIDA = "supply-chain-sidebar-recolhida"

export function CascaAplicacao() {
  const [barraRecolhida, setBarraRecolhida] = useState(() => {
    if (typeof window === "undefined") {
      return false
    }

    return window.localStorage.getItem(CHAVE_BARRA_RECOLHIDA) === "1"
  })

  useEffect(() => {
    window.localStorage.setItem(CHAVE_BARRA_RECOLHIDA, barraRecolhida ? "1" : "0")
  }, [barraRecolhida])

  return (
    <div className="app-shell min-h-screen text-on-surface">
      <BarraLateral
        recolhida={barraRecolhida}
        aoAlternar={() => setBarraRecolhida((estadoAtual) => !estadoAtual)}
      />
      <BarraSuperior recolhida={barraRecolhida} />
      <main
        className={cx(
          "min-h-screen px-8 pb-12 pt-20 transition-[margin] duration-300 ease-out",
          barraRecolhida ? "ml-24" : "ml-72",
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
