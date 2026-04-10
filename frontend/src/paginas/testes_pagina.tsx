import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import {
  ListaCenariosTeste,
  PainelCenarioTeste,
} from "../componentes/testes/testes_ui"
import {
  executarCenarioTeste,
  useCenarioTeste,
  useCenariosTeste,
} from "../lib/api/servicos"
import type {
  CampoEntradaTeste,
  ConfiguracaoNo,
  DefinicaoCenarioTeste,
  ResultadoExecucaoTeste,
} from "../lib/api/tipos"

function normalizarParametros(
  campos: CampoEntradaTeste[],
  valores: Record<string, string>,
) {
  const parametros: Record<string, unknown> = {}

  for (const campo of campos) {
    const valorBruto = valores[campo.id] ?? ""
    const valorFallback = campo.default_value
    const valor = valorBruto.length > 0 ? valorBruto : valorFallback

    if (valor === undefined || valor === null || valor === "") {
      continue
    }

    if (campo.field_type === "number") {
      parametros[campo.id] = Number(valor)
      continue
    }

    if (campo.field_type === "boolean") {
      parametros[campo.id] = valor === true || valor === "true"
      continue
    }

    parametros[campo.id] = valor
  }

  return parametros
}

async function invalidarConsultasCluster(
  clienteConsulta: ReturnType<typeof useQueryClient>,
  nos: ConfiguracaoNo[],
) {
  await Promise.all(
    nos.flatMap((no) => [
      clienteConsulta.invalidateQueries({ queryKey: ["estado-no", no.id, no.url], exact: true }),
      clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no", no.id, no.url], exact: true }),
      clienteConsulta.invalidateQueries({ queryKey: ["rede-no", no.id, no.url], exact: true }),
      clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", no.id, no.url], exact: true }),
      clienteConsulta.invalidateQueries({ queryKey: ["mempool-no", no.id, no.url], exact: true }),
    ]),
  )
}

export function TestesPagina() {
  const { nos, noAtivo } = useNos()
  const clienteConsulta = useQueryClient()
  const [scenarioIdManual, setScenarioIdManual] = useState<string | null>(null)
  const [nodeIdManual, setNodeIdManual] = useState<string | null>(null)
  const [valoresCampos, setValoresCampos] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<ResultadoExecucaoTeste | null>(null)

  const cenarios = useCenariosTeste(noAtivo)
  const scenarioIdSelecionado = useMemo(() => {
    const ids = new Set((cenarios.data ?? []).map((cenario) => cenario.id))
    if (scenarioIdManual && ids.has(scenarioIdManual)) {
      return scenarioIdManual
    }
    return cenarios.data?.[0]?.id ?? ""
  }, [cenarios.data, scenarioIdManual])

  const detalheCenario = useCenarioTeste(noAtivo, scenarioIdSelecionado)
  const cenarioSelecionado: DefinicaoCenarioTeste | null = detalheCenario.data ?? null

  const nodeIdSelecionado = useMemo(() => {
    if (nodeIdManual && nos.some((no) => no.id === nodeIdManual)) {
      return nodeIdManual
    }
    if (cenarioSelecionado?.default_target_node_id && nos.some((no) => no.id === cenarioSelecionado.default_target_node_id)) {
      return cenarioSelecionado.default_target_node_id
    }
    return noAtivo.id
  }, [cenarioSelecionado?.default_target_node_id, noAtivo.id, nodeIdManual, nos])

  const noExecucao = nos.find((no) => no.id === nodeIdSelecionado) ?? noAtivo

  const execucao = useMutation({
    mutationFn: async () => {
      if (!cenarioSelecionado) {
        throw new Error("cenario_nao_selecionado")
      }

      const parametros = normalizarParametros(
        cenarioSelecionado.input_fields,
        valoresCampos,
      )

      return executarCenarioTeste(noExecucao, cenarioSelecionado.id, {
        node_id: noExecucao.id,
        parametros,
      })
    },
    onSuccess: (dados) => {
      setResultado(dados)
    },
    onSettled: async () => {
      await invalidarConsultasCluster(clienteConsulta, nos)
    },
  })

  if (cenarios.isLoading || (scenarioIdSelecionado && detalheCenario.isLoading)) {
    return <CarregandoPainel mensagem="Carregando catálogo oficial de cenários do backend..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Testes"
        descricao="O backend define, executa e interpreta os cenários. O frontend atua apenas como uma interface genérica para listar, disparar e visualizar os resultados oficiais."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <ListaCenariosTeste
          cenarios={cenarios.data ?? []}
          scenarioIdSelecionado={scenarioIdSelecionado || null}
          aoSelecionar={(scenarioId) => {
            setScenarioIdManual(scenarioId)
            setNodeIdManual(null)
            setValoresCampos({})
            setResultado(null)
          }}
        />

        <PainelCenarioTeste
          cenario={cenarioSelecionado}
          nos={nos}
          noSelecionadoId={nodeIdSelecionado}
          aoSelecionarNo={(nodeId) => setNodeIdManual(nodeId)}
          valoresCampos={valoresCampos}
          aoAlterarCampo={(campoId, valor) =>
            setValoresCampos((estadoAtual) => ({
              ...estadoAtual,
              [campoId]: valor,
            }))
          }
          executando={execucao.isPending}
          aoExecutar={() => execucao.mutate()}
          resultado={resultado}
        />
      </div>
    </div>
  )
}
