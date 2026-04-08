import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import {
  ScenarioBlockchainImpact,
  ScenarioCategoryList,
  ScenarioContextCard,
  ScenarioExecutionPanel,
  type ScenarioCategorySection,
  type ScenarioContextSection,
  type ScenarioExecutionMode,
  type ScenarioImpactView,
  type ScenarioPanelView,
  type ScenarioPayloadPreview,
  type ScenarioResultView,
  type ScenarioTone,
} from "../componentes/testes/testes_ui"
import { ErroApi } from "../lib/api/cliente"
import {
  consultarCadeiaNo,
  consultarDemonstracaoNo,
  consultarEstadoNo,
  consultarRedeNo,
  enviarEvento,
  enviarPayloadInvalido,
  minerarNo,
  useCadeiasNos,
  useDemonstracoesNos,
  useEstadosNos,
  useRedesNos,
} from "../lib/api/servicos"
import type {
  BlocoBlockchain,
  CadeiaResposta,
  ConfiguracaoNo,
  DemonstracaoResposta,
  EstadoNo,
  EventoBlockchain,
  RedeResposta,
} from "../lib/api/tipos"
import { extrairEventosConfirmados } from "../lib/util/insumos"
import { derivarPainelCluster } from "../lib/util/rede_cluster"
import { encurtarHash, formatarData } from "../lib/util/formatacao"

type GrupoCenario = "domain_validation" | "domain_security" | "blockchain_consensus"

type CenarioDefinicao = ScenarioPanelView & {
  groupId: GrupoCenario
  groupTitle: string
  groupDescription: string
  expectedImpactSummary: string
  preparedRequests: ScenarioPayloadPreview[]
  contextSections: ScenarioContextSection[]
  run: () => Promise<ScenarioResultView>
}

type EntradaCluster = {
  no: ConfiguracaoNo
  estado?: EstadoNo
  cadeia?: CadeiaResposta
  rede?: RedeResposta
  demonstracao?: DemonstracaoResposta
}

type SnapshotCluster = {
  capturadoEm: string
  entradas: EntradaCluster[]
  painel: ReturnType<typeof derivarPainelCluster>
}

type EventoConfirmadoIndexado = {
  evento: EventoBlockchain
  block_index: number
  block_hash: string
  miner_id: string | null
}

type ResumoEventosCadeia = {
  eventosConfirmados: EventoConfirmadoIndexado[]
  eventosConsumidos: EventoConfirmadoIndexado[]
  materiasPrimasDisponiveis: EventoConfirmadoIndexado[]
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function gerarIdentificador(prefixo: string, seed: number, sufixo: string) {
  return `${prefixo}-${seed}-${sufixo}`
}

function serializarErro(erro: unknown) {
  if (erro instanceof ErroApi) {
    return {
      tipo: "ErroApi",
      status_http: erro.status,
      mensagem: erro.message,
      payload: erro.dados,
    }
  }

  return {
    tipo: "ErroLocal",
    mensagem: erro instanceof Error ? erro.message : "Falha desconhecida",
  }
}

function resumirEventosCadeia(cadeia: BlocoBlockchain[]): ResumoEventosCadeia {
  const eventosConfirmados = extrairEventosConfirmados(cadeia)
  const mapaEventos = new Map(eventosConfirmados.map((item) => [item.evento.event_id, item]))
  const idsConsumidos = new Set<string>()

  for (const item of eventosConfirmados) {
    for (const inputId of item.evento.input_ids) {
      idsConsumidos.add(inputId)
    }
  }

  return {
    eventosConfirmados,
    eventosConsumidos: [...idsConsumidos].map((id) => mapaEventos.get(id)).filter((item): item is EventoConfirmadoIndexado => Boolean(item)),
    materiasPrimasDisponiveis: eventosConfirmados.filter(
      (item) => item.evento.entity_kind === "raw_material" && !idsConsumidos.has(item.evento.event_id),
    ),
  }
}

function construirProdutoSimplesSemInsumos(seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-TESTE", seed, "SEM-INPUT"),
    event_type: "FABRICAR_PRODUTO_SIMPLES",
    entity_kind: "simple_product",
    product_id: gerarIdentificador("PROD-SIMPLES", seed, "SEM-INPUT"),
    product_name: "Produto simples sem insumo",
    actor_id: "FABRICANTE-TESTE-CNPJ",
    actor_role: "FABRICANTE",
    timestamp: new Date().toISOString(),
    input_ids: [],
    metadata: { lot_id: gerarIdentificador("LOT", seed, "SEM-INPUT") },
  }
}

function construirEventoIncoerente(seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-TESTE", seed, "INCOERENTE"),
    event_type: "CADASTRAR_MATERIA_PRIMA",
    entity_kind: "simple_product",
    product_id: gerarIdentificador("INC", seed, "PROD"),
    product_name: "Evento incoerente",
    actor_id: "FORNECEDOR-TESTE-CNPJ",
    actor_role: "FORNECEDOR",
    timestamp: new Date().toISOString(),
    input_ids: [],
    metadata: { lot_id: gerarIdentificador("INC", seed, "LOT") },
  }
}

function construirProdutoConflitante(inputId: string, seed: number, origem: string): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-CONFLITO", seed, origem),
    event_type: "FABRICAR_PRODUTO_SIMPLES",
    entity_kind: "simple_product",
    product_id: gerarIdentificador("PROD-CONFLITO", seed, origem),
    product_name: `Produto concorrente ${origem}`,
    actor_id: `FABRICANTE-${origem}-CNPJ`,
    actor_role: "FABRICANTE",
    timestamp: new Date().toISOString(),
    input_ids: [inputId],
    metadata: { lot_id: gerarIdentificador("LOT-CONFLITO", seed, origem) },
  }
}

function construirMateriaPrimaAtaque(seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-ATAQUE", seed, "ROOT"),
    event_type: "CADASTRAR_MATERIA_PRIMA",
    entity_kind: "raw_material",
    product_id: gerarIdentificador("RAW", seed, "ROOT"),
    product_name: "Matéria-prima controlada do ataque",
    actor_id: "FORNECEDOR-ATAQUE-CNPJ",
    actor_role: "FORNECEDOR",
    timestamp: new Date().toISOString(),
    input_ids: [],
    metadata: { lot_id: gerarIdentificador("RAW-LOT", seed, "ROOT"), categoria_insumo: "aco" },
  }
}

function construirProdutoHonesto(inputId: string, seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-ATAQUE", seed, "HONESTO"),
    event_type: "FABRICAR_PRODUTO_SIMPLES",
    entity_kind: "simple_product",
    product_id: gerarIdentificador("CHAPA", seed, "HONESTA"),
    product_name: "Chapa honesta",
    actor_id: "FABRICANTE-HONESTO-CNPJ",
    actor_role: "FABRICANTE",
    timestamp: new Date().toISOString(),
    input_ids: [inputId],
    metadata: { lot_id: gerarIdentificador("CHAPA", seed, "HONESTA") },
  }
}

function construirProdutoMalicioso(inputId: string, seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-ATAQUE", seed, "ALTERNATIVO"),
    event_type: "FABRICAR_PRODUTO_SIMPLES",
    entity_kind: "simple_product",
    product_id: gerarIdentificador("CHAPA", seed, "ALTERNATIVA"),
    product_name: "Chapa alternativa",
    actor_id: "FABRICANTE-ALTERNATIVO-CNPJ",
    actor_role: "FABRICANTE",
    timestamp: new Date().toISOString(),
    input_ids: [inputId],
    metadata: { lot_id: gerarIdentificador("CHAPA", seed, "ALTERNATIVA") },
  }
}

function construirExtensaoMaliciosa(inputId: string, seed: number): EventoBlockchain {
  return {
    event_id: gerarIdentificador("EVT-ATAQUE", seed, "EXTENSAO"),
    event_type: "FABRICAR_PRODUTO_COMPOSTO",
    entity_kind: "composite_product",
    product_id: gerarIdentificador("BIKE", seed, "ALTERNATIVA"),
    product_name: "Produto composto da cadeia alternativa",
    actor_id: "MONTADORA-ALTERNATIVA-CNPJ",
    actor_role: "MONTADORA",
    timestamp: new Date().toISOString(),
    input_ids: [inputId],
    metadata: { lot_id: gerarIdentificador("BIKE", seed, "ALTERNATIVA") },
  }
}

async function capturarCluster(nos: ConfiguracaoNo[], noAtivoId: string): Promise<SnapshotCluster> {
  const entradas = await Promise.all(
    nos.map(async (no) => {
      const [estado, cadeia, rede, demonstracao] = await Promise.allSettled([
        consultarEstadoNo(no),
        consultarCadeiaNo(no),
        consultarRedeNo(no),
        consultarDemonstracaoNo(no),
      ])

      return {
        no,
        estado: estado.status === "fulfilled" ? estado.value : undefined,
        cadeia: cadeia.status === "fulfilled" ? cadeia.value : undefined,
        rede: rede.status === "fulfilled" ? rede.value : undefined,
        demonstracao: demonstracao.status === "fulfilled" ? demonstracao.value : undefined,
      } satisfies EntradaCluster
    }),
  )

  return {
    capturadoEm: new Date().toISOString(),
    entradas,
    painel: derivarPainelCluster(entradas, noAtivoId),
  }
}

async function esperarAlturaMinima(no: ConfiguracaoNo, alturaMinima: number, tentativas = 8) {
  for (let tentativa = 0; tentativa < tentativas; tentativa += 1) {
    try {
      const estado = await consultarEstadoNo(no)
      if (estado.altura_cadeia >= alturaMinima) {
        return true
      }
    } catch {
      // ignora falha transitória de consulta
    }

    await esperar(1_000)
  }

  return false
}

function obterEntrada(snapshot: SnapshotCluster, noId: string) {
  return snapshot.entradas.find((entrada) => entrada.no.id === noId)
}

function formatarBloco(bloco?: BlocoBlockchain | null) {
  if (!bloco) {
    return "nenhum"
  }
  return `#${bloco.index} • ${encurtarHash(bloco.block_hash, 18)}`
}

function formatarEvento(item?: EventoConfirmadoIndexado) {
  if (!item) {
    return "nenhum evento encontrado"
  }
  return `${item.evento.product_name} (${item.evento.product_id})`
}

function formatarItemCadeia(item?: EventoConfirmadoIndexado) {
  if (!item) {
    return "nenhum"
  }
  return `Bloco #${item.block_index} • ${encurtarHash(item.block_hash, 18)}`
}

function prefixoComum(cadeiaAntes: BlocoBlockchain[], cadeiaDepois: BlocoBlockchain[]) {
  let indice = 0
  while (
    indice < cadeiaAntes.length &&
    indice < cadeiaDepois.length &&
    cadeiaAntes[indice].block_hash === cadeiaDepois[indice].block_hash
  ) {
    indice += 1
  }
  return indice
}

function construirImpactoBlockchain(
  antes: SnapshotCluster,
  depois: SnapshotCluster,
  noAtivoId: string,
): ScenarioImpactView {
  const entradaAntes = obterEntrada(antes, noAtivoId)
  const entradaDepois = obterEntrada(depois, noAtivoId)
  const cadeiaAntes = entradaAntes?.cadeia?.cadeia_ativa ?? []
  const cadeiaDepois = entradaDepois?.cadeia?.cadeia_ativa ?? []
  const estadoAntes = entradaAntes?.estado
  const estadoDepois = entradaDepois?.estado
  const topoAntes = cadeiaAntes.at(-1) ?? null
  const topoDepois = cadeiaDepois.at(-1) ?? null
  const pontoDivergencia = prefixoComum(cadeiaAntes, cadeiaDepois)
  const removidos = cadeiaAntes.slice(pontoDivergencia).map((bloco) => `Saiu da ponta: ${formatarBloco(bloco)}`)
  const adicionados = cadeiaDepois.slice(pontoDivergencia).map((bloco) => `Entrou na ponta: ${formatarBloco(bloco)}`)
  const houveMudancaTopo = estadoAntes?.hash_ponta !== estadoDepois?.hash_ponta || estadoAntes?.altura_cadeia !== estadoDepois?.altura_cadeia
  const forkDetectado = depois.entradas.some((entrada) => entrada.demonstracao?.demonstracao.fork_detectado)
  const reorganizacaoDetectada = depois.entradas.some((entrada) => entrada.demonstracao?.demonstracao.reorganizacao_detectada)

  const notas = [
    houveMudancaTopo
      ? "A ponta da cadeia do nó ativo mudou depois da execução."
      : "A ponta da cadeia do nó ativo permaneceu estável durante a execução.",
    forkDetectado
      ? "Ao menos um nó reportou fork detectado pela telemetria de demonstração."
      : "Nenhum nó reportou fork detectado no snapshot final.",
    reorganizacaoDetectada
      ? "A telemetria indicou reorganização da cadeia após o conflito."
      : "Nenhuma reorganização explícita foi exposta no snapshot final.",
    depois.painel.resumo.haDivergenciaHash || depois.painel.resumo.haDivergenciaAltura
      ? "O cluster terminou com alguma divergência observável de ponta ou altura."
      : "O cluster terminou sem divergência visível de ponta entre os nós online.",
  ]

  let title = "Rejeição sem impacto na cadeia"
  let summary = "A blockchain ativa não mudou; o efeito ficou restrito à API, mempool ou observação do cluster."
  let tone: ScenarioTone = "info"

  if (reorganizacaoDetectada) {
    title = "Reorganização observada"
    summary = "A rede expôs sinal de reorganização: uma cadeia concorrente ganhou ou perdeu a posição de cadeia ativa."
    tone = "warning"
  } else if (depois.painel.resumo.haDivergenciaHash || depois.painel.resumo.haDivergenciaAltura) {
    title = "Cadeia alternativa detectada"
    summary = "O cluster terminou com nós vendo pontas diferentes, indicando conflito ou sincronização incompleta entre cadeias."
    tone = "warning"
  } else if (houveMudancaTopo) {
    title = "Cadeia ativa alterada"
    summary = "A execução gerou mudança confirmada no topo da cadeia do nó ativo."
    tone = "success"
  }

  return {
    title,
    summary,
    tone,
    rows: [
      {
        label: "Altura da cadeia",
        before: String(estadoAntes?.altura_cadeia ?? "-"),
        after: String(estadoDepois?.altura_cadeia ?? "-"),
        changed: estadoAntes?.altura_cadeia !== estadoDepois?.altura_cadeia,
      },
      {
        label: "Hash do topo",
        before: estadoAntes?.hash_ponta ? encurtarHash(estadoAntes.hash_ponta, 22) : "-",
        after: estadoDepois?.hash_ponta ? encurtarHash(estadoDepois.hash_ponta, 22) : "-",
        changed: estadoAntes?.hash_ponta !== estadoDepois?.hash_ponta,
      },
      {
        label: "Bloco topo do nó ativo",
        before: formatarBloco(topoAntes),
        after: formatarBloco(topoDepois),
        changed: topoAntes?.block_hash !== topoDepois?.block_hash,
      },
      {
        label: "Referência do cluster",
        before: `${antes.painel.resumo.alturaReferencia} • ${encurtarHash(antes.painel.resumo.hashReferencia, 18)}`,
        after: `${depois.painel.resumo.alturaReferencia} • ${encurtarHash(depois.painel.resumo.hashReferencia, 18)}`,
        changed:
          antes.painel.resumo.alturaReferencia !== depois.painel.resumo.alturaReferencia ||
          antes.painel.resumo.hashReferencia !== depois.painel.resumo.hashReferencia,
      },
    ],
    affectedBlocks: [...removidos, ...adicionados],
    notes: notas,
  }
}

function localizarEventoNosNos(snapshot: SnapshotCluster, eventId: string) {
  return snapshot.entradas
    .filter((entrada) => entrada.cadeia?.cadeia_ativa.some((bloco) => bloco.events.some((evento) => evento.event_id === eventId)))
    .map((entrada) => entrada.no.nome)
}

function existeEventoNaReferencia(snapshot: SnapshotCluster, eventId: string) {
  const hashReferencia = snapshot.painel.resumo.hashReferencia
  const alturaReferencia = snapshot.painel.resumo.alturaReferencia

  const entradaReferencia = snapshot.entradas.find(
    (entrada) =>
      entrada.estado?.hash_ponta === hashReferencia &&
      entrada.estado.altura_cadeia === alturaReferencia &&
      entrada.cadeia,
  )

  const cadeia = entradaReferencia?.cadeia?.cadeia_ativa ?? []
  return cadeia.some((bloco) => bloco.events.some((evento) => evento.event_id === eventId))
}

function rotuloExecucao(modo: ScenarioExecutionMode) {
  if (modo === "request_real") {
    return "Request real"
  }
  if (modo === "simulacao_real") {
    return "Simulação real"
  }
  return "Inspeção da rede"
}

function descricaoSeveridade(severity: ScenarioPanelView["severity"]) {
  if (severity === "validation") {
    return "Regra de entrada e consistência do domínio."
  }
  if (severity === "security") {
    return "Proteção contra abuso ou competição indevida por insumos."
  }
  return "Conflito entre cadeias, forks e possível reorganização."
}

export function TestesPagina() {
  const { nos, noAtivo } = useNos()
  const clienteConsulta = useQueryClient()
  const estados = useEstadosNos(nos)
  const cadeias = useCadeiasNos(nos)
  const redes = useRedesNos(nos)
  const demonstracoes = useDemonstracoesNos(nos)
  const [cenarioSelecionadoId, setCenarioSelecionadoId] = useState("double-spend-adaptado")
  const [seedCenario, setSeedCenario] = useState(() => Date.now())
  const [executandoId, setExecutandoId] = useState<string | null>(null)
  const [ultimoResultado, setUltimoResultado] = useState<ScenarioResultView | null>(null)

  const entradas = useMemo(
    () =>
      nos.map((no, indice) => ({
        no,
        estado: estados[indice].data,
        cadeia: cadeias[indice].data,
        rede: redes[indice].data,
        demonstracao: demonstracoes[indice].data,
      })),
    [nos, estados, cadeias, redes, demonstracoes],
  )

  const painelCluster = useMemo(() => derivarPainelCluster(entradas, noAtivo.id), [entradas, noAtivo.id])
  const entradaAtiva = entradas.find((entrada) => entrada.no.id === noAtivo.id)
  const cadeiaAtiva = useMemo(() => entradaAtiva?.cadeia?.cadeia_ativa ?? [], [entradaAtiva?.cadeia?.cadeia_ativa])
  const resumoCadeia = useMemo(() => resumirEventosCadeia(cadeiaAtiva), [cadeiaAtiva])
  const eventoConsumido =
    resumoCadeia.eventosConsumidos.find((item) => item.evento.entity_kind === "raw_material") ??
    resumoCadeia.eventosConsumidos[0]
  const materiaPrimaDisponivel = resumoCadeia.materiasPrimasDisponiveis[0]
  const nosMineraveis = painelCluster.linhas.filter((linha) => linha.online && linha.mineracaoDisponivel).map((linha) => linha.no)
  const noHonesto = nosMineraveis.find((no) => no.id === noAtivo.id) ?? nosMineraveis[0]
  const noAlternativo = nosMineraveis.find((no) => no.id !== noHonesto?.id)
  const noConcorrente =
    painelCluster.linhas.find((linha) => linha.no.id !== noAtivo.id && linha.online)?.no ??
    nos.find((no) => no.id !== noAtivo.id)

  async function revalidarCluster() {
    await Promise.all(
      nos.flatMap((no) => [
        clienteConsulta.invalidateQueries({ queryKey: ["estado-no", no.id, no.url], exact: true }),
        clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no", no.id, no.url], exact: true }),
        clienteConsulta.invalidateQueries({ queryKey: ["rede-no", no.id, no.url], exact: true }),
        clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", no.id, no.url], exact: true }),
        clienteConsulta.invalidateQueries({ queryKey: ["mempool-no", no.id, no.url], exact: true }),
      ]),
    )
  }

  async function executarRejeicaoEsperada(params: {
    scenarioId: string
    scenarioName: string
    expectedBehavior: string
    requests: ScenarioPayloadPreview[]
    targetNodes: string[]
    action: () => Promise<unknown>
    acceptedInterpretation: string
    rejectedInterpretation: string
    executionMode?: ScenarioExecutionMode
  }) {
    const antes = await capturarCluster(nos, noAtivo.id)

    try {
      const resposta = await params.action()
      const depois = await capturarCluster(nos, noAtivo.id)

      return {
        scenarioId: params.scenarioId,
        scenarioName: params.scenarioName,
        targetNodes: params.targetNodes,
        executionMode: params.executionMode ?? "request_real",
        statusLabel: "teste falhou",
        tone: "error",
        httpStatus: "2xx",
        expectedBehavior: params.expectedBehavior,
        observedBehavior: "O backend aceitou a request quando deveria rejeitar.",
        finalInterpretation: params.acceptedInterpretation,
        highlights: ["aceitação indevida", rotuloExecucao(params.executionMode ?? "request_real")],
        requests: params.requests,
        responses: [{ label: "Resposta recebida", payload: resposta }],
        impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
      } satisfies ScenarioResultView
    } catch (erro) {
      const depois = await capturarCluster(nos, noAtivo.id)

      if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) {
        return {
          scenarioId: params.scenarioId,
          scenarioName: params.scenarioName,
          targetNodes: params.targetNodes,
          executionMode: params.executionMode ?? "request_real",
          statusLabel: "teste aprovado",
          tone: "success",
          httpStatus: `HTTP ${erro.status}`,
          expectedBehavior: params.expectedBehavior,
          observedBehavior: "Backend rejeitou a request como esperado.",
          finalInterpretation: params.rejectedInterpretation,
          highlights: ["rejeição esperada", rotuloExecucao(params.executionMode ?? "request_real")],
          requests: params.requests,
          responses: [{ label: "Erro funcional do backend", payload: serializarErro(erro) }],
          impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
        } satisfies ScenarioResultView
      }

      return {
        scenarioId: params.scenarioId,
        scenarioName: params.scenarioName,
        targetNodes: params.targetNodes,
        executionMode: params.executionMode ?? "request_real",
        statusLabel: "erro inesperado",
        tone: "error",
        httpStatus: erro instanceof ErroApi ? `HTTP ${erro.status}` : "sem HTTP válido",
        expectedBehavior: params.expectedBehavior,
        observedBehavior: "Falha local ou erro não mapeado durante a execução.",
        finalInterpretation: "A execução não confirmou uma proteção funcional do backend; houve falha fora do fluxo esperado do teste.",
        highlights: ["erro inesperado", rotuloExecucao(params.executionMode ?? "request_real")],
        requests: params.requests,
        responses: [{ label: "Falha registrada", payload: serializarErro(erro) }],
        impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
      } satisfies ScenarioResultView
    } finally {
      await revalidarCluster()
    }
  }

  const previewDoubleSpend = eventoConsumido
    ? construirProdutoConflitante(eventoConsumido.evento.event_id, seedCenario, noAtivo.nome.toUpperCase())
    : null
  const previewSemInput = construirProdutoSimplesSemInsumos(seedCenario)
  const previewIncoerente = construirEventoIncoerente(seedCenario)
  const previewCorridaAlpha = materiaPrimaDisponivel
    ? construirProdutoConflitante(materiaPrimaDisponivel.evento.event_id, seedCenario, noAtivo.nome.toUpperCase())
    : null
  const previewCorridaBeta = materiaPrimaDisponivel && noConcorrente
    ? construirProdutoConflitante(materiaPrimaDisponivel.evento.event_id, seedCenario + 1, noConcorrente.nome.toUpperCase())
    : null
  const previewRaizAtaque = construirMateriaPrimaAtaque(seedCenario)
  const previewProdutoHonesto = construirProdutoHonesto(previewRaizAtaque.event_id, seedCenario)
  const previewProdutoMalicioso = construirProdutoMalicioso(previewRaizAtaque.event_id, seedCenario)
  const previewExtensao = construirExtensaoMaliciosa(previewProdutoMalicioso.event_id, seedCenario)

  const cenarios: CenarioDefinicao[] = [
    {
        id: "double-spend-adaptado",
        groupId: "domain_validation",
        groupTitle: "Validação do domínio",
        groupDescription: "Regras de negócio que o backend precisa rejeitar imediatamente.",
        categoryLabel: "Validação do domínio",
        severity: "security",
        name: "Reutilização de insumo já consumido",
        shortDescription: "Tenta reutilizar um input_id que já saiu da cadeia ativa para fabricar um novo produto.",
        description:
          "Este é o equivalente do gasto duplo no domínio do projeto. O mesmo insumo já foi consumido por uma fabricação anterior e não pode sustentar uma segunda história produtiva válida.",
        expectedBehavior: "O backend deve rejeitar a request e a cadeia deve permanecer intacta.",
        importance:
          "Este cenário valida a regra de consumo único dos insumos e mostra que um input confirmado não pode ser reaproveitado em outra fabricação incompatível.",
        executionMode: "request_real",
        ready: Boolean(previewDoubleSpend),
        prerequisiteMessage: previewDoubleSpend
          ? undefined
          : "Não há input já consumido na cadeia ativa do nó selecionado. Gere matéria-prima e consuma-a em um bloco antes de rodar este cenário.",
        supportTexts: [
          "Este cenário representa o double spend adaptado ao supply chain.",
          "Se o backend responder 4xx, a UI marca o teste como aprovado, não como erro genérico.",
        ],
        expectedImpactSummary:
          "Como a request deve ser rejeitada antes da confirmação, a altura e o hash do topo da cadeia ativa tendem a permanecer os mesmos.",
        preparedRequests: previewDoubleSpend
          ? [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewDoubleSpend }]
          : [{ label: "Pré-condição ausente", payload: { motivo: "Nenhum insumo consumido disponível" } }],
        contextSections: [
          {
            title: "Estado operacional",
            rows: [
              { label: "Nó ativo", value: noAtivo.nome },
              { label: "Altura atual", value: String(entradaAtiva?.estado?.altura_cadeia ?? "-") },
              { label: "Inputs consumidos encontrados", value: String(resumoCadeia.eventosConsumidos.length) },
            ],
          },
          {
            title: "Insumo em disputa",
            description: "O frontend tenta escolher um insumo já confirmado e consumido para montar o conflito.",
            rows: [
              { label: "Input escolhido", value: eventoConsumido?.evento.event_id ?? "nenhum", mono: true },
              { label: "Item relacionado", value: formatarEvento(eventoConsumido) },
              { label: "Já consumido", value: eventoConsumido ? "sim" : "não" },
              { label: "Bloco relacionado", value: formatarItemCadeia(eventoConsumido) },
            ],
          },
        ],
        run: () => {
          if (!previewDoubleSpend) {
            return Promise.resolve({
              scenarioId: "double-spend-adaptado",
              scenarioName: "Reutilização de insumo já consumido",
              targetNodes: [noAtivo.nome],
              executionMode: "request_real",
              statusLabel: "erro inesperado",
              tone: "error",
              expectedBehavior: "O backend deveria rejeitar reutilização de insumo consumido.",
              observedBehavior: "Pré-condição ausente no frontend.",
              finalInterpretation: "Não há input já consumido disponível para montar o double spend adaptado neste nó.",
              highlights: ["pré-condição ausente"],
              requests: [{ label: "Pré-condição ausente", payload: { motivo: "Nenhum insumo consumido disponível" } }],
              responses: [{ label: "Resultado local", payload: { motivo: "Cenário indisponível" } }],
              impact: null,
            })
          }

          return executarRejeicaoEsperada({
            scenarioId: "double-spend-adaptado",
            scenarioName: "Reutilização de insumo já consumido",
            expectedBehavior: "Rejeição do backend e nenhuma mudança na cadeia ativa.",
            requests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewDoubleSpend }],
            targetNodes: [noAtivo.nome],
            action: () => enviarEvento(noAtivo, previewDoubleSpend, false),
            acceptedInterpretation: "Teste falhou: o backend aceitou uma reutilização de input que deveria ser barrada para evitar double spend no domínio.",
            rejectedInterpretation: "Backend rejeitou como esperado: o input_id já havia sido consumido e não pôde sustentar uma segunda fabricação.",
          })
        },
      },
      {
        id: "produto-simples-sem-inputs",
        groupId: "domain_validation",
        groupTitle: "Validação do domínio",
        groupDescription: "Regras de negócio que o backend precisa rejeitar imediatamente.",
        categoryLabel: "Validação do domínio",
        severity: "validation",
        name: "Produto simples sem input_ids",
        shortDescription: "Força uma fabricação sem qualquer insumo anterior.",
        description:
          "Produto simples depende de pelo menos um input válido. A API deve impedir que um item intermediário nasça sem origem rastreável.",
        expectedBehavior: "A API deve responder com rejeição funcional do backend.",
        importance: "Este cenário valida a rastreabilidade mínima do domínio e evita criação artificial de itens sem origem.",
        executionMode: "request_real",
        ready: true,
        supportTexts: [
          "Este cenário cobre a regra de composição mínima do produto simples.",
          "A falha esperada é uma rejeição funcional, não uma quebra do frontend.",
        ],
        expectedImpactSummary:
          "Como a requisição é inválida no domínio, o resultado esperado é rejeição sem produção de novos blocos ou alteração de ponta.",
        preparedRequests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewSemInput }],
        contextSections: [
          {
            title: "Dados usados",
            rows: [
              { label: "Nó ativo", value: noAtivo.nome },
              { label: "Altura atual", value: String(entradaAtiva?.estado?.altura_cadeia ?? "-") },
              { label: "Payload preparado", value: "produto simples com input_ids vazio" },
            ],
          },
        ],
        run: () =>
          executarRejeicaoEsperada({
            scenarioId: "produto-simples-sem-inputs",
            scenarioName: "Produto simples sem input_ids",
            expectedBehavior: "Rejeição do backend por ausência de insumos obrigatórios.",
            requests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewSemInput }],
            targetNodes: [noAtivo.nome],
            action: () => enviarEvento(noAtivo, previewSemInput, false),
            acceptedInterpretation: "Teste falhou: a API aceitou um produto simples sem input_ids, quebrando a regra de origem do item.",
            rejectedInterpretation: "Backend rejeitou como esperado: produto simples precisa apontar para pelo menos um input confirmado ou válido.",
          }),
      },
      {
        id: "entity-kind-incoerente",
        groupId: "domain_validation",
        groupTitle: "Validação do domínio",
        groupDescription: "Regras de negócio que o backend precisa rejeitar imediatamente.",
        categoryLabel: "Validação do domínio",
        severity: "validation",
        name: "Entity kind incoerente",
        shortDescription: "Combina event_type e entity_kind incompatíveis no mesmo payload.",
        description:
          "O contrato básico do evento fica inconsistente quando o tipo do evento diz uma coisa e a entidade modelada diz outra. A rejeição deve acontecer cedo.",
        expectedBehavior: "O backend deve rejeitar a inconsistência estrutural do evento.",
        importance: "Este cenário comprova que a API valida coerência interna do payload antes de prosseguir para mempool ou consenso.",
        executionMode: "request_real",
        ready: true,
        supportTexts: [
          "Este cenário valida o contrato semântico do evento.",
          "A banca consegue ver que o backend não aceita combinações arbitrárias de campos.",
        ],
        expectedImpactSummary:
          "Rejeição estrutural deve ocorrer sem gerar efeito na blockchain ativa.",
        preparedRequests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewIncoerente }],
        contextSections: [
          {
            title: "Inconsistência intencional",
            rows: [
              { label: "event_type", value: previewIncoerente.event_type },
              { label: "entity_kind", value: previewIncoerente.entity_kind },
              { label: "Por que é inválido", value: "cadastro de matéria-prima não pode representar simple_product" },
            ],
          },
        ],
        run: () =>
          executarRejeicaoEsperada({
            scenarioId: "entity-kind-incoerente",
            scenarioName: "Entity kind incoerente",
            expectedBehavior: "Rejeição por incoerência entre tipo de evento e entidade modelada.",
            requests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: previewIncoerente }],
            targetNodes: [noAtivo.nome],
            action: () => enviarEvento(noAtivo, previewIncoerente, false),
            acceptedInterpretation: "Teste falhou: a API aceitou um payload semanticamente incoerente.",
            rejectedInterpretation: "Backend rejeitou como esperado: o payload contradiz a modelagem de evento do domínio.",
          }),
      },
      {
        id: "payload-invalido",
        groupId: "domain_validation",
        groupTitle: "Validação do domínio",
        groupDescription: "Regras de negócio que o backend precisa rejeitar imediatamente.",
        categoryLabel: "Validação do domínio",
        severity: "validation",
        name: "Payload inválido",
        shortDescription: "Envia um JSON propositalmente insuficiente para disparar a validação mais básica da API.",
        description:
          "Este teste não depende das regras de negócio específicas do supply chain; ele valida o tratamento de payload estruturalmente inválido na borda HTTP.",
        expectedBehavior: "A API deve responder com erro de payload inválido ou rejeição equivalente.",
        importance: "Mostra a primeira linha de defesa da API antes mesmo da lógica de domínio ou consenso.",
        executionMode: "request_real",
        ready: true,
        supportTexts: [
          "Este cenário distingue rejeição esperada da API de erro inesperado do sistema.",
          "É útil para demonstrar robustez do endpoint /eventos.",
        ],
        expectedImpactSummary: "A rejeição ocorre antes da blockchain; o topo e a altura tendem a ficar inalterados.",
        preparedRequests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: { event_id: "quebrado" } }],
        contextSections: [
          {
            title: "Validação de borda",
            rows: [
              { label: "Nó ativo", value: noAtivo.nome },
              { label: "Tipo do erro esperado", value: "payload_invalido ou rejeição HTTP equivalente" },
              { label: "Parte do sistema testada", value: "camada HTTP / validação inicial" },
            ],
          },
        ],
        run: () =>
          executarRejeicaoEsperada({
            scenarioId: "payload-invalido",
            scenarioName: "Payload inválido",
            expectedBehavior: "Rejeição da API na borda HTTP.",
            requests: [{ label: `POST /eventos em ${noAtivo.nome}`, payload: { event_id: "quebrado" } }],
            targetNodes: [noAtivo.nome],
            action: () => enviarPayloadInvalido(noAtivo, { event_id: "quebrado" }),
            acceptedInterpretation: "Teste falhou: a API aceitou um payload estruturalmente inválido.",
            rejectedInterpretation: "Backend rejeitou como esperado: o payload não atende ao contrato mínimo do endpoint /eventos.",
          }),
      },
      {
        id: "corrida-mesmo-insumo",
        groupId: "domain_security",
        groupTitle: "Segurança do domínio",
        groupDescription: "Cenários em que dois atores tentam competir pelo mesmo insumo antes da confirmação final em bloco.",
        categoryLabel: "Segurança do domínio",
        severity: "security",
        name: "Tentativa concorrente de uso do mesmo insumo",
        shortDescription: "Dispara duas fabricações concorrentes com o mesmo input_id em nós diferentes.",
        description:
          "Aqui o objetivo é mostrar o que acontece antes do consenso: dois nós podem receber histórias concorrentes para o mesmo insumo. A cadeia ativa não deve consolidar as duas ao mesmo tempo.",
        expectedBehavior: "Pode haver aceitação local concorrente, mas sem impacto imediato na cadeia ativa.",
        importance: "Este cenário explica a diferença entre validação de domínio local e resolução final via blockchain/consenso.",
        executionMode: "simulacao_real",
        ready: Boolean(previewCorridaAlpha && previewCorridaBeta && noConcorrente),
        prerequisiteMessage:
          previewCorridaAlpha && previewCorridaBeta && noConcorrente
            ? undefined
            : "É preciso ter um segundo nó online e ao menos uma matéria-prima confirmada ainda não consumida na cadeia ativa.",
        supportTexts: [
          "Este cenário simula concorrência real entre nós usando requests reais.",
          "Mesmo que as APIs aceitem localmente, a blockchain ativa não deveria confirmar duas histórias incompatíveis para o mesmo insumo.",
        ],
        expectedImpactSummary:
          "Como esta simulação não minera blocos, o efeito esperado é conflito local ou de mempool, sem alterar a cadeia ativa.",
        preparedRequests:
          previewCorridaAlpha && previewCorridaBeta
            ? [
                { label: `POST /eventos em ${noAtivo.nome}`, payload: previewCorridaAlpha },
                { label: `POST /eventos em ${noConcorrente?.nome ?? "segundo nó"}`, payload: previewCorridaBeta },
              ]
            : [{ label: "Pré-condição ausente", payload: { motivo: "Sem matéria-prima disponível ou sem segundo nó online" } }],
        contextSections: [
          {
            title: "Insumo selecionado",
            description: "O frontend prioriza matéria-prima confirmada e ainda disponível para criar a corrida concorrente.",
            rows: [
              { label: "Input escolhido", value: materiaPrimaDisponivel?.evento.event_id ?? "nenhum", mono: true },
              { label: "Item relacionado", value: formatarEvento(materiaPrimaDisponivel) },
              { label: "Consumido antes do teste", value: materiaPrimaDisponivel ? "não" : "indisponível" },
              { label: "Bloco atual", value: formatarItemCadeia(materiaPrimaDisponivel) },
            ],
          },
          {
            title: "Nós participantes",
            rows: [
              { label: "Nó primário", value: noAtivo.nome },
              { label: "Nó concorrente", value: noConcorrente?.nome ?? "nenhum" },
              { label: "Relevância", value: "expõe conflito antes do consenso fechar a história canônica" },
            ],
          },
        ],
        run: async () => {
          if (!previewCorridaAlpha || !previewCorridaBeta || !noConcorrente) {
            return {
              scenarioId: "corrida-mesmo-insumo",
              scenarioName: "Tentativa concorrente de uso do mesmo insumo",
              targetNodes: [noAtivo.nome],
              executionMode: "simulacao_real",
              statusLabel: "erro inesperado",
              tone: "error",
              expectedBehavior: "Concorrência controlada entre dois nós.",
              observedBehavior: "Pré-condição ausente para montar a corrida.",
              finalInterpretation: "Falta matéria-prima disponível confirmada ou um segundo nó online para executar a simulação.",
              highlights: ["pré-condição ausente"],
              requests: [{ label: "Pré-condição ausente", payload: { motivo: "Sem matéria-prima disponível ou segundo nó" } }],
              responses: [{ label: "Resultado local", payload: { motivo: "Simulação indisponível" } }],
              impact: null,
            }
          }

          const antes = await capturarCluster(nos, noAtivo.id)

          try {
            const respostas = await Promise.allSettled([
              enviarEvento(noAtivo, previewCorridaAlpha, false),
              enviarEvento(noConcorrente, previewCorridaBeta, false),
            ])
            const depois = await capturarCluster(nos, noAtivo.id)
            const aceitos = respostas.filter((item) => item.status === "fulfilled").length
            const rejeitados = respostas.filter((item) => item.status === "rejected").length
            const semMudancaCadeia =
              obterEntrada(antes, noAtivo.id)?.estado?.hash_ponta === obterEntrada(depois, noAtivo.id)?.estado?.hash_ponta &&
              obterEntrada(antes, noAtivo.id)?.estado?.altura_cadeia === obterEntrada(depois, noAtivo.id)?.estado?.altura_cadeia

            let statusLabel = "teste aprovado"
            let tone: ScenarioTone = "success"
            let observedBehavior = "Conflito concorrente simulado sem alterar a cadeia ativa."
            let finalInterpretation =
              "A simulação mostrou disputa pelo mesmo input_id antes da confirmação em bloco. O consenso ainda seria necessário para decidir qual ramo sobreviveria se houvesse mineração."

            if (!semMudancaCadeia) {
              statusLabel = "teste falhou"
              tone = "error"
              observedBehavior = "A cadeia ativa mudou durante um cenário que deveria ficar restrito à borda da rede."
              finalInterpretation =
                "A simulação produziu impacto inesperado na cadeia ativa. Vale revisar se havia mineração em paralelo no cluster durante o teste."
            } else if (aceitos === 2) {
              observedBehavior = "Dois eventos concorrentes foram aceitos localmente em nós distintos."
              finalInterpretation =
                "Conflito simulado sem impacto na cadeia ativa: o backend aceitou localmente duas histórias concorrentes, reforçando que a proteção final depende da cadeia/consenso, não só da API isolada."
            } else if (aceitos === 1 && rejeitados === 1) {
              observedBehavior = "Um nó aceitou e o outro rejeitou a corrida concorrente."
              finalInterpretation =
                "O conflito foi parcialmente barrado antes mesmo do consenso. Ainda assim, o cenário continua válido para demonstrar proteção adicional na borda do sistema."
            } else if (rejeitados === 2) {
              observedBehavior = "As duas requests foram rejeitadas localmente."
              finalInterpretation =
                "A API interceptou o conflito já na borda. Isso demonstra proteção forte, mas também reduz a chance de observar o conflito chegar à blockchain."
            }

            return {
              scenarioId: "corrida-mesmo-insumo",
              scenarioName: "Tentativa concorrente de uso do mesmo insumo",
              targetNodes: [noAtivo.nome, noConcorrente.nome],
              executionMode: "simulacao_real",
              statusLabel,
              tone,
              httpStatus: `${aceitos} aceitas / ${rejeitados} rejeitadas`,
              expectedBehavior: "Concorrência na borda sem consolidar duas histórias incompatíveis na cadeia ativa.",
              observedBehavior,
              finalInterpretation,
              highlights: [
                aceitos > 0 ? "aceitação local" : "sem aceitação local",
                semMudancaCadeia ? "sem impacto na cadeia" : "impacto inesperado",
              ],
              requests: [
                { label: `POST /eventos em ${noAtivo.nome}`, payload: previewCorridaAlpha },
                { label: `POST /eventos em ${noConcorrente.nome}`, payload: previewCorridaBeta },
              ],
              responses: respostas.map((item, indice) => ({
                label: indice === 0 ? `Resposta de ${noAtivo.nome}` : `Resposta de ${noConcorrente.nome}`,
                payload: item.status === "fulfilled" ? item.value : serializarErro(item.reason),
              })),
              impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
            }
          } finally {
            await revalidarCluster()
          }
        },
      },
      {
        id: "cadeia-alternativa-inspecao",
        groupId: "blockchain_consensus",
        groupTitle: "Consenso da blockchain",
        groupDescription: "Cenários focados em forks, reorganização e disputa entre cadeias concorrentes.",
        categoryLabel: "Consenso da blockchain",
        severity: "consensus",
        name: "Cadeia alternativa / conflito de blocos",
        shortDescription: "Inspeciona o estado real do cluster para verificar forks, pontas divergentes e reorganizações recentes.",
        description:
          "Nem todo cenário de consenso depende de gerar novos eventos. Este painel também serve para observar, com dados reais, se a rede está sincronizada ou se há cadeias alternativas ativas no momento.",
        expectedBehavior: "A UI deve detectar e explicar divergência de cadeia, fork ou reorganização quando os sinais existirem.",
        importance:
          "Este cenário conecta a teoria de consenso com a telemetria real do projeto, usando apenas GETs nas APIs já existentes do cluster.",
        executionMode: "inspecao_rede",
        ready: true,
        supportTexts: [
          "Esta execução não cria dados novos; ela lê estado, rede, cadeia e demonstração de cada nó.",
          "Se não houver conflito ativo agora, a UI deixa isso explícito em vez de fingir um fork inexistente.",
        ],
        expectedImpactSummary:
          "Como é uma inspeção, não há mudança esperada na cadeia. O valor está em identificar o estado atual do consenso do cluster.",
        preparedRequests: nos.map((no) => ({
          label: `GET /estado, /cadeia, /rede e /demonstracao em ${no.nome}`,
          payload: { node: no.nome, url: no.url, endpoints: ["/estado", "/cadeia", "/rede", "/demonstracao"] },
        })),
        contextSections: [
          {
            title: "Estado atual do cluster",
            rows: [
              { label: "Nós online", value: String(painelCluster.resumo.nosOnline) },
              { label: "Altura de referência", value: String(painelCluster.resumo.alturaReferencia) },
              { label: "Hash de referência", value: encurtarHash(painelCluster.resumo.hashReferencia, 18) },
              { label: "Divergência atual", value: painelCluster.resumo.redeConsistente ? "não" : "sim" },
            ],
          },
        ],
        run: async () => {
          const snapshot = await capturarCluster(nos, noAtivo.id)
          const forkDetectado = snapshot.entradas.some((entrada) => entrada.demonstracao?.demonstracao.fork_detectado)
          const reorganizacaoDetectada = snapshot.entradas.some(
            (entrada) => entrada.demonstracao?.demonstracao.reorganizacao_detectada,
          )
          const divergencia = snapshot.painel.resumo.haDivergenciaHash || snapshot.painel.resumo.haDivergenciaAltura

          let tone: ScenarioTone = "info"
          const statusLabel = "inspeção concluída"
          let observedBehavior = "Nenhum fork ativo foi detectado no instante observado."
          let finalInterpretation =
            "A rede estava convergente no momento da leitura. Isso não invalida o cenário; apenas indica que não havia disputa visível na janela observada."

          if (reorganizacaoDetectada) {
            tone = "warning"
            observedBehavior = "Reorganização observada pela telemetria do cluster."
            finalInterpretation = "Reorganização observada: ao menos um nó reportou troca de cadeia ativa após disputa de consenso."
          } else if (forkDetectado || divergencia) {
            tone = "warning"
            observedBehavior = "Cadeia alternativa detectada por divergência de ponta ou flag de fork."
            finalInterpretation =
              "Cadeia alternativa detectada: o cluster não está totalmente convergente e a tela conseguiu representar o conflito de consenso com dados reais."
          }

          return {
            scenarioId: "cadeia-alternativa-inspecao",
            scenarioName: "Cadeia alternativa / conflito de blocos",
            targetNodes: nos.map((no) => no.nome),
            executionMode: "inspecao_rede",
            statusLabel,
            tone,
            expectedBehavior: "Ler e interpretar corretamente o estado atual de consenso da rede.",
            observedBehavior,
            finalInterpretation,
            highlights: [
              forkDetectado ? "fork detectado" : "sem fork explícito",
              reorganizacaoDetectada ? "reorganização" : "sem reorganização explícita",
            ],
            requests: nos.map((no) => ({
              label: `Leitura do cluster em ${no.nome}`,
              payload: { node: no.nome, endpoints: ["/estado", "/cadeia", "/rede", "/demonstracao"] },
            })),
            responses: snapshot.entradas.map((entrada) => ({
              label: `Snapshot de ${entrada.no.nome}`,
              payload: {
                estado: entrada.estado ?? null,
                demonstracao: entrada.demonstracao?.demonstracao ?? null,
                topo: entrada.cadeia?.cadeia_ativa.at(-1) ?? null,
              },
            })),
            impact: construirImpactoBlockchain(snapshot, snapshot, noAtivo.id),
          }
        },
      },
      {
        id: "ataque-51-simulado",
        groupId: "blockchain_consensus",
        groupTitle: "Consenso da blockchain",
        groupDescription: "Cenários focados em forks, reorganização e disputa entre cadeias concorrentes.",
        categoryLabel: "Consenso da blockchain",
        severity: "consensus",
        name: "Ataque de 51% (simulado)",
        shortDescription: "Reproduz, via frontend, a lógica central do script de gasto duplo com cadeia alternativa mais longa.",
        description:
          "O cenário cria uma matéria-prima controlada, produz dois ramos conflitantes usando o mesmo input_id e estende a cadeia alternativa com mais trabalho acumulado para simular um atacante com maioria computacional.",
        expectedBehavior:
          "O sistema deve expor o conflito entre cadeia honesta e alternativa, e a cadeia com mais trabalho pode prevalecer após a disputa.",
        importance:
          "Este é o cenário pedido explicitamente para a banca: ele mostra como o equivalente ao gasto duplo aparece no supply chain e como a regra de consenso reage quando uma cadeia concorrente cresce mais.",
        executionMode: "simulacao_real",
        ready: Boolean(noHonesto && noAlternativo),
        prerequisiteMessage:
          noHonesto && noAlternativo
            ? undefined
            : "São necessários pelo menos dois nós online com mineração disponível para executar a simulação de ataque de 51%.",
        supportTexts: [
          "A implementação usa apenas endpoints já existentes: POST /eventos, POST /demonstracao/minerar e GETs de inspeção.",
          "Quando a API não expõe todos os detalhes do fork, a UI mostra a melhor leitura possível com base em cadeia, estado, rede e demonstração.",
        ],
        expectedImpactSummary:
          "Este cenário tende a alterar a blockchain, criar conflito temporário e potencialmente reorganizar a cadeia ativa em favor do ramo com maior trabalho acumulado.",
        preparedRequests: [
          { label: `1. POST raiz em ${noHonesto?.nome ?? "nó honesto"}`, payload: previewRaizAtaque },
          { label: `2. POST produto honesto em ${noHonesto?.nome ?? "nó honesto"}`, payload: previewProdutoHonesto },
          { label: `3. POST produto alternativo em ${noAlternativo?.nome ?? "nó alternativo"}`, payload: previewProdutoMalicioso },
          { label: `4. POST extensão da cadeia alternativa em ${noAlternativo?.nome ?? "nó alternativo"}`, payload: previewExtensao },
        ],
        contextSections: [
          {
            title: "Participantes do ataque",
            rows: [
              { label: "Cadeia honesta", value: noHonesto?.nome ?? "nenhum" },
              { label: "Cadeia alternativa", value: noAlternativo?.nome ?? "nenhum" },
              { label: "Nó ativo para leitura", value: noAtivo.nome },
              { label: "Tipo de conflito", value: "mesmo input_id usado em dois ramos concorrentes" },
            ],
          },
          {
            title: "Objetos em disputa",
            description: "Os IDs abaixo serão criados especificamente para o sandbox, sem depender de um insumo pré-existente na API.",
            rows: [
              { label: "Insumo em disputa", value: previewRaizAtaque.event_id, mono: true },
              { label: "Produto honesto", value: previewProdutoHonesto.product_id },
              { label: "Produto concorrente", value: previewProdutoMalicioso.product_id },
              { label: "Extensão maliciosa", value: previewExtensao.product_id },
            ],
          },
        ],
        run: async () => {
          if (!noHonesto || !noAlternativo) {
            return {
              scenarioId: "ataque-51-simulado",
              scenarioName: "Ataque de 51% (simulado)",
              targetNodes: [noAtivo.nome],
              executionMode: "simulacao_real",
              statusLabel: "erro inesperado",
              tone: "error",
              expectedBehavior: "Disputa entre cadeia honesta e alternativa com dois mineradores.",
              observedBehavior: "Pré-condição ausente para mineração distribuída.",
              finalInterpretation: "O cluster atual não expõe dois nós mineráveis suficientes para executar a simulação completa do ataque.",
              highlights: ["limitação do cluster"],
              requests: [{ label: "Pré-condição ausente", payload: { motivo: "Menos de dois nós mineráveis" } }],
              responses: [{ label: "Resultado local", payload: { motivo: "Simulação indisponível" } }],
              impact: null,
            }
          }

          const antes = await capturarCluster(nos, noAtivo.id)
          const requests: ScenarioPayloadPreview[] = [
            { label: `1. POST raiz em ${noHonesto.nome}`, payload: previewRaizAtaque },
            { label: `2. POST produto honesto em ${noHonesto.nome}`, payload: previewProdutoHonesto },
            { label: `3. POST produto alternativo em ${noAlternativo.nome}`, payload: previewProdutoMalicioso },
            { label: `4. POST extensão maliciosa em ${noAlternativo.nome}`, payload: previewExtensao },
          ]
          const responses: ScenarioPayloadPreview[] = []

          try {
            const respostaRaiz = await enviarEvento(noHonesto, previewRaizAtaque, true)
            responses.push({ label: `Resposta raiz em ${noHonesto.nome}`, payload: respostaRaiz })

            const mineracaoRaiz = await minerarNo(noHonesto)
            responses.push({ label: `Mineração da raiz em ${noHonesto.nome}`, payload: mineracaoRaiz })

            if (!mineracaoRaiz.bloco) {
              throw new Error("A raiz foi enviada, mas a mineração inicial não retornou bloco confirmado.")
            }

            await esperarAlturaMinima(noAlternativo, mineracaoRaiz.bloco.index, 8)
            await esperar(2_000)

            const ramos = await Promise.allSettled([
              enviarEvento(noHonesto, previewProdutoHonesto, false),
              enviarEvento(noAlternativo, previewProdutoMalicioso, false),
            ])
            responses.push(
              { label: `Resposta do ramo honesto em ${noHonesto.nome}`, payload: ramos[0].status === "fulfilled" ? ramos[0].value : serializarErro(ramos[0].reason) },
              { label: `Resposta do ramo alternativo em ${noAlternativo.nome}`, payload: ramos[1].status === "fulfilled" ? ramos[1].value : serializarErro(ramos[1].reason) },
            )

            const mineracoesConcorrentes = await Promise.allSettled([minerarNo(noHonesto), minerarNo(noAlternativo)])
            responses.push(
              {
                label: `Mineração concorrente em ${noHonesto.nome}`,
                payload: mineracoesConcorrentes[0].status === "fulfilled" ? mineracoesConcorrentes[0].value : serializarErro(mineracoesConcorrentes[0].reason),
              },
              {
                label: `Mineração concorrente em ${noAlternativo.nome}`,
                payload: mineracoesConcorrentes[1].status === "fulfilled" ? mineracoesConcorrentes[1].value : serializarErro(mineracoesConcorrentes[1].reason),
              },
            )

            await esperar(3_000)

            const respostaExtensao = await enviarEvento(noAlternativo, previewExtensao, false)
            responses.push({ label: `Resposta da extensão em ${noAlternativo.nome}`, payload: respostaExtensao })

            const mineracaoExtensao = await minerarNo(noAlternativo)
            responses.push({ label: `Mineração da extensão em ${noAlternativo.nome}`, payload: mineracaoExtensao })

            await esperar(4_000)

            const depois = await capturarCluster(nos, noAtivo.id)
            const honestoNaReferencia = existeEventoNaReferencia(depois, previewProdutoHonesto.event_id)
            const alternativoNaReferencia = existeEventoNaReferencia(depois, previewProdutoMalicioso.event_id)
            const extensaoNaReferencia = existeEventoNaReferencia(depois, previewExtensao.event_id)
            const nosComHonesto = localizarEventoNosNos(depois, previewProdutoHonesto.event_id)
            const nosComAlternativo = localizarEventoNosNos(depois, previewProdutoMalicioso.event_id)
            const reorg = depois.entradas.some((entrada) => entrada.demonstracao?.demonstracao.reorganizacao_detectada)
            const fork = depois.entradas.some((entrada) => entrada.demonstracao?.demonstracao.fork_detectado)

            let tone: ScenarioTone = "success"
            let statusLabel = "teste aprovado"
            let observedBehavior = "Ataque simulado executado de ponta a ponta."
            let finalInterpretation =
              "A rede executou um cenário real de gasto duplo adaptado ao supply chain usando apenas endpoints existentes do projeto."

            if (alternativoNaReferencia && extensaoNaReferencia && !honestoNaReferencia) {
              observedBehavior = "A cadeia alternativa ficou como referência após ganhar mais trabalho acumulado."
              finalInterpretation =
                "Ataque de 51% representado com sucesso: a cadeia alternativa reescreveu a história do insumo em disputa e passou a dominar a referência observada do cluster."
            } else if (honestoNaReferencia && !alternativoNaReferencia) {
              tone = "warning"
              statusLabel = "resultado parcial"
              observedBehavior = "A cadeia honesta permaneceu como referência mesmo após a tentativa de extensão alternativa."
              finalInterpretation =
                "A simulação foi executada, mas a API não expôs uma reorganização favorável à cadeia alternativa na janela observada. O conflito ainda foi demonstrado, porém o efeito clássico do 51% não apareceu por completo."
            } else if (fork || reorg) {
              tone = "warning"
              statusLabel = "resultado parcial"
              observedBehavior = "Fork ou reorganização foram observados, mas a cadeia vencedora não ficou totalmente clara no snapshot final."
              finalInterpretation =
                "O conflito de consenso foi real, porém o estado final da referência do cluster não permitiu atribuir com clareza a vitória ao ramo alternativo ou honesto."
            } else if (!nosComAlternativo.length && !nosComHonesto.length) {
              tone = "warning"
              statusLabel = "resultado parcial"
              observedBehavior = "Os eventos conflitantes não apareceram de forma confirmada na leitura final do cluster."
              finalInterpretation =
                "A simulação foi disparada, mas a API não deixou rastros suficientes na cadeia ativa para fechar a leitura. Ainda assim, os passos executados seguiram a lógica do script real de ataque."
            }

            return {
              scenarioId: "ataque-51-simulado",
              scenarioName: "Ataque de 51% (simulado)",
              targetNodes: [noHonesto.nome, noAlternativo.nome],
              executionMode: "simulacao_real",
              statusLabel,
              tone,
              httpStatus: "fluxo multi-etapas",
              expectedBehavior:
                "Representar honest chain vs alternative chain, manter apenas uma história canônica e, se a cadeia alternativa acumular mais trabalho, expor reorganização ou mudança de referência.",
              observedBehavior,
              finalInterpretation,
              highlights: [
                alternativoNaReferencia ? "cadeia alternativa na referência" : "cadeia alternativa não dominante",
                reorg ? "reorganização observada" : "sem reorganização explícita",
                fork ? "fork detectado" : "sem fork explícito",
              ],
              requests,
              responses: [
                ...responses,
                {
                  label: "Leitura final do conflito",
                  payload: {
                    cadeia_honesta_nos_nos: nosComHonesto,
                    cadeia_alternativa_nos_nos: nosComAlternativo,
                    honesto_na_referencia: honestoNaReferencia,
                    alternativo_na_referencia: alternativoNaReferencia,
                    extensao_alternativa_na_referencia: extensaoNaReferencia,
                    fork_detectado: fork,
                    reorganizacao_detectada: reorg,
                  },
                },
              ],
              impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
            }
          } catch (erro) {
            const depois = await capturarCluster(nos, noAtivo.id)

            return {
              scenarioId: "ataque-51-simulado",
              scenarioName: "Ataque de 51% (simulado)",
              targetNodes: [noHonesto.nome, noAlternativo.nome],
              executionMode: "simulacao_real",
              statusLabel: "erro inesperado",
              tone: "error",
              httpStatus: erro instanceof ErroApi ? `HTTP ${erro.status}` : "fluxo interrompido",
              expectedBehavior: "Executar conflito entre cadeia honesta e alternativa até a disputa de consenso.",
              observedBehavior: "A simulação foi interrompida antes do término completo.",
              finalInterpretation:
                "O frontend conseguiu iniciar o ataque, mas o cluster ou a API não permitiram completar todas as etapas. A resposta registrada abaixo mostra o ponto exato da interrupção.",
              highlights: ["execução interrompida"],
              requests,
              responses: [...responses, { label: "Falha do fluxo", payload: serializarErro(erro) }],
              impact: construirImpactoBlockchain(antes, depois, noAtivo.id),
            }
          } finally {
            await revalidarCluster()
          }
        },
      },
    ]

  const cenarioSelecionado = cenarios.find((cenario) => cenario.id === cenarioSelecionadoId) ?? cenarios[0]

  const secoesCenarios: ScenarioCategorySection[] = ["domain_validation", "domain_security", "blockchain_consensus"].reduce(
    (acumulado, grupo) => {
      const itens = cenarios.filter((cenario) => cenario.groupId === grupo)
      if (!itens.length) {
        return acumulado
      }

      acumulado.push({
        id: grupo,
        title: itens[0].groupTitle,
        description: itens[0].groupDescription,
        items: itens.map((cenario) => ({
          id: cenario.id,
          name: cenario.name,
          categoryLabel: cenario.categoryLabel,
          severity: cenario.severity,
          shortDescription: cenario.shortDescription,
          expectedBehavior: cenario.expectedBehavior,
          ready: cenario.ready,
          prerequisiteMessage: cenario.prerequisiteMessage,
        })),
      })

      return acumulado
    },
    [] as ScenarioCategorySection[],
  )

  async function executarSelecionado() {
    if (!cenarioSelecionado) {
      return
    }

    setExecutandoId(cenarioSelecionado.id)
    try {
      const resultado = await cenarioSelecionado.run()
      setUltimoResultado(resultado)
    } finally {
      setExecutandoId(null)
    }
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Laboratório de Testes"
        descricao="Sandbox operacional para validar regras do domínio, segurança de consumo único e cenários de consenso da blockchain com requests reais, inspeções reais e simulações reais baseadas no backend atual."
      />

      <div className="grid gap-5 xl:grid-cols-[0.88fr_1.12fr]">
        <ScenarioCategoryList
          sections={secoesCenarios}
          selectedId={cenarioSelecionado.id}
          onSelect={(id) => {
            setCenarioSelecionadoId(id)
            setSeedCenario(Date.now())
          }}
        />

        <ScenarioExecutionPanel
          scenario={cenarioSelecionado}
          running={executandoId === cenarioSelecionado.id}
          onRun={executarSelecionado}
          preparedRequests={cenarioSelecionado.preparedRequests}
          result={ultimoResultado}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
        <ScenarioContextCard sections={cenarioSelecionado.contextSections} />
        <ScenarioBlockchainImpact
          impact={ultimoResultado?.scenarioId === cenarioSelecionado.id ? ultimoResultado.impact : null}
          expectedSummary={cenarioSelecionado.expectedImpactSummary}
        />
      </div>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold tracking-tight text-slate-900">Painel didático do cenário</p>
            <p className="mt-1 text-sm text-slate-500">
              A leitura abaixo reforça o que a banca deve observar no estado atual do cenário selecionado.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
            atualizado em {formatarData(new Date().toISOString())}
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Por que importa</p>
            <p className="mt-2 text-sm text-slate-700">{cenarioSelecionado.importance}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">O que está sendo testado</p>
            <p className="mt-2 text-sm text-slate-700">{cenarioSelecionado.expectedBehavior}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Severidade</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{cenarioSelecionado.categoryLabel}</p>
            <p className="mt-1 text-sm text-slate-500">{descricaoSeveridade(cenarioSelecionado.severity)}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
