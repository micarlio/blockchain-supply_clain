import { useQueries, useQuery } from "@tanstack/react-query"

import { requisitarJson } from "./cliente"
import type {
  CadeiaResposta,
  ConfiguracaoNo,
  DemonstracaoResposta,
  EstadoNo,
  EventoBlockchain,
  MempoolResposta,
  RastreabilidadeResposta,
  RedeResposta,
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
