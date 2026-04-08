import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { NetworkActivityFeed } from "../componentes/nos/network_activity_feed"
import { NetworkClusterSummary } from "../componentes/nos/network_cluster_summary"
import { NetworkComparisonTable } from "../componentes/nos/network_comparison_table"
import { NetworkNodeCard } from "../componentes/nos/network_node_card"
import { NodeActivityList } from "../componentes/nos/node_activity_list"
import { useCadeiasNos, useEstadosNos, useRedesNos } from "../lib/api/servicos"
import type { ConfiguracaoNo } from "../lib/api/tipos"
import { derivarPainelCluster } from "../lib/util/rede_cluster"

async function revalidarConsultasNo(clienteConsulta: ReturnType<typeof useQueryClient>, no: ConfiguracaoNo) {
  await Promise.all([
    clienteConsulta.refetchQueries({ queryKey: ["estado-no", no.id, no.url], exact: true }),
    clienteConsulta.refetchQueries({ queryKey: ["rede-no", no.id, no.url], exact: true }),
    clienteConsulta.refetchQueries({ queryKey: ["cadeia-no", no.id, no.url], exact: true }),
    clienteConsulta.invalidateQueries({ queryKey: ["mempool-no", no.id, no.url], exact: true }),
    clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", no.id, no.url], exact: true }),
  ])
}

export function NosPagina() {
  const { nos, noAtivo, definirNoAtivo } = useNos()
  const clienteConsulta = useQueryClient()
  const estados = useEstadosNos(nos)
  const redes = useRedesNos(nos)
  const cadeias = useCadeiasNos(nos)

  const entradas = useMemo(
    () =>
      nos.map((no, indice) => ({
        no,
        estado: estados[indice].data,
        rede: redes[indice].data,
        cadeia: cadeias[indice].data,
      })),
    [nos, estados, redes, cadeias],
  )

  const { linhas, resumo } = useMemo(
    () => derivarPainelCluster(entradas, noAtivo.id),
    [entradas, noAtivo.id],
  )

  const atualizacao = useMutation({
    mutationFn: async (no: ConfiguracaoNo) => {
      await revalidarConsultasNo(clienteConsulta, no)
      return no.id
    },
  })

  if (estados.every((consulta) => consulta.isLoading) && cadeias.every((consulta) => consulta.isLoading)) {
    return <CarregandoPainel mensagem="Montando o painel operacional do cluster distribuído..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Nós da Rede"
        descricao="Monitore o cluster distribuído em tempo real, compare sincronização entre nós, acompanhe atividade recente e opere o nó desejado sem sair desta aba."
      />

      <NetworkClusterSummary resumo={resumo} nos={nos} />

      <section className="grid gap-4 xl:grid-cols-3">
        {linhas.map((linha) => (
          <NetworkNodeCard
            key={linha.no.id}
            linha={linha}
            nos={nos}
            aoSelecionarNo={definirNoAtivo}
            aoAtualizar={(no) => atualizacao.mutate(no)}
            atualizando={atualizacao.isPending && atualizacao.variables?.id === linha.no.id}
          />
        ))}
      </section>

      <NetworkComparisonTable linhas={linhas} resumo={resumo} />

      <NetworkActivityFeed
        titulo="Feed global da rede"
        descricao="Eventos recentes do cluster combinados com inferências derivadas da cadeia ativa observada em cada nó."
        atividades={resumo.feedGlobal}
        vazio="O cluster ainda não expôs eventos suficientes para montar um feed global útil."
        limite={10}
      />

      <section className="grid gap-4 xl:grid-cols-3">
        {linhas.map((linha) => (
          <NodeActivityList key={`${linha.no.id}-atividades`} linha={linha} />
        ))}
      </section>
    </div>
  )
}
