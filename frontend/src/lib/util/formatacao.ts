export function encurtarHash(valor?: string | null, tamanho = 14) {
  if (!valor) {
    return "-"
  }
  if (valor.length <= tamanho) {
    return valor
  }
  return `${valor.slice(0, tamanho)}...`
}

export function formatarData(valor?: string | null) {
  if (!valor) {
    return "-"
  }

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) {
    return valor
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data)
}

export function formatarJson(valor: unknown) {
  return JSON.stringify(valor, null, 2)
}

export function ordenarDescPorTimestamp<T extends { timestamp?: string | null }>(itens: T[]) {
  return [...itens].sort((a, b) => {
    const dataA = a.timestamp ? new Date(a.timestamp).getTime() : 0
    const dataB = b.timestamp ? new Date(b.timestamp).getTime() : 0
    return dataB - dataA
  })
}
