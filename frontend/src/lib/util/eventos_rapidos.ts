import type { EventoBlockchain, ItemInsumo, TipoEvento } from "../api/tipos"
import { papelPorEvento, tipoEntidadePorEvento } from "../dominio/dominio"

export type InsumoAutomatico = Pick<
  ItemInsumo,
  "event_id" | "product_id" | "product_name" | "entity_kind"
>

export function ordenarItensDisponiveis(itens: ItemInsumo[]) {
  return [...itens]
    .filter((item) => item.status_consumo === "disponivel")
    .sort((a, b) => {
      if (a.status_origem !== b.status_origem) {
        return a.status_origem === "confirmado" ? -1 : 1
      }

      const dataA = new Date(a.timestamp).getTime()
      const dataB = new Date(b.timestamp).getTime()
      if (dataA !== dataB) {
        return dataA - dataB
      }

      return a.event_id.localeCompare(b.event_id)
    })
}

export function selecionarInsumoRapidoProdutoSimples(itens: ItemInsumo[]) {
  return ordenarItensDisponiveis(itens).find((item) => item.entity_kind === "raw_material") ?? null
}

export function selecionarInsumosRapidoProdutoComposto(itens: ItemInsumo[]) {
  const disponiveis = ordenarItensDisponiveis(itens)
  const insumoDerivado = disponiveis.find(
    (item) => item.entity_kind === "simple_product" || item.entity_kind === "composite_product",
  )

  if (!insumoDerivado) {
    return []
  }

  const complementoMateriaPrima = disponiveis.find(
    (item) => item.entity_kind === "raw_material" && item.event_id !== insumoDerivado.event_id,
  )

  if (complementoMateriaPrima) {
    return [insumoDerivado, complementoMateriaPrima]
  }

  const complementoDerivado = disponiveis.find(
    (item) =>
      (item.entity_kind === "simple_product" || item.entity_kind === "composite_product")
      && item.event_id !== insumoDerivado.event_id,
  )

  return complementoDerivado ? [insumoDerivado, complementoDerivado] : [insumoDerivado]
}

export function contarItensPorEntidade(itens: Array<Pick<ItemInsumo, "entity_kind">>) {
  return itens.reduce(
    (acumulado, item) => {
      acumulado[item.entity_kind] += 1
      return acumulado
    },
    {
      raw_material: 0,
      simple_product: 0,
      composite_product: 0,
    },
  )
}

function prefixoEvento(tipoEvento: TipoEvento) {
  if (tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
    return "RAW"
  }
  if (tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
    return "SIM"
  }
  return "CMP"
}

function baseNomeItem(tipoEvento: TipoEvento, sequencia: number, inputs: InsumoAutomatico[]) {
  const etiqueta = String(sequencia).padStart(2, "0")

  if (tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
    return `Matéria-prima ${etiqueta}`
  }

  if (tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
    const origem = inputs[0]?.product_name ?? "insumo base"
    return `Produto simples ${etiqueta} - ${origem}`
  }

  const origem = inputs[0]?.product_name ?? "composição"
  return `Produto composto ${etiqueta} - ${origem}`
}

function normalizarSegmentoId(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .toUpperCase()
}

function carimboIdentificador() {
  const agora = new Date()
  const partes = [
    agora.getUTCFullYear(),
    String(agora.getUTCMonth() + 1).padStart(2, "0"),
    String(agora.getUTCDate()).padStart(2, "0"),
    String(agora.getUTCHours()).padStart(2, "0"),
    String(agora.getUTCMinutes()).padStart(2, "0"),
    String(agora.getUTCSeconds()).padStart(2, "0"),
  ]

  return `${partes.join("")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function construirEventoAutomatico({
  tipoEvento,
  noId,
  sequencia,
  fluxo,
  inputs = [],
  nomeProduto,
  actorId,
  metadataExtra,
}: {
  tipoEvento: TipoEvento
  noId: string
  sequencia: number
  fluxo: string
  inputs?: InsumoAutomatico[]
  nomeProduto?: string
  actorId?: string
  metadataExtra?: Record<string, unknown>
}): EventoBlockchain {
  const prefixo = prefixoEvento(tipoEvento)
  const carimbo = carimboIdentificador()
  const segmentoNo = normalizarSegmentoId(noId)
  const nomeGerado = nomeProduto ?? baseNomeItem(tipoEvento, sequencia, inputs)
  const productId = `${prefixo}-${segmentoNo}-${carimbo}`

  return {
    event_id: `EVT-${prefixo}-${carimbo}`,
    event_type: tipoEvento,
    entity_kind: tipoEntidadePorEvento(tipoEvento),
    product_id: productId,
    product_name: nomeGerado,
    actor_id: actorId ?? `${papelPorEvento(tipoEvento)}-${segmentoNo}`,
    actor_role: papelPorEvento(tipoEvento),
    timestamp: new Date().toISOString(),
    input_ids: inputs.map((item) => item.event_id),
    metadata: {
      lot_id: productId,
      origem_fluxo: fluxo,
      gerado_automaticamente: true,
      no_alvo: noId,
      insumos_escolhidos_automaticamente: inputs.map((item) => item.event_id),
      ...metadataExtra,
    },
  }
}

export function resumirEventoComoInsumo(evento: EventoBlockchain): InsumoAutomatico {
  return {
    event_id: evento.event_id,
    product_id: evento.product_id,
    product_name: evento.product_name,
    entity_kind: evento.entity_kind,
  }
}
