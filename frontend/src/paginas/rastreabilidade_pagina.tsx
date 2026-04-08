import { useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { useSearchParams } from "react-router-dom"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { TraceabilityCatalog } from "../componentes/rastreabilidade/traceability_catalog"
import { TraceabilityEmptyState } from "../componentes/rastreabilidade/traceability_empty_state"
import { TraceabilityNodeDetails } from "../componentes/rastreabilidade/traceability_node_details"
import { TraceabilityRootCard } from "../componentes/rastreabilidade/traceability_root_card"
import { TraceabilitySearchBar } from "../componentes/rastreabilidade/traceability_search_bar"
import { TraceabilitySummaryCards } from "../componentes/rastreabilidade/traceability_summary_cards"
import { TraceabilityTree } from "../componentes/rastreabilidade/traceability_tree"
import { useCadeiaNo, useDemonstracoesNos, useMempoolNo, useRastreabilidade } from "../lib/api/servicos"
import { construirItensInsumo } from "../lib/util/insumos"
import { ordenarDescPorTimestamp } from "../lib/util/formatacao"
import {
  calcularMetricasRastreabilidade,
  construirSugestoesRastreabilidade,
  encontrarNoRastreabilidade,
  explicarRastreabilidade,
  obterCaminhoRastreabilidade,
  obterLotIdItem,
  resolverConsultaRastreabilidade,
} from "../lib/util/rastreabilidade"

function rotuloCampoConsulta(campo: "event_id" | "product_id" | "lot_id" | "nome" | "texto_livre") {
  if (campo === "event_id") {
    return "event_id"
  }
  if (campo === "product_id") {
    return "product_id"
  }
  if (campo === "lot_id") {
    return "lot_id"
  }
  if (campo === "nome") {
    return "nome"
  }
  return "texto livre"
}

export function RastreabilidadePagina() {
  const { noAtivo, nos } = useNos()
  const [searchParams, setSearchParams] = useSearchParams()
  const identificadorQuery = searchParams.get("identificador")?.trim() ?? ""
  const [entradaRascunho, setEntradaRascunho] = useState<string | null>(null)
  const [eventIdSelecionado, setEventIdSelecionado] = useState<string | null>(null)
  const entrada = entradaRascunho ?? identificadorQuery
  const busca = identificadorQuery

  const cadeia = useCadeiaNo(noAtivo)
  const mempool = useMempoolNo(noAtivo)
  const demonstracoes = useDemonstracoesNos(nos)
  const rastreabilidade = useRastreabilidade(noAtivo, busca)

  const itensSistema = useMemo(
    () =>
      construirItensInsumo(
        cadeia.data?.cadeia_ativa ?? [],
        mempool.data,
        demonstracoes.map((consulta, indice) => ({ noId: nos[indice].id, dados: consulta.data })),
      ),
    [cadeia.data, mempool.data, demonstracoes, nos],
  )

  const itensOrdenados = useMemo(() => ordenarDescPorTimestamp(itensSistema), [itensSistema])
  const itemPorEvento = useMemo(() => new Map(itensSistema.map((item) => [item.event_id, item])), [itensSistema])

  const sugestoes = useMemo(
    () => construirSugestoesRastreabilidade(itensOrdenados, entrada),
    [entrada, itensOrdenados],
  )

  const resolucaoEntrada = useMemo(
    () => resolverConsultaRastreabilidade(entrada, itensOrdenados),
    [entrada, itensOrdenados],
  )

  const exemplosConsulta = useMemo(() => {
    const vistos = new Set<string>()

    return itensOrdenados
      .map((item) => ({
        rotulo: item.product_name,
        valor: obterLotIdItem(item) ?? item.product_id,
      }))
      .filter((item) => {
        if (vistos.has(item.valor)) {
          return false
        }
        vistos.add(item.valor)
        return true
      })
      .slice(0, 4)
  }, [itensOrdenados])

  const arvore = rastreabilidade.data?.arvore_origem ?? null
  const metricas = useMemo(() => (arvore ? calcularMetricasRastreabilidade(arvore) : null), [arvore])
  const noSelecionado = useMemo(
    () => (arvore ? encontrarNoRastreabilidade(arvore, eventIdSelecionado) : null),
    [arvore, eventIdSelecionado],
  )
  const trilhaSelecionada = useMemo(
    () => (arvore ? obterCaminhoRastreabilidade(arvore, eventIdSelecionado) : []),
    [arvore, eventIdSelecionado],
  )
  const caminhoSelecionado = useMemo(
    () => new Set(trilhaSelecionada.map((item) => item.evento.event_id)),
    [trilhaSelecionada],
  )
  const itemSelecionado = noSelecionado ? itemPorEvento.get(noSelecionado.evento.event_id) ?? null : null
  const itemRaiz = arvore ? itemPorEvento.get(arvore.evento.event_id) ?? null : null

  function consultarIdentificador(identificador: string, valorEntrada = identificador) {
    const termoTratado = identificador.trim()
    setEntradaRascunho(valorEntrada)
    setEventIdSelecionado(null)

    if (!termoTratado) {
      setSearchParams({})
      return
    }

    setSearchParams({ identificador: termoTratado })
  }

  function consultarTermo(termo: string) {
    const termoTratado = termo.trim()
    setEntradaRascunho(termo)

    if (!termoTratado) {
      consultarIdentificador("")
      return
    }

    const resolucao = resolverConsultaRastreabilidade(termoTratado, itensOrdenados)
    consultarIdentificador(resolucao?.identificador ?? termoTratado, termo)
  }

  const dicaResolucao =
    resolucaoEntrada &&
    resolucaoEntrada.campo !== "texto_livre" &&
    resolucaoEntrada.identificador !== resolucaoEntrada.termoOriginal
      ? `Entrada reconhecida localmente por ${rotuloCampoConsulta(resolucaoEntrada.campo)} e consultada como ${resolucaoEntrada.identificador}.`
      : null

  const explicacaoConsulta = metricas ? explicarRastreabilidade(metricas) : null

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Rastreabilidade"
        descricao="Acompanhe a origem de um produto até suas matérias-primas por meio de uma árvore recursiva de dependências, combinando eventos confirmados, pendentes e estados inferidos no frontend."
      />

        <TraceabilitySearchBar
          valor={entrada}
          onAlterar={setEntradaRascunho}
          onConsultar={() => consultarTermo(entrada)}
          onSelecionarSugestao={(sugestao) => consultarIdentificador(sugestao.identificador, sugestao.valorCorrespondente)}
          sugestoes={sugestoes}
        carregando={rastreabilidade.isLoading}
        dicaResolucao={dicaResolucao}
      />

      <TraceabilitySummaryCards metricas={metricas} />

      {arvore && metricas ? (
        <TraceabilityRootCard
          raiz={arvore}
          itemCatalogo={itemRaiz}
          metricas={metricas}
          identificadorConsultado={busca}
        />
      ) : null}

      {busca && rastreabilidade.isError ? (
        <CartaoPainel
          titulo="Falha na consulta"
          descricao="A busca não pôde ser concluída no nó ativo."
          className="border-red-200 bg-red-50/70"
        >
          <div className="flex items-start gap-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{rastreabilidade.error.message}</p>
          </div>
        </CartaoPainel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <CartaoPainel
          titulo="Árvore visual de origem"
          descricao="Cada nó representa um item criador no sistema. Clique para destacar, inspecionar detalhes e reutilizar o nó como nova raiz da análise."
          className="p-6"
        >
          {!busca ? (
            <TraceabilityEmptyState
              titulo="Nenhum item consultado ainda"
              descricao="Selecione um item abaixo ou pesquise por ID, lot_id, event_id ou nome para reconstruir a árvore completa de composição."
              exemplos={exemplosConsulta}
              onSelecionarExemplo={consultarTermo}
            />
          ) : rastreabilidade.isLoading ? (
            <CarregandoPainel mensagem="Reconstruindo a árvore recursiva de origem..." />
          ) : arvore && metricas ? (
            <div className="space-y-5">
              <div className="rounded-[1.4rem] border border-primary/15 bg-primary/5 px-4 py-4 text-sm leading-7 text-slate-600">
                <p className="font-semibold text-slate-900">Leitura automática da consulta</p>
                <p className="mt-1">{explicacaoConsulta}</p>
              </div>

              <TraceabilityTree
                raiz={arvore}
                itemPorEvento={itemPorEvento}
                eventIdSelecionado={eventIdSelecionado}
                caminhoSelecionado={caminhoSelecionado}
                onSelecionarNo={(no) => setEventIdSelecionado(no.evento.event_id)}
              />
            </div>
          ) : (
            <TraceabilityEmptyState
              titulo="Item não encontrado"
              descricao="O backend respondeu, mas não encontrou uma árvore de composição para esse identificador. Tente um item conhecido abaixo ou refine a consulta para um identificador exato."
              exemplos={exemplosConsulta}
              onSelecionarExemplo={consultarTermo}
            />
          )}
        </CartaoPainel>

        <TraceabilityNodeDetails
          no={noSelecionado}
          itemCatalogo={itemSelecionado}
          trilha={trilhaSelecionada}
          onUsarComoRaiz={(no) => consultarIdentificador(no.evento.event_id)}
        />
      </div>

      <TraceabilityCatalog
        itens={itensOrdenados}
        identificadorAtivo={busca}
        onConsultarItem={consultarIdentificador}
      />
    </div>
  )
}
