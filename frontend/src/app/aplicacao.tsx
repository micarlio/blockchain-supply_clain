import { lazy, Suspense, type ComponentType } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CascaAplicacao } from "../componentes/layout/casca_aplicacao"

const DashboardPagina = lazy(async () => ({ default: (await import("../paginas/dashboard_pagina")).DashboardPagina }))
const EventosPagina = lazy(async () => ({ default: (await import("../paginas/eventos_pagina")).EventosPagina }))
const MempoolPagina = lazy(async () => ({ default: (await import("../paginas/mempool_pagina")).MempoolPagina }))
const MineracaoPagina = lazy(async () => ({ default: (await import("../paginas/mineracao_pagina")).MineracaoPagina }))
const BlockchainPagina = lazy(async () => ({ default: (await import("../paginas/blockchain_pagina")).BlockchainPagina }))
const RastreabilidadePagina = lazy(async () => ({ default: (await import("../paginas/rastreabilidade_pagina")).RastreabilidadePagina }))
const TestesPagina = lazy(async () => ({ default: (await import("../paginas/testes_pagina")).TestesPagina }))
const NosPagina = lazy(async () => ({ default: (await import("../paginas/nos_pagina")).NosPagina }))
const LogsPagina = lazy(async () => ({ default: (await import("../paginas/logs_pagina")).LogsPagina }))

function PaginaSuspensa({ Componente }: { Componente: ComponentType }) {
  return (
    <Suspense fallback={<CarregandoPainel mensagem="Carregando página..." />}>
      <Componente />
    </Suspense>
  )
}

function PaginaNaoEncontrada() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
      <div className="max-w-xl rounded-3xl border border-slate-200/80 bg-white p-10 text-center shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Página não encontrada</h1>
        <p className="mt-3 text-sm text-slate-500">
          A rota informada não existe nesta versão do painel. Volte para a visão geral do sistema.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex rounded-xl bg-primary-gradient px-4 py-2.5 text-sm font-semibold text-on-primary transition-[transform,opacity] hover:opacity-90 active:translate-y-px"
        >
          Ir para o dashboard
        </a>
      </div>
    </div>
  )
}

export function Aplicacao() {
  return (
    <Routes>
      <Route element={<CascaAplicacao />}>
        <Route index element={<PaginaSuspensa Componente={DashboardPagina} />} />
        <Route path="eventos" element={<PaginaSuspensa Componente={EventosPagina} />} />
        <Route path="mempool" element={<PaginaSuspensa Componente={MempoolPagina} />} />
        <Route path="mineracao" element={<PaginaSuspensa Componente={MineracaoPagina} />} />
        <Route path="blockchain" element={<PaginaSuspensa Componente={BlockchainPagina} />} />
        <Route path="rastreabilidade" element={<PaginaSuspensa Componente={RastreabilidadePagina} />} />
        <Route path="testes" element={<PaginaSuspensa Componente={TestesPagina} />} />
        <Route path="nos" element={<PaginaSuspensa Componente={NosPagina} />} />
        <Route path="logs" element={<PaginaSuspensa Componente={LogsPagina} />} />
      </Route>
      <Route path="404" element={<PaginaNaoEncontrada />} />
      <Route path="*" element={<Navigate replace to="/404" />} />
    </Routes>
  )
}
