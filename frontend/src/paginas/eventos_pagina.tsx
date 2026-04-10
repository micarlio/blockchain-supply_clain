import { useMemo, useState } from "react"
import { Send, Sparkles, Zap } from "lucide-react"
import { Link } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CatalogoItens } from "../componentes/comum/catalogo_itens"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { PreviewPayload } from "../componentes/comum/preview_payload"
import { SeletorInputs } from "../componentes/comum/seletor_inputs"
import {
  QuickCreateCard,
  QuickCreateResultCard,
  QuickPresetCard,
  ResumoDisponibilidadeEventos,
} from "../componentes/eventos/eventos_ui"
import {
  useCadeiaNo,
  useDemonstracoesNos,
  useMempoolNo,
  enviarEvento,
  minerarNo,
} from "../lib/api/servicos"
import type { EventoBlockchain, ItemInsumo, TipoEvento } from "../lib/api/tipos"
import { ROTULOS_EVENTO, TIPOS_EVENTO, papelPorEvento, tipoEntidadePorEvento } from "../lib/dominio/dominio"
import {
  construirItensInsumo,
  filtrarInsumosPorDestino,
  possuiInsumoDerivadoSelecionado,
} from "../lib/util/insumos"
import {
  construirEventoAutomatico,
  contarItensPorEntidade,
  resumirEventoComoInsumo,
  selecionarInsumoRapidoProdutoSimples,
  selecionarInsumosRapidoProdutoComposto,
} from "../lib/util/eventos_rapidos"
import { cx } from "../lib/util/classe"

type FormularioAvancado = {
  event_id: string
  product_id: string
  product_name: string
  actor_id: string
  lot_id: string
  metadata_extra: string
  input_ids: string[]
}

type OperacaoSolicitada =
  | { kind: "quick"; tipoEvento: TipoEvento }
  | { kind: "preset"; presetId: "cadeia-minima" | "cadeia-textil" }

type ResultadoOperacao = {
  status: "sucesso" | "erro"
  titulo: string
  descricao: string
  rotuloOperacao: string
  propagado: boolean
  nomeNo: string
  eventos: EventoBlockchain[]
  insumosSelecionados: ItemInsumo[]
  operacao: OperacaoSolicitada
}

class ErroOperacaoEventos extends Error {
  eventos: EventoBlockchain[]
  insumosSelecionados: ItemInsumo[]

  constructor(mensagem: string, eventos: EventoBlockchain[] = [], insumosSelecionados: ItemInsumo[] = []) {
    super(mensagem)
    this.name = "ErroOperacaoEventos"
    this.eventos = eventos
    this.insumosSelecionados = insumosSelecionados
  }
}

const BASE: FormularioAvancado = {
  event_id: "",
  product_id: "",
  product_name: "",
  actor_id: "",
  lot_id: "",
  metadata_extra: "",
  input_ids: [],
}

const CLASSE_ROTULO_CAMPO = "text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500"
const CLASSE_CAMPO =
  "w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3.5 text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-primary/30 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.08)]"

function tituloAtor(tipoEvento: TipoEvento) {
  if (tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
    return "Fornecedor / origem"
  }
  if (tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
    return "Fabricante"
  }
  return "Montadora"
}

function rotuloOperacao(operacao: OperacaoSolicitada) {
  if (operacao.kind === "quick") {
    return ROTULOS_EVENTO[operacao.tipoEvento]
  }

  if (operacao.presetId === "cadeia-minima") {
    return "Preset: cadeia mínima"
  }

  return "Preset: cadeia têxtil"
}

export function EventosPagina() {
  const { noAtivo, nos } = useNos()
  const clienteConsulta = useQueryClient()
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>("CADASTRAR_MATERIA_PRIMA")
  const [formulario, setFormulario] = useState<FormularioAvancado>(BASE)
  const [erroFormulario, setErroFormulario] = useState<string | null>(null)
  const [propagarRede, setPropagarRede] = useState(true)
  const [resultadoOperacao, setResultadoOperacao] = useState<ResultadoOperacao | null>(null)
  const [feedbackMineracao, setFeedbackMineracao] = useState<string | null>(null)

  const cadeia = useCadeiaNo(noAtivo)
  const mempool = useMempoolNo(noAtivo)
  const demonstracoes = useDemonstracoesNos(nos)

  const itensInsumo = useMemo(
    () =>
      construirItensInsumo(
        cadeia.data?.cadeia_ativa ?? [],
        mempool.data,
        demonstracoes.map((consulta, indice) => ({ noId: nos[indice].id, dados: consulta.data })),
      ),
    [cadeia.data, mempool.data, demonstracoes, nos],
  )

  const itensFiltradosManual = useMemo(
    () => filtrarInsumosPorDestino(itensInsumo, tipoEntidadePorEvento(tipoEvento)),
    [itensInsumo, tipoEvento],
  )

  const materiaPrimaRapida = useMemo(
    () => selecionarInsumoRapidoProdutoSimples(itensInsumo),
    [itensInsumo],
  )

  const insumosRapidosComposto = useMemo(
    () => selecionarInsumosRapidoProdutoComposto(itensInsumo),
    [itensInsumo],
  )

  const disponibilidadeResumo = useMemo(() => {
    const itensDisponiveis = itensInsumo.filter((item) => item.status_consumo === "disponivel")
    return contarItensPorEntidade(itensDisponiveis)
  }, [itensInsumo])

  async function invalidarConsultasEventos() {
    await Promise.all([
      clienteConsulta.invalidateQueries({ queryKey: ["mempool-no"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["estado-no"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["rede-no"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["rastreabilidade"] }),
      clienteConsulta.invalidateQueries({ queryKey: ["logs-no"] }),
    ])
  }

  const mutationManual = useMutation({
    mutationFn: (payload: EventoBlockchain) => enviarEvento(noAtivo, payload, propagarRede),
    onSuccess: async () => {
      await invalidarConsultasEventos()
      setFormulario((atual) => ({
        ...BASE,
        actor_id: atual.actor_id,
      }))
    },
  })

  const mutationOperacaoRapida = useMutation({
    mutationFn: async (operacao: OperacaoSolicitada) => {
      const contadores = contarItensPorEntidade(itensInsumo)
      const eventosCriados: EventoBlockchain[] = []
      let insumosSelecionados: ItemInsumo[] = []

      async function postarEvento(payload: EventoBlockchain) {
        await enviarEvento(noAtivo, payload, propagarRede)
        eventosCriados.push(payload)
      }

      try {
        if (operacao.kind === "quick") {
          if (operacao.tipoEvento === "CADASTRAR_MATERIA_PRIMA") {
            const payload = construirEventoAutomatico({
              tipoEvento: operacao.tipoEvento,
              noId: noAtivo.id,
              sequencia: contadores.raw_material + 1,
              fluxo: "criacao_rapida",
            })
            await postarEvento(payload)
            await invalidarConsultasEventos()
            return {
              propagado: propagarRede,
              eventos: eventosCriados,
              insumosSelecionados,
              titulo: "Matéria-prima criada com sucesso",
              descricao: `Evento criado automaticamente em ${noAtivo.nome}. O item já está pronto para aparecer na mempool deste nó.`,
            }
          }

          if (operacao.tipoEvento === "FABRICAR_PRODUTO_SIMPLES") {
            if (!materiaPrimaRapida) {
              throw new ErroOperacaoEventos(
                "Nenhuma matéria-prima disponível para criação rápida de produto simples.",
              )
            }

            insumosSelecionados = [materiaPrimaRapida]
            const payload = construirEventoAutomatico({
              tipoEvento: operacao.tipoEvento,
              noId: noAtivo.id,
              sequencia: contadores.simple_product + 1,
              fluxo: "criacao_rapida",
              inputs: insumosSelecionados,
            })
            await postarEvento(payload)
            await invalidarConsultasEventos()
            return {
              propagado: propagarRede,
              eventos: eventosCriados,
              insumosSelecionados,
              titulo: "Produto simples criado com sucesso",
              descricao: `O sistema escolheu automaticamente ${materiaPrimaRapida.product_name} para compor o novo item.`,
            }
          }

          if (insumosRapidosComposto.length === 0) {
            throw new ErroOperacaoEventos(
              "Nenhum insumo compatível disponível para criação rápida de produto composto.",
            )
          }

          insumosSelecionados = insumosRapidosComposto
          const payload = construirEventoAutomatico({
            tipoEvento: operacao.tipoEvento,
            noId: noAtivo.id,
            sequencia: contadores.composite_product + 1,
            fluxo: "criacao_rapida",
            inputs: insumosSelecionados,
          })
          await postarEvento(payload)
          await invalidarConsultasEventos()
          return {
            propagado: propagarRede,
            eventos: eventosCriados,
            insumosSelecionados,
            titulo: "Produto composto criado com sucesso",
            descricao: `O sistema montou automaticamente a composição usando ${insumosSelecionados.map((item) => item.product_name).join(" + ")}.`,
          }
        }

        if (operacao.presetId === "cadeia-minima") {
          const materiaPrima = construirEventoAutomatico({
            tipoEvento: "CADASTRAR_MATERIA_PRIMA",
            noId: noAtivo.id,
            sequencia: contadores.raw_material + 1,
            fluxo: "preset_cadeia_minima",
            nomeProduto: `Matéria-prima demo ${String(contadores.raw_material + 1).padStart(2, "0")}`,
            metadataExtra: { preset: "cadeia_minima_rastreabilidade" },
          })
          await postarEvento(materiaPrima)

          const produtoSimples = construirEventoAutomatico({
            tipoEvento: "FABRICAR_PRODUTO_SIMPLES",
            noId: noAtivo.id,
            sequencia: contadores.simple_product + 1,
            fluxo: "preset_cadeia_minima",
            inputs: [resumirEventoComoInsumo(materiaPrima)],
            nomeProduto: `Produto simples demo ${String(contadores.simple_product + 1).padStart(2, "0")}`,
            metadataExtra: { preset: "cadeia_minima_rastreabilidade" },
          })
          await postarEvento(produtoSimples)

          const produtoComposto = construirEventoAutomatico({
            tipoEvento: "FABRICAR_PRODUTO_COMPOSTO",
            noId: noAtivo.id,
            sequencia: contadores.composite_product + 1,
            fluxo: "preset_cadeia_minima",
            inputs: [resumirEventoComoInsumo(produtoSimples)],
            nomeProduto: `Produto rastreável demo ${String(contadores.composite_product + 1).padStart(2, "0")}`,
            metadataExtra: { preset: "cadeia_minima_rastreabilidade" },
          })
          await postarEvento(produtoComposto)

          await invalidarConsultasEventos()
          return {
            propagado: propagarRede,
            eventos: eventosCriados,
            insumosSelecionados,
            titulo: "Preset executado com sucesso",
            descricao: "A cadeia mínima para rastreabilidade foi criada no backend real com matéria-prima, produto simples e produto composto.",
          }
        }

        const algodao = construirEventoAutomatico({
          tipoEvento: "CADASTRAR_MATERIA_PRIMA",
          noId: noAtivo.id,
          sequencia: contadores.raw_material + 1,
          fluxo: "preset_cadeia_textil",
          nomeProduto: "Algodão cru demo",
          actorId: `FORNECEDOR-TEXTIL-${noAtivo.id.toUpperCase()}`,
          metadataExtra: { preset: "cadeia_textil_exemplo", segmento: "textil" },
        })
        await postarEvento(algodao)

        const tecido = construirEventoAutomatico({
          tipoEvento: "FABRICAR_PRODUTO_SIMPLES",
          noId: noAtivo.id,
          sequencia: contadores.simple_product + 1,
          fluxo: "preset_cadeia_textil",
          inputs: [resumirEventoComoInsumo(algodao)],
          nomeProduto: "Tecido técnico demo",
          actorId: `FABRICANTE-TEXTIL-${noAtivo.id.toUpperCase()}`,
          metadataExtra: { preset: "cadeia_textil_exemplo", segmento: "textil" },
        })
        await postarEvento(tecido)

        const camiseta = construirEventoAutomatico({
          tipoEvento: "FABRICAR_PRODUTO_COMPOSTO",
          noId: noAtivo.id,
          sequencia: contadores.composite_product + 1,
          fluxo: "preset_cadeia_textil",
          inputs: [resumirEventoComoInsumo(tecido)],
          nomeProduto: "Camiseta demo rastreável",
          actorId: `MONTADORA-TEXTIL-${noAtivo.id.toUpperCase()}`,
          metadataExtra: { preset: "cadeia_textil_exemplo", segmento: "textil" },
        })
        await postarEvento(camiseta)

        await invalidarConsultasEventos()
        return {
          propagado: propagarRede,
          eventos: eventosCriados,
          insumosSelecionados,
          titulo: "Preset têxtil executado com sucesso",
          descricao: "Algodão cru, tecido técnico e camiseta demo foram registrados em sequência usando o backend real.",
        }
      } catch (erro) {
        if (erro instanceof ErroOperacaoEventos) {
          throw erro
        }

        const mensagem = erro instanceof Error ? erro.message : "Falha ao executar a operação rápida."
        throw new ErroOperacaoEventos(mensagem, eventosCriados, insumosSelecionados)
      }
    },
    onMutate: () => {
      setFeedbackMineracao(null)
      setResultadoOperacao(null)
    },
    onSuccess: (resultado, operacao) => {
      setResultadoOperacao({
        status: "sucesso",
        titulo: resultado.titulo,
        descricao: resultado.descricao,
        propagado: resultado.propagado,
        nomeNo: noAtivo.nome,
        eventos: resultado.eventos,
        insumosSelecionados: resultado.insumosSelecionados,
        rotuloOperacao: rotuloOperacao(operacao),
        operacao,
      })
    },
    onError: (erro, operacao) => {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao executar a criação rápida."
      const eventos = erro instanceof ErroOperacaoEventos ? erro.eventos : []
      const insumosSelecionados = erro instanceof ErroOperacaoEventos ? erro.insumosSelecionados : []
      setResultadoOperacao({
        status: "erro",
        titulo: "Não foi possível concluir a operação rápida",
        descricao: mensagem,
        propagado: propagarRede,
        nomeNo: noAtivo.nome,
        eventos,
        insumosSelecionados,
        rotuloOperacao: rotuloOperacao(operacao),
        operacao,
      })
    },
  })

  const mutationMineracao = useMutation({
    mutationFn: () => minerarNo(noAtivo),
    onMutate: () => {
      setFeedbackMineracao(null)
    },
    onSuccess: async (resultado) => {
      await invalidarConsultasEventos()
      if (resultado.status === "bloco_minerado" && resultado.bloco) {
        setFeedbackMineracao(`Bloco #${resultado.bloco.index} minerado em ${noAtivo.nome}.`)
        return
      }

      if (resultado.status === "sem_eventos_pendentes") {
        setFeedbackMineracao(`Não havia eventos pendentes para minerar em ${noAtivo.nome}.`)
        return
      }

      setFeedbackMineracao(`A mineração respondeu com status ${resultado.status}.`)
    },
    onError: (erro) => {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao minerar neste nó."
      setFeedbackMineracao(mensagem)
    },
  })

  const mensagemErroMutacaoManual = mutationManual.error instanceof Error ? mutationManual.error.message : null

  function atualizar<K extends keyof FormularioAvancado>(campo: K, valor: FormularioAvancado[K]) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }))
  }

  const payloadPreview = useMemo(() => {
    let metadataExtra: Record<string, unknown> = {}
    if (formulario.metadata_extra.trim()) {
      try {
        metadataExtra = JSON.parse(formulario.metadata_extra)
      } catch {
        metadataExtra = { metadata_invalida: formulario.metadata_extra }
      }
    }

    return {
      event_id: formulario.event_id,
      event_type: tipoEvento,
      entity_kind: tipoEntidadePorEvento(tipoEvento),
      product_id: formulario.product_id,
      product_name: formulario.product_name,
      actor_id: formulario.actor_id,
      actor_role: papelPorEvento(tipoEvento),
      timestamp: new Date().toISOString(),
      input_ids: tipoEvento === "CADASTRAR_MATERIA_PRIMA" ? [] : formulario.input_ids,
      metadata: {
        lot_id: formulario.lot_id || formulario.product_id || undefined,
        ...metadataExtra,
      },
    }
  }, [formulario, tipoEvento])

  function validarPayload() {
    if (!formulario.event_id.trim() || !formulario.product_id.trim() || !formulario.product_name.trim()) {
      return "Preencha ID do evento, ID do item e nome."
    }
    if (!formulario.actor_id.trim()) {
      return "Preencha o ator responsável pelo evento."
    }
    if (tipoEvento !== "CADASTRAR_MATERIA_PRIMA" && formulario.input_ids.length === 0) {
      return "Selecione ao menos um input_id válido."
    }
    if (
      tipoEvento === "FABRICAR_PRODUTO_COMPOSTO"
      && !possuiInsumoDerivadoSelecionado(itensFiltradosManual, formulario.input_ids)
    ) {
      return "Produto composto precisa incluir ao menos um produto simples ou composto nos inputs."
    }
    if (formulario.metadata_extra.trim()) {
      try {
        JSON.parse(formulario.metadata_extra)
      } catch {
        return "O campo de metadata extra precisa ser um JSON válido."
      }
    }
    return null
  }

  function submeter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const erro = validarPayload()
    setErroFormulario(erro)
    if (erro) {
      return
    }
    setFeedbackMineracao(null)
    mutationManual.mutate(payloadPreview as EventoBlockchain)
  }

  if (cadeia.isLoading || mempool.isLoading) {
    return <CarregandoPainel mensagem="Preparando ações rápidas, presets e insumos disponíveis..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Eventos do Domínio"
        descricao="Crie matéria-prima, produtos simples e compostos com fluxo rápido para demonstrações ou use o modo avançado para controle total sobre o payload enviado ao backend real."
      />

      <CartaoPainel
        titulo="Criação rápida"
        descricao="O fluxo principal da página. IDs, metadata, ator e timestamp são gerados automaticamente para acelerar testes e demonstrações."
        destaque={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
              nó alvo: {noAtivo.nome}
            </span>
            <button
              type="button"
              onClick={() => setPropagarRede((estadoAtual) => !estadoAtual)}
              disabled={mutationOperacaoRapida.isPending || mutationManual.isPending}
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                propagarRede
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-slate-200 bg-slate-50 text-slate-600",
              )}
            >
              <Send className="h-3.5 w-3.5" />
              {propagarRede ? "propagação em rede" : "somente nó atual"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 xl:grid-cols-3">
          <QuickCreateCard
            titulo="Nova matéria-prima"
            descricao="Cria um insumo inicial válido sem precisar escolher inputs ou preencher formulário."
            icone={Zap}
            nota="Sem dependências anteriores. O evento é montado automaticamente e enviado direto para o backend do nó ativo."
            botao="Criar matéria-prima"
            carregando={mutationOperacaoRapida.isPending}
            onExecutar={() => mutationOperacaoRapida.mutate({ kind: "quick", tipoEvento: "CADASTRAR_MATERIA_PRIMA" })}
          />

          <QuickCreateCard
            titulo="Novo produto simples"
            descricao="Escolhe automaticamente a primeira matéria-prima válida disponível e fabrica um item intermediário."
            icone={Sparkles}
            nota={
              materiaPrimaRapida
                ? `O sistema vai usar ${materiaPrimaRapida.product_name}, priorizando itens confirmados e não consumidos.`
                : "Crie primeiro uma matéria-prima para habilitar este atalho de criação rápida."
            }
            insumosSelecionados={materiaPrimaRapida ? [materiaPrimaRapida] : []}
            botao="Criar produto simples"
            disabled={!materiaPrimaRapida}
            carregando={mutationOperacaoRapida.isPending}
            onExecutar={() => mutationOperacaoRapida.mutate({ kind: "quick", tipoEvento: "FABRICAR_PRODUTO_SIMPLES" })}
          />

          <QuickCreateCard
            titulo="Novo produto composto"
            descricao="Monta automaticamente uma composição válida usando o melhor conjunto de insumos disponível no nó ativo."
            icone={Sparkles}
            nota={
              insumosRapidosComposto.length > 0
                ? `A composição será montada com ${insumosRapidosComposto.map((item) => item.product_name).join(" + ")}.`
                : "Nenhum insumo compatível disponível para criação rápida de produto composto. Gere primeiro uma matéria-prima e um produto simples."
            }
            insumosSelecionados={insumosRapidosComposto}
            botao="Criar produto composto"
            disabled={insumosRapidosComposto.length === 0}
            carregando={mutationOperacaoRapida.isPending}
            onExecutar={() => mutationOperacaoRapida.mutate({ kind: "quick", tipoEvento: "FABRICAR_PRODUTO_COMPOSTO" })}
          />
        </div>

        {resultadoOperacao ? (
          <div className="mt-5">
            <QuickCreateResultCard
              status={resultadoOperacao.status}
              titulo={resultadoOperacao.titulo}
              descricao={resultadoOperacao.descricao}
              eventos={resultadoOperacao.eventos}
              nomeNo={resultadoOperacao.nomeNo}
              propagado={resultadoOperacao.propagado}
              rotuloOperacao={resultadoOperacao.rotuloOperacao}
              insumosSelecionados={resultadoOperacao.insumosSelecionados}
              onRepetir={() => mutationOperacaoRapida.mutate(resultadoOperacao.operacao)}
              onMinerar={() => mutationMineracao.mutate()}
              minerando={mutationMineracao.isPending}
              feedbackMineracao={feedbackMineracao}
            />
          </div>
        ) : null}
      </CartaoPainel>

      <CartaoPainel
        titulo="Fluxos de exemplo / presets"
        descricao="Sequências prontas para deixar o sistema com estado útil rapidamente, sem pensar nos detalhes do payload."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <QuickPresetCard
            titulo="Criar cadeia mínima para rastreabilidade"
            descricao="Gera uma matéria-prima, um produto simples e um produto composto em sequência para popular mempool, blockchain e rastreabilidade rapidamente."
            etapas={["matéria-prima", "produto simples", "produto composto"]}
            carregando={mutationOperacaoRapida.isPending}
            onExecutar={() => mutationOperacaoRapida.mutate({ kind: "preset", presetId: "cadeia-minima" })}
          />

          <QuickPresetCard
            titulo="Criar cadeia têxtil de exemplo"
            descricao="Gera um fluxo didático com algodão cru, tecido técnico e camiseta demo, pronto para usar em sala ou em testes de rastreabilidade."
            etapas={["algodão cru", "tecido técnico", "camiseta demo"]}
            carregando={mutationOperacaoRapida.isPending}
            onExecutar={() => mutationOperacaoRapida.mutate({ kind: "preset", presetId: "cadeia-textil" })}
          />
        </div>
      </CartaoPainel>

      <CartaoPainel
        titulo="Modo avançado"
        descricao="Fluxo manual para controle total sobre IDs, ator, inputs e metadata enviados ao backend."
      >
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <form className="space-y-8" onSubmit={submeter}>
              <div className="grid w-full border-b border-slate-200/80 sm:grid-cols-3">
                {TIPOS_EVENTO.map((item) => (
                  <button
                    key={item.valor}
                    type="button"
                    onClick={() => {
                      setTipoEvento(item.valor)
                      setErroFormulario(null)
                      mutationManual.reset()
                      setFormulario((atual) => ({ ...atual, input_ids: [] }))
                    }}
                    className={cx(
                      "inline-flex items-center justify-center whitespace-nowrap border-b-2 px-4 py-3 text-base font-medium tracking-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
                      tipoEvento === item.valor
                        ? "border-primary text-slate-900"
                        : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800",
                    )}
                  >
                    {item.rotulo}
                  </button>
                ))}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>ID do evento</label>
                  <input
                    value={formulario.event_id}
                    onChange={(event) => atualizar("event_id", event.target.value)}
                    className={CLASSE_CAMPO}
                    placeholder="EVT-0001"
                  />
                </div>
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>ID do item</label>
                  <input
                    value={formulario.product_id}
                    onChange={(event) => atualizar("product_id", event.target.value)}
                    className={CLASSE_CAMPO}
                    placeholder="BICICLETA-LOTE-001"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>Nome do item</label>
                  <input
                    value={formulario.product_name}
                    onChange={(event) => atualizar("product_name", event.target.value)}
                    className={CLASSE_CAMPO}
                    placeholder="Bicicleta urbana"
                  />
                </div>
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>{tituloAtor(tipoEvento)}</label>
                  <input
                    value={formulario.actor_id}
                    onChange={(event) => atualizar("actor_id", event.target.value)}
                    className={CLASSE_CAMPO}
                    placeholder="FORNECEDOR-XYZ-CNPJ"
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>Lot ID</label>
                  <input
                    value={formulario.lot_id}
                    onChange={(event) => atualizar("lot_id", event.target.value)}
                    className={CLASSE_CAMPO}
                    placeholder="Opcional; cai em metadata.lot_id"
                  />
                </div>
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>Propagação</label>
                  <button
                    type="button"
                    onClick={() => setPropagarRede((estadoAtual) => !estadoAtual)}
                    disabled={mutationOperacaoRapida.isPending || mutationManual.isPending}
                    className={cx(
                      `${CLASSE_CAMPO} flex items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-70`,
                      propagarRede ? "border-emerald-200 bg-emerald-50/70" : "",
                    )}
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {propagarRede ? "Propagar o evento para a rede via Kafka" : "Registrar somente no nó ativo"}
                    </span>
                    <span className={cx(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                      propagarRede ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700",
                    )}>
                      {propagarRede ? "rede" : "local"}
                    </span>
                  </button>
                </div>
              </div>

              {tipoEvento !== "CADASTRAR_MATERIA_PRIMA" ? (
                <div className="space-y-2">
                  <label className={CLASSE_ROTULO_CAMPO}>Seleção guiada de input_ids</label>
                  <SeletorInputs
                    itens={itensFiltradosManual}
                    selecionados={formulario.input_ids}
                    onChange={(inputIds) => atualizar("input_ids", inputIds)}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>Metadata extra</label>
                <textarea
                  value={formulario.metadata_extra}
                  onChange={(event) => atualizar("metadata_extra", event.target.value)}
                  className={`${CLASSE_CAMPO} min-h-32 font-mono text-sm leading-6`}
                  placeholder='{"origem":"Usina A","certificacao":"ISO 9001"}'
                />
              </div>

              {(erroFormulario || mensagemErroMutacaoManual) ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {erroFormulario ?? mensagemErroMutacaoManual}
                </div>
              ) : null}

              {mutationManual.isSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Evento enviado com sucesso para {noAtivo.nome}.
                </div>
              ) : null}

              <div className="flex flex-col gap-5 border-t border-slate-100 pt-6 md:flex-row md:items-end md:justify-between">
                <p className="max-w-2xl text-sm leading-7 text-slate-500">
                  Aqui você controla manualmente IDs, ator, metadata e escolha de insumos. O frontend continua fixando automaticamente `entity_kind` e `actor_role` conforme o tipo selecionado.
                </p>
                <button
                  type="submit"
                  disabled={mutationManual.isPending}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-2xl bg-primary-gradient px-6 py-3.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {mutationManual.isPending ? "Enviando..." : "Registrar evento manualmente"}
                </button>
              </div>
            </form>

            <div className="space-y-4">
              <PreviewPayload titulo="Preview do payload manual" payload={payloadPreview} />
              <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/70 p-4 text-sm leading-7 text-slate-600">
                Use o modo avançado quando precisar reproduzir um caso específico, forçar IDs previsíveis ou depurar validações com total controle do payload.
              </div>
            </div>
          </div>
      </CartaoPainel>

      <CartaoPainel
        titulo="Itens disponíveis / insumos utilizáveis"
        descricao="Resumo rápido do que já existe no nó ativo e do que pode ser reutilizado na criação rápida ou manual."
      >
        <ResumoDisponibilidadeEventos
          materiasPrimas={disponibilidadeResumo.raw_material}
          produtosSimples={disponibilidadeResumo.simple_product}
          produtosCompostos={disponibilidadeResumo.composite_product}
        />

        <div className="mt-5 rounded-[1.4rem] border border-primary/15 bg-primary/5 px-4 py-4 text-sm leading-7 text-slate-600">
          A seleção automática usa primeiro itens disponíveis e confirmados; se não houver confirmados, ela pode recorrer a itens pendentes já válidos na mempool do nó ativo.
        </div>

        <div className="mt-5">
          <CatalogoItens
            itens={itensInsumo}
            titulo="Catálogo resumido de itens"
            descricao="Consulte o que já existe, o que foi consumido e o que ainda pode ser usado como insumo antes de disparar novos eventos."
          />
        </div>
      </CartaoPainel>

      <div className="flex justify-end">
        <Link
          to="/mempool"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
        >
          Ver mempool atual
        </Link>
      </div>
    </div>
  )
}
