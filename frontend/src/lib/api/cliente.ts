function montarUrl(baseUrl: string, caminho: string): string {
  return `${baseUrl.replace(/\/$/, "")}${caminho}`
}

function tentarLerJson(texto: string) {
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return null
  }
}

export class ErroApi extends Error {
  status: number
  dados: unknown

  constructor(status: number, mensagem: string, dados: unknown) {
    super(mensagem)
    this.name = "ErroApi"
    this.status = status
    this.dados = dados
  }
}

export async function requisitarJson<T>(
  baseUrl: string,
  caminho: string,
  init?: RequestInit,
): Promise<T> {
  const resposta = await fetch(montarUrl(baseUrl, caminho), {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const texto = await resposta.text()
  const dados = texto ? tentarLerJson(texto) : null

  if (!resposta.ok) {
    const motivo =
      typeof dados === "object" && dados && "motivo" in dados && typeof dados.motivo === "string"
        ? dados.motivo
        : texto.trim() || resposta.statusText
    throw new ErroApi(
      resposta.status,
      motivo || "Falha ao consultar a API",
      dados ?? (texto || null),
    )
  }

  if (texto && dados === null) {
    throw new Error(
      `Resposta inválida da API em ${caminho}: esperado JSON e recebido conteúdo não compatível.`,
    )
  }

  return dados as T
}
