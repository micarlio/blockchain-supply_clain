import { useQueries, useQuery } from "@tanstack/react-query"

import { requisitarJson } from "./cliente"
import type {
  CadeiaResposta,
  ConfiguracaoNo,
  DefinicaoCenarioTeste,
  DemonstracaoResposta,
  EstadoNo,
  PayloadExecucaoTeste,
  PayloadConfiguracaoNo,
  PayloadConfiguracaoRede,
  EventoBlockchain,
  LogsResposta,
  MempoolResposta,
  ResultadoExecucaoTeste,
  RastreabilidadeResposta,
  RedeResposta,
  RespostaConfiguracao,
  RespostaEvento,
  RespostaMineracao,
} from "./tipos"

export function consultarEstadoNo(no: ConfiguracaoNo): Promise<EstadoNo> {
  return requisitarJson<EstadoNo>(no.url, "/estado")
}

export function consultarCadeiaNo(no: ConfiguracaoNo): Promise<CadeiaResposta> {
  return requisitarJson<CadeiaResposta>(no.url, "/cadeia")
}

export function consultarMempoolNo(no: ConfiguracaoNo): Promise<MempoolResposta> {
  return requisitarJson<MempoolResposta>(no.url, "/mempool")
}

export function consultarRedeNo(no: ConfiguracaoNo): Promise<RedeResposta> {
  return requisitarJson<RedeResposta>(no.url, "/rede")
}

export function consultarDemonstracaoNo(no: ConfiguracaoNo): Promise<DemonstracaoResposta> {
  return requisitarJson<DemonstracaoResposta>(no.url, "/demonstracao")
}

export function consultarLogsNo(no: ConfiguracaoNo, limite = 250): Promise<LogsResposta> {
  return requisitarJson<LogsResposta>(no.url, `/logs?limite=${limite}`)
}

export function consultarRastreabilidade(
  no: ConfiguracaoNo,
  identificador: string,
): Promise<RastreabilidadeResposta> {
  return requisitarJson<RastreabilidadeResposta>(
    no.url,
    `/rastreabilidade/${encodeURIComponent(identificador)}`,
  )
}

export function enviarEvento(
  no: ConfiguracaoNo,
  payload: EventoBlockchain,
  propagarRede = true,
): Promise<RespostaEvento> {
  return requisitarJson<RespostaEvento>(
    no.url,
    `/eventos?propagar_rede=${propagarRede ? "true" : "false"}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export function enviarPayloadInvalido(
  no: ConfiguracaoNo,
  payload: Record<string, unknown>,
): Promise<RespostaEvento> {
  return requisitarJson<RespostaEvento>(no.url, "/eventos?propagar_rede=false", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function minerarNo(no: ConfiguracaoNo): Promise<RespostaMineracao> {
  return requisitarJson<RespostaMineracao>(no.url, "/demonstracao/minerar", {
    method: "POST",
  })
}

export function atualizarConfiguracaoNo(
  no: ConfiguracaoNo,
  payload: PayloadConfiguracaoNo,
): Promise<RespostaConfiguracao> {
  return requisitarJson<RespostaConfiguracao>(no.url, "/configuracao/no", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function atualizarConfiguracaoRedeNo(
  no: ConfiguracaoNo,
  payload: PayloadConfiguracaoRede,
): Promise<RespostaConfiguracao> {
  return requisitarJson<RespostaConfiguracao>(no.url, "/configuracao/rede", {
    method: "PATCH",
    body: JSON.stringify(payload),
  })
}

export function limparMemoriaNo(no: ConfiguracaoNo): Promise<RespostaConfiguracao> {
  return requisitarJson<RespostaConfiguracao>(no.url, "/memoria/limpar", {
    method: "POST",
  })
}

export function consultarCenariosTeste(no: ConfiguracaoNo): Promise<DefinicaoCenarioTeste[]> {
  return requisitarJson<DefinicaoCenarioTeste[]>(no.url, "/testes/cenarios")
}

export function consultarCenarioTeste(
  no: ConfiguracaoNo,
  scenarioId: string,
): Promise<DefinicaoCenarioTeste> {
  return requisitarJson<DefinicaoCenarioTeste>(
    no.url,
    `/testes/cenarios/${encodeURIComponent(scenarioId)}`,
  )
}

export function executarCenarioTeste(
  no: ConfiguracaoNo,
  scenarioId: string,
  payload: PayloadExecucaoTeste,
): Promise<ResultadoExecucaoTeste> {
  return requisitarJson<ResultadoExecucaoTeste>(
    no.url,
    `/testes/executar/${encodeURIComponent(scenarioId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  )
}

export function useEstadoNo(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["estado-no", no.id, no.url],
    queryFn: () => consultarEstadoNo(no),
    refetchInterval: 4_000,
  })
}

export function useCadeiaNo(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["cadeia-no", no.id, no.url],
    queryFn: () => consultarCadeiaNo(no),
    refetchInterval: 5_000,
  })
}

export function useMempoolNo(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["mempool-no", no.id, no.url],
    queryFn: () => consultarMempoolNo(no),
    refetchInterval: 3_000,
  })
}

export function useRedeNo(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["rede-no", no.id, no.url],
    queryFn: () => consultarRedeNo(no),
    refetchInterval: 4_000,
  })
}

export function useDemonstracaoNo(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["demonstracao-no", no.id, no.url],
    queryFn: () => consultarDemonstracaoNo(no),
    refetchInterval: 4_000,
  })
}

export function useLogsNos(
  nos: ConfiguracaoNo[],
  {
    limite = 250,
    refetchInterval = 2_500,
  }: {
    limite?: number
    refetchInterval?: number | false
  } = {},
) {
  return useQueries({
    queries: nos.map((no) => ({
      queryKey: ["logs-no", no.id, no.url, limite],
      queryFn: () => consultarLogsNo(no, limite),
      refetchInterval,
      staleTime: 0,
    })),
  })
}

export function useCenariosTeste(no: ConfiguracaoNo) {
  return useQuery({
    queryKey: ["testes-cenarios", no.id, no.url],
    queryFn: () => consultarCenariosTeste(no),
    staleTime: 10_000,
  })
}

export function useCenarioTeste(no: ConfiguracaoNo, scenarioId: string) {
  return useQuery({
    queryKey: ["testes-cenario", no.id, no.url, scenarioId],
    queryFn: () => consultarCenarioTeste(no, scenarioId),
    enabled: scenarioId.trim().length > 0,
    staleTime: 10_000,
  })
}

export function useRastreabilidade(no: ConfiguracaoNo, identificador: string) {
  return useQuery({
    queryKey: ["rastreabilidade", no.id, identificador],
    queryFn: () => consultarRastreabilidade(no, identificador),
    enabled: identificador.trim().length > 0,
    staleTime: 0,
  })
}

export function useEstadosNos(nos: ConfiguracaoNo[]) {
  return useQueries({
    queries: nos.map((no) => ({
      queryKey: ["estado-no", no.id, no.url],
      queryFn: () => consultarEstadoNo(no),
      refetchInterval: 4_000,
    })),
  })
}

export function useDemonstracoesNos(nos: ConfiguracaoNo[]) {
  return useQueries({
    queries: nos.map((no) => ({
      queryKey: ["demonstracao-no", no.id, no.url],
      queryFn: () => consultarDemonstracaoNo(no),
      refetchInterval: 4_000,
    })),
  })
}

export function useRedesNos(nos: ConfiguracaoNo[]) {
  return useQueries({
    queries: nos.map((no) => ({
      queryKey: ["rede-no", no.id, no.url],
      queryFn: () => consultarRedeNo(no),
      refetchInterval: 4_000,
    })),
  })
}

export function useCadeiasNos(nos: ConfiguracaoNo[]) {
  return useQueries({
    queries: nos.map((no) => ({
      queryKey: ["cadeia-no", no.id, no.url],
      queryFn: () => consultarCadeiaNo(no),
      refetchInterval: 5_000,
    })),
  })
}
