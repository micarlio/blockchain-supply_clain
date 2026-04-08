import type {
  BlocoBlockchain,
  DemonstracaoResposta,
  EventoBlockchain,
  ItemInsumo,
  MempoolResposta,
  TipoEntidade,
} from "../api/tipos"

type EventoIndexado = {
  evento: EventoBlockchain
  statusOrigem: "confirmado" | "pendente"
}

export function extrairEventosConfirmados(cadeia: BlocoBlockchain[]) {
  return cadeia.flatMap((bloco) =>
    bloco.events.map((evento) => ({
      evento,
      block_index: bloco.index,
      block_hash: bloco.block_hash,
      miner_id: bloco.miner_id ?? null,
    })),
  )
}

export function construirMapaOrigemNo(
  demonstracoes: Array<{ noId: string; dados?: DemonstracaoResposta }>,
) {
  const mapa = new Map<string, string>()

  for (const item of demonstracoes) {
    const atividades = item.dados?.atividades ?? []
    for (const atividade of atividades) {
      if (
        atividade.tipo === "evento_adicionado" &&
        atividade.event_id_relacionado &&
        atividade.descricao.includes("via api")
      ) {
        mapa.set(atividade.event_id_relacionado, item.noId)
      }
    }
  }

  return mapa
}

export function construirItensInsumo(
  cadeia: BlocoBlockchain[],
  mempool: MempoolResposta | undefined,
  demonstracoes: Array<{ noId: string; dados?: DemonstracaoResposta }>,
) {
  const eventosConfirmados: EventoIndexado[] = cadeia
    .slice(1)
    .flatMap((bloco) => bloco.events.map((evento) => ({ evento, statusOrigem: "confirmado" as const })))

  const eventosPendentes: EventoIndexado[] =
    mempool?.eventos.map((evento) => ({ evento, statusOrigem: "pendente" as const })) ?? []

  const todos = [...eventosConfirmados, ...eventosPendentes]
  const consumidos = new Set<string>()

  for (const item of todos) {
    for (const inputId of item.evento.input_ids) {
      consumidos.add(inputId)
    }
  }

  const origemPorEvento = construirMapaOrigemNo(demonstracoes)

  return todos.map<ItemInsumo>((item) => ({
    event_id: item.evento.event_id,
    product_id: item.evento.product_id,
    product_name: item.evento.product_name,
    event_type: item.evento.event_type,
    entity_kind: item.evento.entity_kind,
    timestamp: item.evento.timestamp,
    input_ids: item.evento.input_ids,
    metadata: item.evento.metadata,
    ator_origem: item.evento.actor_id,
    no_origem: origemPorEvento.get(item.evento.event_id),
    status_origem: item.statusOrigem,
    status_consumo: consumidos.has(item.evento.event_id) ? "consumido" : "disponivel",
  }))
}

export function filtrarInsumosPorDestino(
  itens: ItemInsumo[],
  entidadeDestino: TipoEntidade,
) {
  if (entidadeDestino === "simple_product") {
    return itens.filter((item) => item.entity_kind === "raw_material")
  }

  return itens.filter((item) =>
    ["raw_material", "simple_product", "composite_product"].includes(item.entity_kind),
  )
}

export function descricaoDisponibilidade(item: ItemInsumo) {
  if (item.status_consumo === "consumido") {
    return "já consumido"
  }
  if (item.status_origem === "pendente") {
    return "pendente de bloco"
  }
  return "disponível"
}

export function possuiInsumoDerivadoSelecionado(
  itens: ItemInsumo[],
  selecionados: string[],
) {
  const selecionadosSet = new Set(selecionados)
  return itens.some(
    (item) =>
      selecionadosSet.has(item.event_id) &&
      (item.entity_kind === "simple_product" || item.entity_kind === "composite_product"),
  )
}
