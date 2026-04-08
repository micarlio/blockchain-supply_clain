import { rotuloPapelNo } from "../dominio/dominio"
import type {
  AtividadeRede,
  BlocoBlockchain,
  CadeiaResposta,
  ConfiguracaoNo,
  EstadoNo,
  RedeResposta,
} from "../api/tipos"
import { ordenarDescPorTimestamp } from "./formatacao"

export type EstadoSincronizacaoRede = "sincronizado" | "atrasado" | "divergente" | "offline"

export type AtividadeCluster = {
  id: string
  timestamp: string
  tipo: string
  titulo: string
  descricao: string
  severidade: string
  nodeId: string
  nomeNo: string
  hashRelacionado?: string | null
  eventIdRelacionado?: string | null
  derivada?: boolean
}

export type LinhaNoRede = {
  no: ConfiguracaoNo
  estado?: EstadoNo
  rede?: RedeResposta
  cadeia?: CadeiaResposta
  online: boolean
  ativo: boolean
  papel: string
  altura: number | null
  mempool: number | null
  hashPonta: string | null
  forks: number | null
  ultimoContato: string | null
  ultimoEvento: string | null
  ultimoBloco: BlocoBlockchain | null
  syncEstado: EstadoSincronizacaoRede
  syncDescricao: string
  alinhamentoPercentual: number
  compartilhaTopo: boolean
  atividades: AtividadeCluster[]
  ultimaAtividade: AtividadeCluster | null
  mineracaoDisponivel: boolean
}

export type ResumoCluster = {
  totalNos: number
  nosOnline: number
  nosSincronizados: number
  alturaReferencia: number
  hashReferencia: string | null
  hashCompartilhadoPor: number
  mempoolReferencia: number | null
  ultimoBloco: BlocoBlockchain | null
  ultimoMinerador: string | null
  redeConsistente: boolean
  haDivergenciaAltura: boolean
  haDivergenciaHash: boolean
  haDivergenciaMempool: boolean
  feedGlobal: AtividadeCluster[]
}

type EntradaNoCluster = {
  no: ConfiguracaoNo
  estado?: EstadoNo
  rede?: RedeResposta
  cadeia?: CadeiaResposta
}

type MetaPapelNo = {
  chave: "minerador" | "controle" | "observador" | "desconhecido"
  rotulo: string
  descricao: string
}

const TITULOS_ATIVIDADE: Record<string, string> = {
  bloco_recebido: "Bloco recebido",
  bloco_rejeitado: "Bloco rejeitado",
  bloco_proprio_descartado: "Bloco próprio descartado",
  cadeia_reorganizada: "Cadeia sincronizada",
  evento_adicionado: "Evento aceito",
  evento_recebido: "Evento recebido",
  evento_rejeitado: "Evento rejeitado",
  evento_proprio_descartado: "Evento próprio descartado",
  fork_detectado: "Fork detectado",
  bloco_topo_observado: "Bloco observado no topo",
}

const ROTULOS_ULTIMO_EVENTO: Record<string, string> = {
  inicializacao: "monitor iniciado",
  inicializacao_no: "nó inicializado",
  consulta_estado: "estado consultado",
  consulta_rede: "rede consultada",
  evento_adicionado: "evento aceito",
  evento_recebido: "evento recebido",
  bloco_recebido: "bloco recebido",
  mineracao_manual: "mineração manual",
}

export function obterMetaPapelNo(papel: string): MetaPapelNo {
  if (papel === "minerador") {
    return {
      chave: "minerador",
      rotulo: "Minerador",
      descricao: "mineração ativa",
    }
  }

  if (papel === "controle") {
    return {
      chave: "controle",
      rotulo: "Controle manual",
      descricao: "mineração sob comando",
    }
  }

  if (papel === "observador") {
    return {
      chave: "observador",
      rotulo: "Observador",
      descricao: "replica e valida a cadeia",
    }
  }

  return {
    chave: "desconhecido",
    rotulo: rotuloPapelNo(papel),
    descricao: "papel não mapeado",
  }
}

export function rotuloUltimoEventoNo(evento?: string | null) {
  if (!evento) {
    return "sem observação recente"
  }

  return ROTULOS_ULTIMO_EVENTO[evento] ?? evento.replaceAll("_", " ")
}

export function tituloAtividade(tipo: string) {
  return TITULOS_ATIVIDADE[tipo] ?? tipo.replaceAll("_", " ")
}

export function nomeNoPorId(nodeId: string | null | undefined, nos: ConfiguracaoNo[]) {
  if (!nodeId) {
    return "Gênesis"
  }

  return nos.find((no) => no.id === nodeId)?.nome ?? nodeId
}

function obterTimestamp(valor?: string | null) {
  if (!valor) {
    return 0
  }

  const timestamp = new Date(valor).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function escolherMaisRecente<T extends { ultimo_contato?: string | null }>(itens: T[]) {
  return itens.reduce<T | null>((maisRecente, item) => {
    if (!maisRecente) {
      return item
    }

    return obterTimestamp(item.ultimo_contato) > obterTimestamp(maisRecente.ultimo_contato)
      ? item
      : maisRecente
  }, null)
}

function obterValorMaisFrequente<T extends string | number>(valores: T[]) {
  if (!valores.length) {
    return null
  }

  const contagem = new Map<T, number>()
  for (const valor of valores) {
    contagem.set(valor, (contagem.get(valor) ?? 0) + 1)
  }

  let escolhido = valores[0]
  let frequencia = 0

  for (const valor of valores) {
    const atual = contagem.get(valor) ?? 0
    if (atual > frequencia) {
      escolhido = valor
      frequencia = atual
    }
  }

  return escolhido
}

function transformarAtividade(
  atividade: AtividadeRede,
  nos: ConfiguracaoNo[],
  idPrefixo: string,
): AtividadeCluster {
  return {
    id: [
      idPrefixo,
      atividade.timestamp,
      atividade.node_id,
      atividade.tipo,
      atividade.hash_relacionado,
      atividade.event_id_relacionado,
      atividade.descricao,
    ]
      .filter(Boolean)
      .join("-"),
    timestamp: atividade.timestamp,
    tipo: atividade.tipo,
    titulo: tituloAtividade(atividade.tipo),
    descricao: atividade.descricao,
    severidade: atividade.severidade,
    nodeId: atividade.node_id,
    nomeNo: nomeNoPorId(atividade.node_id, nos),
    hashRelacionado: atividade.hash_relacionado,
    eventIdRelacionado: atividade.event_id_relacionado,
  }
}

function deduplicarAtividades(atividades: AtividadeCluster[]) {
  const mapa = new Map<string, AtividadeCluster>()

  for (const atividade of atividades) {
    mapa.set(atividade.id, atividade)
  }

  return ordenarDescPorTimestamp([...mapa.values()])
}

function inferirReferencia(entradas: EntradaNoCluster[]) {
  const online = entradas.filter((entrada) => entrada.estado && entrada.cadeia)
  const alturaReferencia = Math.max(...online.map((entrada) => entrada.estado?.altura_cadeia ?? 0), 0)
  const hashesNaAltura = online
    .filter((entrada) => (entrada.estado?.altura_cadeia ?? 0) === alturaReferencia)
    .map((entrada) => entrada.estado?.hash_ponta)
    .filter((hash): hash is string => Boolean(hash))
  const hashReferencia = obterValorMaisFrequente(hashesNaAltura)
  const linhaReferencia = online.find(
    (entrada) =>
      entrada.estado?.altura_cadeia === alturaReferencia && entrada.estado.hash_ponta === hashReferencia,
  )

  return {
    alturaReferencia,
    hashReferencia: hashReferencia ?? null,
    cadeiaReferencia: linhaReferencia?.cadeia?.cadeia_ativa ?? [],
  }
}

function construirAtividadeTopo(no: ConfiguracaoNo, bloco: BlocoBlockchain, nos: ConfiguracaoNo[]) {
  const minerador = nomeNoPorId(bloco.miner_id, nos)

  return {
    id: `topo-${no.id}-${bloco.block_hash}`,
    timestamp: bloco.timestamp,
    tipo: "bloco_topo_observado",
    titulo: tituloAtividade("bloco_topo_observado"),
    descricao: `Último bloco conhecido: #${bloco.index}, minerado por ${minerador}.`,
    severidade: bloco.index > 0 ? "success" : "info",
    nodeId: no.id,
    nomeNo: no.nome,
    hashRelacionado: bloco.block_hash,
    derivada: true,
  } satisfies AtividadeCluster
}

function construirFeedGlobalDerivado(linhas: LinhaNoRede[], nos: ConfiguracaoNo[]) {
  const blocosUnicos = new Map<string, BlocoBlockchain>()

  for (const linha of linhas) {
    if (linha.ultimoBloco) {
      blocosUnicos.set(linha.ultimoBloco.block_hash, linha.ultimoBloco)
    }
  }

  return ordenarDescPorTimestamp([...blocosUnicos.values()]).map((bloco) => ({
    id: `global-${bloco.block_hash}`,
    timestamp: bloco.timestamp,
    tipo: "bloco_topo_observado",
    titulo: `Bloco #${bloco.index} minerado`,
    descricao: `${nomeNoPorId(bloco.miner_id, nos)} aparece como minerador do topo observado do cluster.`,
    severidade: bloco.index > 0 ? "success" : "info",
    nodeId: bloco.miner_id ?? "genesis",
    nomeNo: nomeNoPorId(bloco.miner_id, nos),
    hashRelacionado: bloco.block_hash,
    derivada: true,
  }))
}

export function derivarPainelCluster(entradas: EntradaNoCluster[], noAtivoId: string) {
  const { alturaReferencia, hashReferencia, cadeiaReferencia } = inferirReferencia(entradas)
  const observacoesConhecidas = entradas.flatMap((entrada) => entrada.rede?.nos_conhecidos ?? [])

  const linhas = entradas.map((entrada) => {
    const ultimoBloco = entrada.cadeia?.cadeia_ativa.at(-1) ?? null
    const observacoesDoNo = observacoesConhecidas.filter((observacao) => observacao.node_id === entrada.no.id)
    const observacaoRecente = escolherMaisRecente(observacoesDoNo)
    const altura = entrada.estado?.altura_cadeia ?? null
    const hashPonta = entrada.estado?.hash_ponta ?? null
    const cadeiaCompatível =
      altura !== null && altura > 0 && cadeiaReferencia[altura - 1]?.block_hash === hashPonta
    const compartilhaTopo = Boolean(hashReferencia && hashPonta === hashReferencia)

    let syncEstado: EstadoSincronizacaoRede = "offline"
    let syncDescricao = "sem resposta da API"
    let alinhamentoPercentual = 0

    if (entrada.estado && entrada.cadeia) {
      if (compartilhaTopo && altura === alturaReferencia) {
        syncEstado = "sincronizado"
        syncDescricao = "mesma ponta da referência do cluster"
        alinhamentoPercentual = 100
      } else if ((altura ?? 0) < alturaReferencia && cadeiaCompatível) {
        const blocosAtras = alturaReferencia - (altura ?? 0)
        syncEstado = "atrasado"
        syncDescricao = `${blocosAtras} bloco${blocosAtras > 1 ? "s" : ""} atrás da referência`
        alinhamentoPercentual = alturaReferencia > 0 ? Math.max(12, Math.round(((altura ?? 0) / alturaReferencia) * 100)) : 0
      } else {
        syncEstado = "divergente"
        syncDescricao = altura === alturaReferencia ? "hash da ponta diferente" : "cadeia diferente da referência"
        alinhamentoPercentual = alturaReferencia > 0 ? Math.max(18, Math.round((Math.min(altura ?? 0, alturaReferencia) / alturaReferencia) * 100)) : 0
      }
    }

    const atividadesReais = ordenarDescPorTimestamp(
      (entrada.rede?.atividade_recente ?? []).map((atividade) =>
        transformarAtividade(atividade, entradas.map((item) => item.no), entrada.no.id),
      ),
    )
    const atividadeTopo = ultimoBloco
      ? construirAtividadeTopo(entrada.no, ultimoBloco, entradas.map((item) => item.no))
      : null
    const atividades = deduplicarAtividades([
      ...(atividadeTopo ? [atividadeTopo] : []),
      ...atividadesReais,
    ])

    return {
      no: entrada.no,
      estado: entrada.estado,
      rede: entrada.rede,
      cadeia: entrada.cadeia,
      online: Boolean(entrada.estado),
      ativo: entrada.no.id === noAtivoId,
      papel: entrada.estado?.papel_no ?? entrada.rede?.papel_local ?? "desconhecido",
      altura,
      mempool: entrada.estado?.quantidade_mempool ?? entrada.rede?.estado_local.tamanho_mempool ?? null,
      hashPonta,
      forks: entrada.estado?.forks_conhecidos ?? entrada.rede?.estado_local.forks_conhecidos ?? null,
      ultimoContato: observacaoRecente?.ultimo_contato ?? null,
      ultimoEvento: observacaoRecente?.ultimo_evento ?? null,
      ultimoBloco,
      syncEstado,
      syncDescricao,
      alinhamentoPercentual,
      compartilhaTopo,
      atividades,
      ultimaAtividade: atividades[0] ?? null,
      mineracaoDisponivel: entrada.estado?.papel_no !== "observador",
    } satisfies LinhaNoRede
  })

  const linhasOnline = linhas.filter((linha) => linha.online)
  const alturasOnline = linhasOnline.map((linha) => linha.altura).filter((altura): altura is number => altura !== null)
  const hashesOnline = linhasOnline.map((linha) => linha.hashPonta).filter((hash): hash is string => Boolean(hash))
  const mempoolsOnline = linhasOnline.map((linha) => linha.mempool).filter((mempool): mempool is number => mempool !== null)
  const ultimoBloco = ordenarDescPorTimestamp(
    linhasOnline
      .map((linha) => linha.ultimoBloco)
      .filter((bloco): bloco is BlocoBlockchain => bloco !== null),
  )[0] ?? null
  const feedGlobal = deduplicarAtividades([
    ...linhas.flatMap((linha) => linha.atividades.filter((atividade) => !atividade.derivada)),
    ...construirFeedGlobalDerivado(linhasOnline, entradas.map((entrada) => entrada.no)),
  ])

  return {
    linhas,
    resumo: {
      totalNos: linhas.length,
      nosOnline: linhasOnline.length,
      nosSincronizados: linhasOnline.filter((linha) => linha.syncEstado === "sincronizado").length,
      alturaReferencia,
      hashReferencia,
      hashCompartilhadoPor: linhasOnline.filter((linha) => linha.hashPonta === hashReferencia).length,
      mempoolReferencia: obterValorMaisFrequente(mempoolsOnline),
      ultimoBloco,
      ultimoMinerador: ultimoBloco?.miner_id ?? null,
      redeConsistente:
        linhasOnline.length > 0 &&
        new Set(alturasOnline).size <= 1 &&
        new Set(hashesOnline).size <= 1 &&
        new Set(mempoolsOnline).size <= 1,
      haDivergenciaAltura: new Set(alturasOnline).size > 1,
      haDivergenciaHash: new Set(hashesOnline).size > 1,
      haDivergenciaMempool: new Set(mempoolsOnline).size > 1,
      feedGlobal,
    } satisfies ResumoCluster,
  }
}
