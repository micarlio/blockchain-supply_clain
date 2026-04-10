import { useEffect, useMemo, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import {
  LogsEmptyState,
  LogDetailsPanel,
  LogsFilterBar,
  LogsKpis,
  LogsTable,
} from "../componentes/logs/logs_ui"
import {
  contarLogsDistintos,
  ENDPOINTS_CONHECIDOS_LOGS,
  OPCOES_CATEGORIA_LOGS,
  OPCOES_NIVEL_LOGS,
  filtrarLogs,
  obterHashRelacionadaLog,
} from "../componentes/logs/logs_utils"
import { useLogsNos } from "../lib/api/servicos"
import type { LogSistema } from "../lib/api/tipos"
import { ordenarDescPorTimestamp } from "../lib/util/formatacao"

const LIMITE_LOGS = 250
const INTERVALO_LOGS_MS = 2_500

export function LogsPagina() {
  const { nos, definirNoAtivo } = useNos()
  const [nodeIdSelecionado, setNodeIdSelecionado] = useState("todos")
  const [categoriaSelecionada, setCategoriaSelecionada] = useState("todos")
  const [endpointSelecionado, setEndpointSelecionado] = useState("todos")
  const [nivelSelecionado, setNivelSelecionado] = useState("todos")
  const [buscaTexto, setBuscaTexto] = useState("")
  const [acompanharTempoReal, setAcompanharTempoReal] = useState(true)
  const [streamPausado, setStreamPausado] = useState(false)
  const [visualizacaoLimpaEm, setVisualizacaoLimpaEm] = useState<string | null>(null)
  const [feedbackAcao, setFeedbackAcao] = useState<string | null>(null)
  const [logSelecionadoId, setLogSelecionadoId] = useState<string | null>(null)

  const consultasLogs = useLogsNos(nos, {
    limite: LIMITE_LOGS,
    refetchInterval:
      acompanharTempoReal && !streamPausado ? INTERVALO_LOGS_MS : false,
  })

  const respostasLogs = consultasLogs.map((consulta, indice) => ({
    no: nos[indice],
    data: consulta.data,
    erro: consulta.error instanceof Error ? consulta.error.message : null,
    carregando: consulta.isLoading,
  }))

  const logsBrutos = useMemo(
    () =>
      ordenarDescPorTimestamp(
        respostasLogs.flatMap((resposta) => resposta.data?.entries ?? []),
      ),
    [respostasLogs],
  )

  const carregandoInicial = logsBrutos.length === 0 && consultasLogs.every((consulta) => consulta.isLoading)
  const erros = respostasLogs.filter((resposta) => resposta.erro)
  const todasConsultasFalharam = erros.length === nos.length && logsBrutos.length === 0

  const logsPosLimpeza = useMemo(() => {
    if (!visualizacaoLimpaEm) {
      return logsBrutos
    }

    const corte = new Date(visualizacaoLimpaEm).getTime()
    return logsBrutos.filter((log) => new Date(log.timestamp).getTime() >= corte)
  }, [logsBrutos, visualizacaoLimpaEm])

  const logsFiltrados = useMemo(
    () =>
      filtrarLogs(logsPosLimpeza, {
        nodeId: nodeIdSelecionado,
        category: categoriaSelecionada,
        endpoint: endpointSelecionado,
        level: nivelSelecionado,
        search: buscaTexto,
      }),
    [
      buscaTexto,
      categoriaSelecionada,
      endpointSelecionado,
      logsPosLimpeza,
      nivelSelecionado,
      nodeIdSelecionado,
    ],
  )

  const logSelecionadoIdEfetivo = useMemo(() => {
    if (logsFiltrados.length === 0) {
      return null
    }

    if (logSelecionadoId && logsFiltrados.some((log) => log.id === logSelecionadoId)) {
      return logSelecionadoId
    }

    return logsFiltrados[0].id
  }, [logSelecionadoId, logsFiltrados])

  const logSelecionado =
    logsFiltrados.find((log) => log.id === logSelecionadoIdEfetivo) ?? logsFiltrados[0] ?? null

  useEffect(() => {
    if (!feedbackAcao) {
      return
    }

    const temporizador = window.setTimeout(() => setFeedbackAcao(null), 2600)
    return () => window.clearTimeout(temporizador)
  }, [feedbackAcao])

  const opcoesNos = useMemo(
    () => [
      { value: "todos", label: "Todos" },
      ...nos.map((no) => ({ value: no.id, label: no.nome })),
    ],
    [nos],
  )

  const opcoesEndpoint = useMemo(() => {
    const vistos = new Set<string>(ENDPOINTS_CONHECIDOS_LOGS)
    const dinamicos = logsBrutos
      .map((log) => log.endpoint)
      .filter((endpoint): endpoint is string => Boolean(endpoint))
      .filter((endpoint) => {
        if (vistos.has(endpoint)) {
          return false
        }
        vistos.add(endpoint)
        return true
      })

    return [
      { value: "todos", label: "Todos" },
      ...[...ENDPOINTS_CONHECIDOS_LOGS, ...dinamicos].map((endpoint) => ({
        value: endpoint,
        label: endpoint,
      })),
    ]
  }, [logsBrutos])

  const ultimaAtualizacao = useMemo(
    () => respostasLogs.flatMap((resposta) => (resposta.data?.updated_at ? [resposta.data.updated_at] : [])).sort().at(-1) ?? null,
    [respostasLogs],
  )

  const kpis = useMemo(
    () => ({
      totalLogs: logsFiltrados.length,
      errosRecentes: logsFiltrados.filter((log) => log.level === "ERROR").length,
      eventosMineracao: contarLogsDistintos(
        logsFiltrados.filter(
          (log) => log.event_type === "bloco_minerado" || log.event_type === "mineracao_manual_concluida",
        ),
        (log) => obterHashRelacionadaLog(log),
      ),
      forksDetectados: contarLogsDistintos(
        logsFiltrados.filter(
          (log) => log.event_type === "fork_detectado" || log.event_type === "bloco_registrado_em_fork",
        ),
        (log) => obterHashRelacionadaLog(log),
      ),
      reorgsDetectadas: contarLogsDistintos(
        logsFiltrados.filter(
          (log) => log.event_type === "cadeia_ativa_reorganizada" || log.event_type === "cadeia_reorganizada",
        ),
        (log) => obterHashRelacionadaLog(log),
      ),
    }),
    [logsFiltrados],
  )

  function limparVisualizacao() {
    setVisualizacaoLimpaEm(new Date().toISOString())
    setFeedbackAcao("Visualização local limpa. Novos logs continuarão aparecendo conforme o stream avançar.")
  }

  async function copiarFiltroAtual() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            node_id: nodeIdSelecionado,
            categoria: categoriaSelecionada,
            endpoint: endpointSelecionado,
            nivel: nivelSelecionado,
            busca: buscaTexto,
            acompanhar_tempo_real: acompanharTempoReal,
            stream_pausado: streamPausado,
          },
          null,
          2,
        ),
      )
      setFeedbackAcao("Filtro atual copiado para a área de transferência.")
    } catch {
      setFeedbackAcao("Não foi possível copiar o filtro atual neste navegador.")
    }
  }

  function exportarLogs() {
    const conteudo = JSON.stringify(logsFiltrados, null, 2)
    const blob = new Blob([conteudo], { type: "application/json" })
    const url = window.URL.createObjectURL(blob)
    const ancora = document.createElement("a")
    ancora.href = url
    ancora.download = `logs-depuracao-${Date.now()}.json`
    document.body.appendChild(ancora)
    ancora.click()
    ancora.remove()
    window.URL.revokeObjectURL(url)
    setFeedbackAcao("Arquivo JSON exportado com os logs visíveis.")
  }

  if (carregandoInicial) {
    return <CarregandoPainel mensagem="Consultando os logs estruturados dos nós da rede..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Logs & Depuração"
        descricao="Monitore eventos internos da rede, mineração, validações e execução dos cenários em tempo real."
      />

      <LogsFilterBar
        opcoesNos={opcoesNos}
        noSelecionado={nodeIdSelecionado}
        aoSelecionarNo={setNodeIdSelecionado}
        opcoesCategoria={OPCOES_CATEGORIA_LOGS}
        categoriaSelecionada={categoriaSelecionada}
        aoSelecionarCategoria={setCategoriaSelecionada}
        opcoesEndpoint={opcoesEndpoint}
        endpointSelecionado={endpointSelecionado}
        aoSelecionarEndpoint={setEndpointSelecionado}
        opcoesNivel={OPCOES_NIVEL_LOGS}
        nivelSelecionado={nivelSelecionado}
        aoSelecionarNivel={setNivelSelecionado}
        buscaTexto={buscaTexto}
        aoAlterarBuscaTexto={setBuscaTexto}
        acompanharTempoReal={acompanharTempoReal}
        aoAlternarTempoReal={() => setAcompanharTempoReal((estadoAtual) => !estadoAtual)}
        streamPausado={streamPausado}
        aoAlternarStreamPausado={() => setStreamPausado((estadoAtual) => !estadoAtual)}
        aoLimparVisualizacao={limparVisualizacao}
        aoRestaurarHistorico={() => setVisualizacaoLimpaEm(null)}
        aoExportarLogs={exportarLogs}
        aoCopiarFiltro={copiarFiltroAtual}
        visualizacaoLimpa={visualizacaoLimpaEm}
        feedbackAcao={feedbackAcao}
      />

      <LogsKpis
        totalLogs={kpis.totalLogs}
        errosRecentes={kpis.errosRecentes}
        eventosMineracao={kpis.eventosMineracao}
        forksDetectados={kpis.forksDetectados}
        reorgsDetectadas={kpis.reorgsDetectadas}
      />

      {streamPausado ? (
        <CartaoPainel titulo="Stream pausado" descricao="A atualização automática foi interrompida. Retome o stream para voltar ao polling contínuo." className="border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>O painel continua mostrando o último snapshot disponível, mas não buscará novas entradas enquanto a pausa estiver ativa.</p>
          </div>
        </CartaoPainel>
      ) : null}

      {erros.length > 0 ? (
        <CartaoPainel titulo="Cobertura parcial de logs" descricao="Alguns nós não responderam ao endpoint de observabilidade. Os logs disponíveis abaixo continuam sendo reais." className="border-amber-200 bg-amber-50/60">
          <div className="space-y-2 text-sm text-amber-950">
            {erros.map((erro) => (
              <p key={erro.no.id}>
                <span className="font-semibold">{erro.no.nome}</span>: {erro.erro}
              </p>
            ))}
          </div>
        </CartaoPainel>
      ) : null}

      {todasConsultasFalharam ? (
        <CartaoPainel titulo="Falha ao carregar logs" descricao="Nenhum nó respondeu com logs estruturados." className="border-red-200 bg-red-50/70">
          <div className="space-y-2 text-sm text-red-700">
            {erros.map((erro) => (
              <p key={erro.no.id}>
                <span className="font-semibold">{erro.no.nome}</span>: {erro.erro}
              </p>
            ))}
          </div>
        </CartaoPainel>
      ) : logsBrutos.length === 0 ? (
        <LogsEmptyState
          titulo="Ainda não há logs estruturados em memória"
          descricao="Gere tráfego pela API, execute mineração manual, rode cenários de teste ou ajuste a rede para começar a popular esta visão de observabilidade."
          acao={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/eventos"
                className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Criar evento
              </Link>
              <Link
                to="/testes"
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Abrir testes
              </Link>
            </div>
          }
        />
      ) : logsFiltrados.length === 0 ? (
        <LogsEmptyState
          titulo="Nenhum log corresponde aos filtros atuais"
          descricao="A coleta está ativa, mas o recorte atual ficou restritivo demais. Ajuste nó, categoria, endpoint, nível ou busca textual para voltar a enxergar eventos." 
          acao={
            <button
              type="button"
              onClick={() => {
                setNodeIdSelecionado("todos")
                setCategoriaSelecionada("todos")
                setEndpointSelecionado("todos")
                setNivelSelecionado("todos")
                setBuscaTexto("")
              }}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Limpar filtros
            </button>
          }
        />
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.92fr)]">
          <LogsTable
            logs={logsFiltrados}
            logSelecionadoId={logSelecionadoIdEfetivo}
            aoSelecionar={(log: LogSistema) => setLogSelecionadoId(log.id)}
            updatedAt={ultimaAtualizacao}
          />
          <LogDetailsPanel
            log={logSelecionado}
            aoPrepararNavegacao={(nodeId) => definirNoAtivo(nodeId)}
            obterNomeNo={(nodeId) => nos.find((no) => no.id === nodeId)?.nome ?? nodeId}
          />
        </div>
      )}
    </div>
  )
}
