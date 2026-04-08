function montarUrl(baseUrl: string, caminho: string): string {
  return `${baseUrl.replace(/\/$/, "")}${caminho}`
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
  const dados = texto ? JSON.parse(texto) : null

  if (!resposta.ok) {
    const motivo =
      typeof dados === "object" && dados && "motivo" in dados && typeof dados.motivo === "string"
        ? dados.motivo
        : resposta.statusText
    throw new ErroApi(resposta.status, motivo || "Falha ao consultar a API", dados)
  }

  return dados as T
}
