import type { EventoBlockchain, TipoEntidade, TipoEvento } from "../api/tipos"

export const TIPOS_EVENTO: Array<{
  valor: TipoEvento
  rotulo: string
  descricao: string
}> = [
  {
    valor: "CADASTRAR_MATERIA_PRIMA",
    rotulo: "Matéria-prima",
    descricao: "Cria um insumo inicial sem dependências anteriores.",
  },
  {
    valor: "FABRICAR_PRODUTO_SIMPLES",
    rotulo: "Produto simples",
    descricao: "Consome matéria-prima disponível e cria um item intermediário.",
  },
  {
    valor: "FABRICAR_PRODUTO_COMPOSTO",
    rotulo: "Produto composto",
    descricao: "Combina produtos e insumos para formar o item final rastreável.",
  },
]

export const ROTULOS_ENTIDADE: Record<TipoEntidade, string> = {
  raw_material: "matéria-prima",
  simple_product: "produto simples",
  composite_product: "produto composto",
}

export const ROTULOS_EVENTO: Record<TipoEvento, string> = {
  CADASTRAR_MATERIA_PRIMA: "Cadastrar matéria-prima",
  FABRICAR_PRODUTO_SIMPLES: "Fabricar produto simples",
  FABRICAR_PRODUTO_COMPOSTO: "Fabricar produto composto",
}

export const CORES_ENTIDADE: Record<TipoEntidade, string> = {
  raw_material: "bg-emerald-100 text-emerald-800",
  simple_product: "bg-amber-100 text-amber-800",
  composite_product: "bg-blue-100 text-blue-800",
}

export const CORES_EVENTO: Record<TipoEvento, string> = {
  CADASTRAR_MATERIA_PRIMA: "bg-emerald-50 text-emerald-700",
  FABRICAR_PRODUTO_SIMPLES: "bg-amber-50 text-amber-700",
  FABRICAR_PRODUTO_COMPOSTO: "bg-blue-50 text-blue-700",
}

export function tipoEntidadePorEvento(tipoEvento: TipoEvento): TipoEntidade {
  if (tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
    return "raw_material"
  }
  if (tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
    return "simple_product"
  }
  return "composite_product"
}

export function papelPorEvento(tipoEvento: TipoEvento) {
  if (tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
    return "FORNECEDOR" as const
  }
  if (tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
    return "FABRICANTE" as const
  }
  return "MONTADORA" as const
}

export function obterLotId(evento: EventoBlockchain): string | undefined {
  const lotId = evento.metadata?.lot_id
  return typeof lotId === "string" ? lotId : undefined
}

export function rotuloPapelNo(papel: string): string {
  if (papel === "minerador") {
    return "minerador"
  }
  if (papel === "controle") {
    return "controle manual"
  }
  if (papel === "observador") {
    return "observador"
  }
  return papel
}
