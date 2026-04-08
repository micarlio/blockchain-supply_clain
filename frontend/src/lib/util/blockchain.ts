import type { BlocoBlockchain, EventoBlockchain, TipoEvento } from "../api/tipos"

const DESCRICOES_EVENTO: Record<TipoEvento, { singular: string; plural: string }> = {
  CADASTRAR_MATERIA_PRIMA: {
    singular: "materia-prima registrada",
    plural: "materias-primas registradas",
  },
  FABRICAR_PRODUTO_SIMPLES: {
    singular: "produto simples fabricado",
    plural: "produtos simples fabricados",
  },
  FABRICAR_PRODUTO_COMPOSTO: {
    singular: "produto composto confirmado",
    plural: "produtos compostos confirmados",
  },
}

export type ItemResumoSemantico = {
  tipo: TipoEvento
  quantidade: number
  descricao: string
}

export type EstadoIntegridadeBloco = {
  hashPresente: boolean
  previousHashPresente: boolean
  noncePresente: boolean
  dificuldadePresente: boolean
  dataHashPresente: boolean
  timestampValido: boolean
  contagemEventosValida: boolean
  encadeamentoConsistente: boolean
  dadosBlocoPresentes: boolean
  estruturaValida: boolean
  hashAtendeDificuldade: boolean | null
}

function pluralizar(quantidade: number, singular: string, plural: string) {
  return `${quantidade} ${quantidade === 1 ? singular : plural}`
}

export function totalEventosConfirmados(blocos: BlocoBlockchain[]) {
  return blocos.reduce((total, bloco) => {
    if (typeof bloco.event_count === "number") {
      return total + bloco.event_count
    }
    return total + (bloco.events?.length ?? 0)
  }, 0)
}

export function gerarResumoSemantico(bloco: BlocoBlockchain): ItemResumoSemantico[] {
  const contagem = bloco.events.reduce(
    (acumulado, evento) => {
      acumulado[evento.event_type] += 1
      return acumulado
    },
    {
      CADASTRAR_MATERIA_PRIMA: 0,
      FABRICAR_PRODUTO_SIMPLES: 0,
      FABRICAR_PRODUTO_COMPOSTO: 0,
    } as Record<TipoEvento, number>,
  )

  const itens = (Object.keys(contagem) as TipoEvento[])
    .filter((tipo) => contagem[tipo] > 0)
    .map((tipo) => {
      const quantidade = contagem[tipo]
      const descricoes = DESCRICOES_EVENTO[tipo]
      return {
        tipo,
        quantidade,
        descricao: pluralizar(quantidade, descricoes.singular, descricoes.plural),
      }
    })

  return itens
}

export function textoResumoSemantico(bloco: BlocoBlockchain) {
  const itens = gerarResumoSemantico(bloco)
  if (itens.length === 0) {
    return "Sem eventos de supply chain neste bloco"
  }

  return itens.map((item) => item.descricao).join(" • ")
}

export function obterIdentificadorRastreabilidade(evento: EventoBlockchain) {
  if (evento.product_id && evento.product_id.trim().length > 0) {
    return evento.product_id
  }
  if (evento.event_id && evento.event_id.trim().length > 0) {
    return evento.event_id
  }
  if (evento.input_ids.length > 0) {
    return evento.input_ids[0]
  }
  return null
}

export function construirLinkRastreabilidade(identificador: string | null) {
  if (!identificador) {
    return null
  }
  return `/rastreabilidade?identificador=${encodeURIComponent(identificador)}`
}

export function avaliarIntegridadeBloco(
  bloco: BlocoBlockchain,
  blocosConhecidos: BlocoBlockchain[],
): EstadoIntegridadeBloco {
  const hashPresente = typeof bloco.block_hash === "string" && bloco.block_hash.trim().length > 0
  const previousHashPresente =
    typeof bloco.previous_hash === "string" && bloco.previous_hash.trim().length > 0
  const noncePresente = typeof bloco.nonce === "number"
  const dificuldadePresente = typeof bloco.difficulty === "number"
  const dataHashPresente = typeof bloco.data_hash === "string" && bloco.data_hash.trim().length > 0
  const timestampValido = !Number.isNaN(new Date(bloco.timestamp).getTime())
  const contagemEventosValida =
    Array.isArray(bloco.events) &&
    typeof bloco.event_count === "number" &&
    bloco.event_count >= 0 &&
    bloco.event_count === bloco.events.length

  const blocoGenesis = bloco.index === 0
  const blocoAnterior = blocosConhecidos.find((item) => item.block_hash === bloco.previous_hash)
  const encadeamentoConsistente = blocoGenesis || Boolean(blocoAnterior)

  const dadosBlocoPresentes =
    hashPresente && previousHashPresente && noncePresente && dificuldadePresente && dataHashPresente

  const estruturaValida =
    typeof bloco.index === "number" &&
    bloco.index >= 0 &&
    dadosBlocoPresentes &&
    timestampValido &&
    contagemEventosValida &&
    encadeamentoConsistente

  const hashAtendeDificuldade =
    hashPresente && dificuldadePresente
      ? bloco.block_hash.startsWith("0".repeat(Math.max(bloco.difficulty, 0)))
      : null

  return {
    hashPresente,
    previousHashPresente,
    noncePresente,
    dificuldadePresente,
    dataHashPresente,
    timestampValido,
    contagemEventosValida,
    encadeamentoConsistente,
    dadosBlocoPresentes,
    estruturaValida,
    hashAtendeDificuldade,
  }
}
