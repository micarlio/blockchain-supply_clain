import { GitBranch } from "lucide-react"
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { useNos } from "../app/contexto_nos"
import { BlockDetailsDrawer } from "../componentes/blockchain/block_details_drawer"
import { BlockchainChainView } from "../componentes/blockchain/blockchain_chain_view"
import { BlockchainSummaryCards } from "../componentes/blockchain/blockchain_summary_cards"
import {
  BlockTable,
  type FiltrosTabelaBlocos,
  type OrdenacaoTabela,
} from "../componentes/blockchain/block_table"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { EstadoVazio } from "../componentes/comum/estado_vazio"
import { useCadeiaNo } from "../lib/api/servicos"
import type { BlocoBlockchain } from "../lib/api/tipos"

type ResumoFork = {
  id: string
  indice: number
  indiceAncestral: number
  blocoAncestral: BlocoBlockchain
  blocosFork: BlocoBlockchain[]
  blocosNoFork: number
  hashPonta: string
  trabalhoAcumulado: number
}

const ORDENACOES_VALIDAS: OrdenacaoTabela[] = [
  "indice-desc",
  "indice-asc",
  "timestamp-desc",
  "eventos-desc",
]

function obterOrdenacao(valor: string | null): OrdenacaoTabela {
  if (valor && ORDENACOES_VALIDAS.includes(valor as OrdenacaoTabela)) {
    return valor as OrdenacaoTabela
  }
  return "indice-desc"
}

function obterPagina(valor: string | null) {
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero < 1) {
    return 1
  }
  return numero
}

function calcularTrabalhoAcumulado(blocos: BlocoBlockchain[]) {
  return blocos.slice(1).reduce((total, bloco) => total + 2 ** bloco.difficulty, 0)
}

function construirResumoForks(
  cadeiaAtiva: BlocoBlockchain[],
  cadeiasCandidatas: BlocoBlockchain[][],
): ResumoFork[] {
  return cadeiasCandidatas
    .map((cadeiaCandidata, indiceFork) => {
      let indiceDivergencia = 0
      const limiteComparacao = Math.min(cadeiaAtiva.length, cadeiaCandidata.length)

      while (
        indiceDivergencia < limiteComparacao &&
        cadeiaAtiva[indiceDivergencia]?.block_hash === cadeiaCandidata[indiceDivergencia]?.block_hash
      ) {
        indiceDivergencia += 1
      }

      if (indiceDivergencia === 0) {
        return null
      }

      const blocoAncestral = cadeiaCandidata[indiceDivergencia - 1]
      const blocosFork = cadeiaCandidata.slice(indiceDivergencia)

      if (!blocoAncestral || blocosFork.length === 0) {
        return null
      }

      return {
        id: `${blocoAncestral.block_hash}-${indiceFork}`,
        indice: indiceFork + 1,
        indiceAncestral: indiceDivergencia - 1,
        blocoAncestral,
        blocosFork: blocosFork,
        blocosNoFork: blocosFork.length,
        hashPonta: blocosFork.at(-1)?.block_hash ?? "-",
        trabalhoAcumulado: calcularTrabalhoAcumulado(cadeiaCandidata),
      }
    })
    .filter((resumo): resumo is ResumoFork => resumo !== null)
}

export function BlockchainPagina() {
  const { noAtivo } = useNos()
  const [searchParams, setSearchParams] = useSearchParams()
  const cadeia = useCadeiaNo(noAtivo)
  const [hashSelecionado, setHashSelecionado] = useState<string | undefined>(undefined)
  const [hashFixado, setHashFixado] = useState<string | undefined>(undefined)
  const [drawerAberto, setDrawerAberto] = useState(false)

  const filtrosTabela: FiltrosTabelaBlocos = {
    termoBusca: searchParams.get("q") ?? "",
    filtroMinerador: searchParams.get("miner") ?? "todos",
    filtroComEventos: searchParams.get("events") === "1",
    ordenacao: obterOrdenacao(searchParams.get("sort")),
    pagina: obterPagina(searchParams.get("page")),
  }

  const cadeiaAtiva = useMemo(() => cadeia.data?.cadeia_ativa ?? [], [cadeia.data])
  const cadeiasCandidatas = useMemo(() => cadeia.data?.cadeias_candidatas ?? [], [cadeia.data])
  const blocosTabela = useMemo(() => [...cadeiaAtiva].reverse(), [cadeiaAtiva])

  const todosBlocos = useMemo(() => {
    const blocosConhecidos = new Map<string, BlocoBlockchain>()

    for (const bloco of cadeiaAtiva) {
      blocosConhecidos.set(bloco.block_hash, bloco)
    }

    for (const cadeiaCandidata of cadeiasCandidatas) {
      for (const bloco of cadeiaCandidata) {
        blocosConhecidos.set(bloco.block_hash, bloco)
      }
    }

    return [...blocosConhecidos.values()]
  }, [cadeiaAtiva, cadeiasCandidatas])

  const blocoMaisRecente = blocosTabela[0]
  const hashSelecionadoEfetivo = hashSelecionado ?? blocoMaisRecente?.block_hash

  const blocoSelecionado: BlocoBlockchain | undefined = useMemo(
    () => todosBlocos.find((bloco) => bloco.block_hash === hashSelecionadoEfetivo) ?? blocoMaisRecente,
    [todosBlocos, hashSelecionadoEfetivo, blocoMaisRecente],
  )

  const blocoFixado: BlocoBlockchain | undefined = useMemo(
    () => todosBlocos.find((bloco) => bloco.block_hash === hashFixado),
    [todosBlocos, hashFixado],
  )

  const resumoForks = useMemo(
    () => construirResumoForks(cadeiaAtiva, cadeiasCandidatas),
    [cadeiaAtiva, cadeiasCandidatas],
  )

  if (cadeia.isLoading) {
    return <CarregandoPainel mensagem="Consultando a cadeia ativa do nó selecionado..." />
  }

  function atualizarFiltrosTabela(proximo: Partial<FiltrosTabelaBlocos>) {
    const combinado: FiltrosTabelaBlocos = {
      ...filtrosTabela,
      ...proximo,
    }

    const params = new URLSearchParams(searchParams)

    if (combinado.termoBusca.trim()) {
      params.set("q", combinado.termoBusca)
    } else {
      params.delete("q")
    }

    if (combinado.filtroMinerador !== "todos") {
      params.set("miner", combinado.filtroMinerador)
    } else {
      params.delete("miner")
    }

    if (combinado.filtroComEventos) {
      params.set("events", "1")
    } else {
      params.delete("events")
    }

    if (combinado.ordenacao !== "indice-desc") {
      params.set("sort", combinado.ordenacao)
    } else {
      params.delete("sort")
    }

    if (combinado.pagina > 1) {
      params.set("page", String(combinado.pagina))
    } else {
      params.delete("page")
    }

    setSearchParams(params, { replace: true })
  }

  function selecionarBloco(bloco: BlocoBlockchain) {
    setHashSelecionado(bloco.block_hash)
    setDrawerAberto(true)
  }

  function fixarBlocoAtual() {
    if (!blocoSelecionado) {
      return
    }

    setHashFixado(blocoSelecionado.block_hash)
  }

  function fecharDrawer() {
    setDrawerAberto(false)
  }

  if (!cadeiaAtiva.length) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina
          titulo="Explorador de Blockchain"
          descricao="Visualize a cadeia do no ativo, inspecione blocos e conecte os eventos confirmados com a rastreabilidade do dominio."
        />

        <EstadoVazio
          titulo="Sem blocos disponiveis"
          descricao="A API do no ativo nao devolveu nenhuma cadeia visivel para exploracao."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Explorador de Blockchain"
        descricao="Visualize a cadeia do no ativo, entenda o encadeamento entre blocos e relacione os eventos confirmados com a supply chain."
      />

      <BlockchainSummaryCards cadeiaAtiva={cadeiaAtiva} />

      <CartaoPainel
        titulo="Encadeamento da Blockclain"
        descricao={`Cadeia confirmada por ${noAtivo.nome}. Cada bloco aponta para o hash anterior.`}
        destaque={
          <div className="text-right text-xs text-on-surface-variant">
            <p>{cadeia.data?.trabalho_acumulado_ativo ?? 0} trabalho acumulado</p>
            <p>{cadeiasCandidatas.length} forks conhecidos</p>
          </div>
        }
      >
        <BlockchainChainView
          blocos={cadeiaAtiva}
          forks={resumoForks}
          hashSelecionado={hashSelecionadoEfetivo}
          onSelecionar={selecionarBloco}
        />
      </CartaoPainel>

      <CartaoPainel
        titulo="Blocos confirmados"
        descricao="Tabela tecnica da cadeia ativa com hashes, cabecalho e contagem de eventos por bloco."
        destaque={
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            <GitBranch className="h-3.5 w-3.5" />
            no ativo: {noAtivo.nome}
          </div>
        }
      >
        <BlockTable
          blocos={blocosTabela}
          hashSelecionado={hashSelecionadoEfetivo}
          onSelecionar={selecionarBloco}
          filtros={filtrosTabela}
          onMudarFiltros={atualizarFiltrosTabela}
        />
      </CartaoPainel>

      <BlockDetailsDrawer
        aberto={drawerAberto}
        bloco={blocoSelecionado}
        blocoFixado={blocoFixado}
        blocosConhecidos={todosBlocos}
        onFixarBloco={fixarBlocoAtual}
        onDesfixarBloco={() => setHashFixado(undefined)}
        onFechar={fecharDrawer}
      />
    </div>
  )
}
