import { Plus } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import { useNos } from "../../app/contexto_nos"
import { useEstadosNos } from "../../lib/api/servicos"
import { cx } from "../../lib/util/classe"
import { SeletorNoAtivo } from "./seletor_no_ativo"

const SECOES: Record<string, string> = {
  "/": "Dashboard",
  "/eventos": "Eventos",
  "/mempool": "Mempool",
  "/mineracao": "Mineração",
  "/blockchain": "Blockchain",
  "/rastreabilidade": "Rastreabilidade",
  "/testes": "Testes",
  "/nos": "Nós da rede",
}

export function BarraSuperior({ recolhida = false }: { recolhida?: boolean }) {
  const { pathname } = useLocation()
  const { nos, definirNoAtivo, noAtivo } = useNos()
  const consultas = useEstadosNos(nos)
  const estados = consultas.map((item, indice) => ({
    no: nos[indice],
    dados: item.data,
  }))

  const secaoAtual = SECOES[pathname] ?? "Painel"

  const opcoesNos = nos.map((no) => ({
    id: no.id,
    nome: no.nome,
    url: no.url,
    online: Boolean(estados.find((item) => item.no.id === no.id)?.dados),
  }))

  return (
    <header
      className={cx(
        "fixed right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-8 backdrop-blur-md transition-[left] duration-300 ease-out",
        recolhida ? "left-24" : "left-72",
      )}
    >
      <div className="flex flex-col justify-center">
        <nav className="flex items-center text-[10px] font-medium uppercase tracking-[0.05em] text-slate-400">
          <span>Supply Chain</span>
          <span className="mx-2 opacity-40">/</span>
          <span className="text-slate-500">{secaoAtual}</span>
        </nav>
        <h1 className="mt-0.5 text-base font-bold tracking-tight text-slate-900">
          {secaoAtual}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* 1. Nó ativo (Principal) */}
        <SeletorNoAtivo 
          itens={opcoesNos} 
          ativoId={noAtivo.id} 
          aoSelecionar={definirNoAtivo} 
        />

        {/* 2. Ação principal */}
        <Link
          to="/eventos"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
        >
          <Plus className="h-3.5 w-3.5 stroke-[3]" />
          <span>Criar evento</span>
        </Link>
      </div>
    </header>
  )
}
