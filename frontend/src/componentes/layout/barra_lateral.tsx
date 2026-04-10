import {
  Activity,
  Blocks,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  GitBranch,
  Bug,
  Layers3,
  LayoutDashboard,
  Network,
  Pickaxe,
} from "lucide-react"
import { NavLink } from "react-router-dom"

import logoSupplyChain from "../../assets/logo.png"
import { cx } from "../../lib/util/classe"

const secoes = [
  {
    titulo: "Menu principal",
    itens: [
      { para: "/", rotulo: "Dashboard", icone: LayoutDashboard },
      { para: "/eventos", rotulo: "Eventos", icone: Activity },
    ],
  },
  {
    titulo: "Operação",
    itens: [
      { para: "/mempool", rotulo: "Mempool", icone: Layers3 },
      { para: "/mineracao", rotulo: "Mineração", icone: Pickaxe },
      { para: "/blockchain", rotulo: "Blockchain", icone: Blocks },
    ],
  },
  {
    titulo: "Análise",
    itens: [
      { para: "/rastreabilidade", rotulo: "Rastreabilidade", icone: GitBranch },
      { para: "/testes", rotulo: "Testes", icone: FlaskConical },
      { para: "/nos", rotulo: "Nós da rede", icone: Network },
    ],
  },
  {
    titulo: "Depuração",
    itens: [{ para: "/logs", rotulo: "Logs & Depuração", icone: Bug }],
  },
]

type Props = {
  recolhida?: boolean
  aoAlternar: () => void
}

export function BarraLateral({ recolhida = false, aoAlternar }: Props) {
  return (
    <aside
      className={cx(
        "sidebar-shell fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden transition-[width,padding] duration-300 ease-out",
        recolhida ? "w-24 px-3" : "w-72 px-6",
      )}
    >
      <div
        className={cx(
          "h-16 border-b border-slate-200/80",
          recolhida ? "-mx-3 mb-5 flex items-center justify-center px-3" : "-mx-6 mb-6 flex items-center px-6",
        )}
      >
        {recolhida ? (
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
            <img src={logoSupplyChain} alt="Supply Chain" className="h-full w-full object-cover object-left" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
              <img src={logoSupplyChain} alt="Supply Chain" className="h-full w-full object-cover object-left" />
            </div>
            <div>
              <h1 className="whitespace-nowrap text-[21px] font-black uppercase leading-none tracking-[0.03em] text-slate-900">
                <span className="text-primary">Supply</span> Chain
              </h1>
            </div>
          </div>
        )}
      </div>

      <nav className={cx("flex-1 overflow-y-auto pb-6", recolhida ? "space-y-4" : "space-y-7")}>
        {secoes.map((secao) => (
          <div key={secao.titulo}>
            {!recolhida ? (
              <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
                {secao.titulo}
              </p>
            ) : null}
            <div className={cx("space-y-1.5", recolhida ? "flex flex-col items-center" : "")}>
              {secao.itens.map((item) => {
                const Icone = item.icone
                return (
                  <NavLink
                    key={item.para}
                    to={item.para}
                    title={recolhida ? item.rotulo : undefined}
                    className={({ isActive }) =>
                      cx(
                        "group relative text-sm font-medium tracking-tight transition-all duration-200",
                        recolhida
                          ? "flex h-14 w-14 items-center justify-center rounded-[1.25rem]"
                          : "flex items-center gap-4 rounded-[1.6rem] px-5 py-4",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-slate-500 hover:bg-slate-100/90 hover:text-slate-800",
                      )
                    }
                    end={item.para === "/"}
                  >
                    {({ isActive }) => (
                      <>
                        {!recolhida ? (
                          <span
                            className={cx(
                              "absolute left-0 top-1/2 h-9 w-1 -translate-y-1/2 rounded-r-full transition-opacity",
                              isActive ? "bg-primary opacity-100" : "opacity-0",
                            )}
                          />
                        ) : null}
                        <Icone className="h-5 w-5 shrink-0" />
                        {!recolhida ? <span>{item.rotulo}</span> : null}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className={cx(
          "mt-auto border-t border-slate-200/80 pt-4",
          recolhida ? "flex justify-center pb-5" : "pb-5",
        )}
      >
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={recolhida ? "Expandir sidebar" : "Recolher sidebar"}
          title={recolhida ? "Expandir" : undefined}
          className={cx(
            "inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-800",
            recolhida ? "h-12 w-12 justify-center rounded-2xl hover:bg-slate-100" : "w-full gap-3 rounded-2xl px-3 py-3",
          )}
        >
          {recolhida ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          {!recolhida ? <span className="text-[15px]">Recolher</span> : null}
        </button>
      </div>
    </aside>
  )
}
