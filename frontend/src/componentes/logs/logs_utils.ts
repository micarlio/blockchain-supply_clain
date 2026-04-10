import type { LogSistema } from "../../lib/api/tipos"

type OpcaoFiltro = {
  value: string
  label: string
}

function comporTextoBusca(log: LogSistema) {
  return [
    log.timestamp,
    log.level,
    log.node_id,
    log.category,
    log.message,
    log.endpoint,
    log.method,
    log.request_id,
    JSON.stringify(log.context ?? {}),
    JSON.stringify(log.request_payload ?? null),
    JSON.stringify(log.response_payload ?? null),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function lerCampoString(objeto: unknown, chave: string) {
  if (!objeto || typeof objeto !== "object") {
    return null
  }

  const valor = (objeto as Record<string, unknown>)[chave]
  return typeof valor === "string" && valor.trim().length > 0 ? valor : null
}

function lerCampoObjeto(objeto: unknown, chave: string) {
  if (!objeto || typeof objeto !== "object") {
    return null
  }

  const valor = (objeto as Record<string, unknown>)[chave]
  return valor && typeof valor === "object" ? (valor as Record<string, unknown>) : null
}

export function obterHashRelacionadaLog(log: LogSistema) {
  const blocoResposta = lerCampoObjeto(log.response_payload, "bloco")

  return (
    lerCampoString(log.context, "block_hash")
    ?? lerCampoString(log.context, "hash_relacionado")
    ?? lerCampoString(log.context, "previous_hash")
    ?? lerCampoString(log.response_payload, "block_hash")
    ?? lerCampoString(blocoResposta, "block_hash")
  )
}

function assinaturaFallback(log: LogSistema) {
  return [log.node_id, log.event_type ?? log.category, log.request_id ?? log.timestamp, log.message].join(":")
}

export function contarLogsDistintos(
  logs: LogSistema[],
  obterAssinatura: (log: LogSistema) => string | null,
) {
  const assinaturas = new Set<string>()

  for (const log of logs) {
    assinaturas.add(obterAssinatura(log) ?? assinaturaFallback(log))
  }

  return assinaturas.size
}

export function filtrarLogs(
  logs: LogSistema[],
  {
    nodeId,
    category,
    endpoint,
    level,
    search,
  }: {
    nodeId: string
    category: string
    endpoint: string
    level: string
    search: string
  },
) {
  const buscaNormalizada = search.trim().toLowerCase()

  return logs.filter((log) => {
    if (nodeId !== "todos" && log.node_id !== nodeId) {
      return false
    }
    if (category !== "todos" && log.category !== category) {
      return false
    }
    if (endpoint !== "todos" && log.endpoint !== endpoint) {
      return false
    }
    if (level !== "todos" && log.level !== level) {
      return false
    }
    if (buscaNormalizada && !comporTextoBusca(log).includes(buscaNormalizada)) {
      return false
    }

    return true
  })
}

export const OPCOES_CATEGORIA_LOGS: OpcaoFiltro[] = [
  { value: "todos", label: "Todos" },
  { value: "api", label: "API" },
  { value: "mineracao", label: "Mineração" },
  { value: "consenso", label: "Consenso" },
  { value: "validacao", label: "Validação" },
  { value: "rede_kafka", label: "Rede / Kafka" },
  { value: "testes", label: "Testes" },
]

export const OPCOES_NIVEL_LOGS: OpcaoFiltro[] = [
  { value: "todos", label: "Todos" },
  { value: "INFO", label: "INFO" },
  { value: "WARN", label: "WARN" },
  { value: "ERROR", label: "ERROR" },
  { value: "DEBUG", label: "DEBUG" },
]

export const ENDPOINTS_CONHECIDOS_LOGS = [
  "/estado",
  "/eventos",
  "/cadeia",
  "/mempool",
  "/rede",
  "/demonstracao",
  "/demonstracao/minerar",
  "/rastreabilidade/{identificador}",
  "/configuracao/no",
  "/configuracao/rede",
  "/memoria/limpar",
  "/testes/cenarios",
  "/testes/cenarios/{scenario_id}",
  "/testes/executar/{scenario_id}",
]
