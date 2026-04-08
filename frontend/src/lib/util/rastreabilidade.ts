import type { ItemInsumo, NoRastreabilidade } from "../api/tipos"

function normalizar(valor: string) {
  return valor.trim().toLowerCase()
}

export function obterLotIdItem(item: Pick<ItemInsumo, "metadata">) {
  const valor = item.metadata?.lot_id
  return typeof valor === "string" ? valor : null
}

export type CampoConsultaRastreabilidade = "event_id" | "product_id" | "lot_id" | "nome" | "texto_livre"

export type SugestaoRastreabilidade = {
  item: ItemInsumo
  identificador: string
  campo: Exclude<CampoConsultaRastreabilidade, "texto_livre">
  valorCorrespondente: string
  exata: boolean
  iniciaCom: boolean
}

export type ConsultaRastreabilidadeResolvida = {
  termoOriginal: string
  identificador: string
  campo: CampoConsultaRastreabilidade
  item: ItemInsumo | null
}

function avaliarCorrespondencia(termo: string, valor: string | null, campo: SugestaoRastreabilidade["campo"]) {
  if (!valor) {
    return null
  }

  const termoNormalizado = normalizar(termo)
  const valorNormalizado = normalizar(valor)
  if (!termoNormalizado || !valorNormalizado.includes(termoNormalizado)) {
    return null
  }

  return {
    campo,
    valorCorrespondente: valor,
    exata: valorNormalizado === termoNormalizado,
    iniciaCom: valorNormalizado.startsWith(termoNormalizado),
  }
}

function prioridadeSugestao(sugestao: SugestaoRastreabilidade) {
  const baseCampo =
    sugestao.campo === "event_id"
      ? 40
      : sugestao.campo === "product_id"
        ? 30
        : sugestao.campo === "lot_id"
          ? 20
          : 10

  return (sugestao.exata ? 100 : 0) + (sugestao.iniciaCom ? 10 : 0) + baseCampo
}

export function construirSugestoesRastreabilidade(itens: ItemInsumo[], termo: string, limite = 6) {
  const termoNormalizado = normalizar(termo)
  if (!termoNormalizado) {
    return [] as SugestaoRastreabilidade[]
  }

  const sugestoes = itens
    .map<SugestaoRastreabilidade | null>((item) => {
      const lotId = obterLotIdItem(item)
      const correspondencias = [
        avaliarCorrespondencia(termoNormalizado, item.event_id, "event_id"),
        avaliarCorrespondencia(termoNormalizado, item.product_id, "product_id"),
        avaliarCorrespondencia(termoNormalizado, lotId, "lot_id"),
        avaliarCorrespondencia(termoNormalizado, item.product_name, "nome"),
      ].filter((valor): valor is NonNullable<typeof valor> => Boolean(valor))

      if (correspondencias.length === 0) {
        return null
      }

      correspondencias.sort((a, b) => {
        const prioridadeA =
          (a.exata ? 100 : 0) + (a.iniciaCom ? 10 : 0) + (a.campo === "event_id" ? 4 : a.campo === "product_id" ? 3 : a.campo === "lot_id" ? 2 : 1)
        const prioridadeB =
          (b.exata ? 100 : 0) + (b.iniciaCom ? 10 : 0) + (b.campo === "event_id" ? 4 : b.campo === "product_id" ? 3 : b.campo === "lot_id" ? 2 : 1)
        return prioridadeB - prioridadeA
      })

      const melhor = correspondencias[0]
      const identificador =
        melhor.campo === "event_id"
          ? item.event_id
          : melhor.campo === "lot_id"
            ? lotId ?? item.product_id
            : item.product_id

      return {
        item,
        identificador,
        campo: melhor.campo,
        valorCorrespondente: melhor.valorCorrespondente,
        exata: melhor.exata,
        iniciaCom: melhor.iniciaCom,
      }
    })
    .filter((valor): valor is SugestaoRastreabilidade => Boolean(valor))

  sugestoes.sort((a, b) => prioridadeSugestao(b) - prioridadeSugestao(a))
  return sugestoes.slice(0, limite)
}

export function resolverConsultaRastreabilidade(
  termo: string,
  itens: ItemInsumo[],
): ConsultaRastreabilidadeResolvida | null {
  const termoTratado = termo.trim()
  if (!termoTratado) {
    return null
  }

  const sugestoes = construirSugestoesRastreabilidade(itens, termoTratado, 8)
  const sugestoesExatas = sugestoes.filter((sugestao) => sugestao.exata)

  if (sugestoesExatas.length === 1) {
    const sugestao = sugestoesExatas[0]
    return {
      termoOriginal: termoTratado,
      identificador: sugestao.identificador,
      campo: sugestao.campo,
      item: sugestao.item,
    }
  }

  if (sugestoes.length === 1) {
    const sugestao = sugestoes[0]
    return {
      termoOriginal: termoTratado,
      identificador: sugestao.identificador,
      campo: sugestao.campo,
      item: sugestao.item,
    }
  }

  return {
    termoOriginal: termoTratado,
    identificador: termoTratado,
    campo: "texto_livre",
    item: null,
  }
}

export type NoRastreabilidadeFlatten = {
  no: NoRastreabilidade
  nivel: number
  pai: NoRastreabilidade | null
}

export function listarNosRastreabilidade(raiz: NoRastreabilidade) {
  const resultado: NoRastreabilidadeFlatten[] = []

  function percorrer(no: NoRastreabilidade, nivel: number, pai: NoRastreabilidade | null) {
    resultado.push({ no, nivel, pai })
    for (const filho of no.insumos) {
      percorrer(filho, nivel + 1, no)
    }
  }

  percorrer(raiz, 0, null)
  return resultado
}

export function encontrarNoRastreabilidade(raiz: NoRastreabilidade, eventId: string | null) {
  if (!eventId) {
    return raiz
  }

  return listarNosRastreabilidade(raiz).find((item) => item.no.evento.event_id === eventId)?.no ?? raiz
}

export function obterCaminhoRastreabilidade(raiz: NoRastreabilidade, eventId: string | null) {
  if (!eventId) {
    return [raiz]
  }

  const caminho: NoRastreabilidade[] = []

  function percorrer(no: NoRastreabilidade): boolean {
    caminho.push(no)
    if (no.evento.event_id === eventId) {
      return true
    }

    for (const filho of no.insumos) {
      if (percorrer(filho)) {
        return true
      }
    }

    caminho.pop()
    return false
  }

  return percorrer(raiz) ? caminho : [raiz]
}

export type MetricasRastreabilidade = {
  profundidade: number
  totalNos: number
  totalDependencias: number
  materiasPrimas: number
  produtosIntermediarios: number
  pendentes: number
  dependenciasDiretas: number
}

export function calcularMetricasRastreabilidade(raiz: NoRastreabilidade): MetricasRastreabilidade {
  let profundidade = 1
  let totalNos = 0
  let materiasPrimas = 0
  let produtosIntermediarios = 0
  let pendentes = 0

  function percorrer(no: NoRastreabilidade, nivel: number, isRaiz: boolean) {
    totalNos += 1
    profundidade = Math.max(profundidade, nivel + 1)

    if (no.evento.entity_kind === "raw_material") {
      materiasPrimas += 1
    } else if (!isRaiz) {
      produtosIntermediarios += 1
    }

    if (no.status === "pendente") {
      pendentes += 1
    }

    for (const filho of no.insumos) {
      percorrer(filho, nivel + 1, false)
    }
  }

  percorrer(raiz, 0, true)

  return {
    profundidade,
    totalNos,
    totalDependencias: Math.max(totalNos - 1, 0),
    materiasPrimas,
    produtosIntermediarios,
    pendentes,
    dependenciasDiretas: raiz.insumos.length,
  }
}

export function explicarRastreabilidade(metricas: MetricasRastreabilidade) {
  const partes = [
    `Este item possui ${metricas.dependenciasDiretas} depend${metricas.dependenciasDiretas === 1 ? "ência direta" : "ências diretas"}`,
    `${metricas.totalDependencias} depend${metricas.totalDependencias === 1 ? "ência total" : "ências totais"} na cadeia de origem`,
    `e profundidade de ${metricas.profundidade} ${metricas.profundidade === 1 ? "nível" : "níveis"}`,
  ]

  return `${partes.join(", ")}. A árvore abaixo mostra a composição recursiva até as matérias-primas.`
}
