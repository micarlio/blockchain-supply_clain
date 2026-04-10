import { Activity, Blocks, Database, Gauge, Pickaxe } from "lucide-react"
import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { BadgeEntidade } from "../componentes/comum/badge_entidade"
import { BadgeEvento } from "../componentes/comum/badge_evento"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { DetalhesBloco } from "../componentes/comum/detalhes_bloco"
import { KpiCompacto } from "../componentes/dashboard/kpi_compacto"
import { rotuloPapelNo } from "../lib/dominio/dominio"
import { minerarNo, useCadeiaNo, useEstadoNo, useMempoolNo } from "../lib/api/servicos"
import { encurtarHash, formatarData } from "../lib/util/formatacao"

const CLASSE_CARTAO = "p-8"
const CLASSE_BLOCO_APOIO = "rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-5"
const CLASSE_ROTULO = "text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500"

type ResumoOperacao = {
  valor: string
  subtitulo: string
  rotulo: string
  classeRotulo: string
}

type MensagemResultado = {
  titulo: string
  descricao: string
  classe: string
}

function construirResumoOperacao(args: {
  isPending: boolean
  isError: boolean
  status?: string
  blocoIndex?: number
  nomeNo: string
}): ResumoOperacao {
  if (args.isPending) {
    return {
      valor: "PoW",
      subtitulo: "buscando nonce no backend",
      rotulo: "minerando",
      classeRotulo: "bg-amber-100 text-amber-800",
    }
  }

  if (args.isError) {
    return {
      valor: "Erro",
      subtitulo: "falha ao executar a mineração",
      rotulo: "falha",
      classeRotulo: "bg-red-100 text-red-700",
    }
  }

  if (args.status === "bloco_minerado" && args.blocoIndex !== undefined) {
    return {
      valor: `#${args.blocoIndex}`,
      subtitulo: "último bloco retornado pela rodada",
      rotulo: "bloco minerado",
      classeRotulo: "bg-emerald-100 text-emerald-800",
    }
  }

  if (args.status === "sem_eventos_pendentes") {
    return {
      valor: "Sem fila",
      subtitulo: "não havia eventos disponíveis",
      rotulo: "mempool vazia",
      classeRotulo: "bg-slate-200 text-slate-700",
    }
  }

  if (args.status === "mineracao_indisponivel") {
    return {
      valor: "Bloqueado",
      subtitulo: "o nó ativo não aceita mineração",
      rotulo: "indisponível",
      classeRotulo: "bg-red-100 text-red-700",
    }
  }

  return {
    valor: "Pronto",
    subtitulo: `operação manual em ${args.nomeNo}`,
    rotulo: "aguardando",
    classeRotulo: "bg-blue-100 text-blue-800",
  }
}

function construirMensagemResultado(args: {
  isPending: boolean
  isError: boolean
  mensagemErro: string | null
  status?: string
  motivo?: string
  blocoIndex?: number
  blocoHash?: string
}): MensagemResultado {
  if (args.isPending) {
    return {
      titulo: "Processando a prova de trabalho",
      descricao: "O backend está tentando montar o bloco candidato e encontrar um nonce válido para a dificuldade atual.",
      classe: "border-amber-200 bg-amber-50 text-amber-900",
    }
  }

  if (args.isError) {
    return {
      titulo: "Falha ao chamar o endpoint de mineração",
      descricao: args.mensagemErro ?? "A API do nó ativo não devolveu uma resposta válida para a operação.",
      classe: "border-red-200 bg-red-50 text-red-700",
    }
  }

  if (args.status === "bloco_minerado" && args.blocoIndex !== undefined) {
    return {
      titulo: `Bloco #${args.blocoIndex} minerado com sucesso`,
      descricao: `Hash retornado: ${encurtarHash(args.blocoHash, 24)}. O painel abaixo mostra o cabeçalho completo, os eventos confirmados e os hashes calculados.`,
      classe: "border-emerald-200 bg-emerald-50 text-emerald-800",
    }
  }

  if (args.status === "sem_eventos_pendentes") {
    return {
      titulo: "Nenhum evento aguardando mineração",
      descricao: "Adicione novos eventos na aba de eventos ou aguarde a propagação da rede para montar o próximo bloco candidato.",
      classe: "border-slate-200 bg-slate-50 text-slate-700",
    }
  }

  if (args.status === "mineracao_indisponivel") {
    return {
      titulo: "O nó ativo não pode minerar",
      descricao: `Motivo retornado pela API: ${args.motivo ?? "indisponível"}. Selecione um nó que aceite mineração manual para disparar a operação.`,
      classe: "border-red-200 bg-red-50 text-red-700",
    }
  }

  return {
    titulo: "Rodada pronta para execução",
    descricao: "A mineração manual usa o endpoint real do nó ativo. Quando houver bloco minerado, ele aparecerá no painel à direita com todos os detalhes.",
    classe: "border-blue-200 bg-blue-50 text-blue-800",
  }
}

export function MineracaoPagina() {
  const { noAtivo } = useNos()
  const clienteConsulta = useQueryClient()
  const estado = useEstadoNo(noAtivo)
  const mempool = useMempoolNo(noAtivo)
  const cadeia = useCadeiaNo(noAtivo)

  const mutation = useMutation({
    mutationFn: () => minerarNo(noAtivo),
    onSuccess: async () => {
      await Promise.all([
        clienteConsulta.invalidateQueries({ queryKey: ["mempool-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["estado-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", noAtivo.id, noAtivo.url] }),
      ])
    },
  })

  const mensagemErroMineracao = mutation.error instanceof Error ? mutation.error.message : null

  const cadeiaAtiva = useMemo(() => cadeia.data?.cadeia_ativa ?? [], [cadeia.data])
  const blocoAtual = useMemo(() => cadeiaAtiva.at(-1), [cadeiaAtiva])
  const eventosPendentes = useMemo(() => mempool.data?.eventos ?? [], [mempool.data])
  const blocoMinerado = mutation.data?.bloco
  const proximoIndice = (blocoAtual?.index ?? 0) + 1

  const resumoOperacao = useMemo(
    () =>
      construirResumoOperacao({
        isPending: mutation.isPending,
        isError: mutation.isError,
        status: mutation.data?.status,
        blocoIndex: blocoMinerado?.index,
        nomeNo: noAtivo.nome,
      }),
    [mutation.isPending, mutation.isError, mutation.data, blocoMinerado, noAtivo.nome],
  )

  const mensagemResultado = useMemo(
    () =>
      construirMensagemResultado({
        isPending: mutation.isPending,
        isError: mutation.isError,
        mensagemErro: mensagemErroMineracao,
        status: mutation.data?.status,
        motivo: mutation.data?.motivo,
        blocoIndex: blocoMinerado?.index,
        blocoHash: blocoMinerado?.block_hash,
      }),
    [mutation.isPending, mutation.isError, mensagemErroMineracao, mutation.data, blocoMinerado],
  )

  if (estado.isLoading || cadeia.isLoading || mempool.isLoading) {
    return <CarregandoPainel mensagem="Coletando dados de mineração do nó ativo..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Painel de Mineração"
        descricao="Acompanhe a operação manual de mineração, o contexto do próximo bloco e o resultado real do Proof of Work do nó ativo."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCompacto
          titulo="Estado da rodada"
          valor={resumoOperacao.valor}
          subtitulo={resumoOperacao.subtitulo}
          icone={Pickaxe}
          destaque={<span className={`h-2.5 w-2.5 rounded-full ${mutation.isPending ? "bg-amber-400" : blocoMinerado ? "bg-emerald-400" : "bg-blue-400"}`} />}
        />
        <KpiCompacto
          titulo="Eventos na mempool"
          valor={mempool.data?.quantidade ?? 0}
          subtitulo="aguardando o próximo bloco"
          icone={Database}
        />
        <KpiCompacto
          titulo="Dificuldade ativa"
          valor={estado.data?.difficulty ?? 0}
          subtitulo="proof of work configurado"
          icone={Gauge}
        />
        <KpiCompacto
          titulo="Próximo índice"
          valor={`#${proximoIndice}`}
          subtitulo="bloco candidato esperado"
          icone={Blocks}
        />
      </section>

      <div className="space-y-8">
        <CartaoPainel
          titulo="Executar mineração manual"
          descricao="Mesmo fluxo visual das outras abas, mas usando o endpoint real de mineração do nó selecionado."
          className={CLASSE_CARTAO}
          destaque={
            <span className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] ${resumoOperacao.classeRotulo}`}>
              {resumoOperacao.rotulo}
            </span>
          }
        >
          <div className="grid items-start gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4">
              <div className={CLASSE_BLOCO_APOIO}>
                <p className={CLASSE_ROTULO}>Operação do nó</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                  Mineração manual em {noAtivo.nome}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  Ao disparar a chamada, o backend consulta a mempool local, monta o bloco candidato com o `previous_hash` atual e tenta resolver o Proof of Work antes de publicar o resultado.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                    POST /demonstracao/minerar
                  </span>
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {rotuloPapelNo(estado.data?.papel_no ?? "-")}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className={CLASSE_BLOCO_APOIO}>
                  <p className={CLASSE_ROTULO}>Hash de referência</p>
                  <p className="mt-3 break-all font-mono text-sm font-semibold text-primary">
                    {encurtarHash(blocoAtual?.block_hash, 26)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">hash usado como `previous_hash` do próximo candidato</p>
                </div>

                <div className={CLASSE_BLOCO_APOIO}>
                  <p className={CLASSE_ROTULO}>Altura atual</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                    {estado.data?.altura_cadeia ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">blocos conhecidos pelo nó ativo</p>
                </div>

                <div className={CLASSE_BLOCO_APOIO}>
                  <p className={CLASSE_ROTULO}>Eventos elegíveis</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                    {eventosPendentes.length}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">itens aguardando tentativa de mineração</p>
                </div>

                <div className={CLASSE_BLOCO_APOIO}>
                  <p className={CLASSE_ROTULO}>Último bloco confirmado</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                    #{blocoAtual?.index ?? 0}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">ponta atual da cadeia deste nó</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/50">
              <div className="flex flex-col gap-8 rounded-[calc(1.5rem-1px)] bg-white p-6">
                <div>
                  <p className={CLASSE_ROTULO}>Execução da rodada</p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
                    Buscar o próximo nonce válido
                  </h3>
                  <p className="mt-3 max-w-prose text-sm leading-7 text-slate-500">
                    O botão abaixo dispara a mineração manual no backend real. Se a mempool estiver vazia, a API informa que não há trabalho a executar.
                  </p>
                </div>

                <div className="space-y-4 border-t border-slate-200/70 pt-5">
                  <button
                    type="button"
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-primary/20 bg-primary/5 px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {mutation.isPending ? "Buscando nonce..." : "Minerar agora"}
                  </button>

                  <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-900">Status da chamada</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${resumoOperacao.classeRotulo}`}>
                        {resumoOperacao.rotulo}
                      </span>
                    </div>
                    <p className="mt-2 leading-6">{resumoOperacao.subtitulo}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`mt-6 rounded-[1.4rem] border px-5 py-4 ${mensagemResultado.classe}`}>
            <p className="text-sm font-semibold">{mensagemResultado.titulo}</p>
            <p className="mt-1 text-sm leading-7">{mensagemResultado.descricao}</p>
          </div>
        </CartaoPainel>

        <div className="grid gap-8 xl:grid-cols-2">
          <CartaoPainel
            titulo="Bloco resultante"
            descricao="Detalhe completo do último bloco retornado pela operação manual de mineração."
            className={CLASSE_CARTAO}
            destaque={
              blocoMinerado ? (
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  {formatarData(blocoMinerado.timestamp)}
                </span>
              ) : undefined
            }
          >
            {blocoMinerado ? (
              <DetalhesBloco bloco={blocoMinerado} />
            ) : (
              <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
                  Nenhum bloco retornado ainda
                </h3>
                <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-slate-500">
                  Execute uma rodada manual para ver aqui o bloco minerado. Se a API responder que a mempool está vazia ou que o nó não pode minerar, o painel acima explicará o motivo.
                </p>
              </div>
            )}
          </CartaoPainel>

          <CartaoPainel
            titulo="Referência da cadeia ativa"
            descricao="Resumo do bloco atual usado como base para montar o próximo candidato deste nó."
            className={CLASSE_CARTAO}
            destaque={
              blocoAtual ? (
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                  {formatarData(blocoAtual.timestamp)}
                </span>
              ) : undefined
            }
          >
            {blocoAtual ? (
              <div className="space-y-6">
                <div className="rounded-[1.4rem] bg-primary/5 p-5">
                  <p className={CLASSE_ROTULO}>Hash do bloco atual</p>
                  <p className="mt-3 break-all font-mono text-sm font-semibold tracking-tight text-primary">
                    {blocoAtual.block_hash}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <p className={CLASSE_ROTULO}>Índice</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">#{blocoAtual.index}</p>
                  </div>
                  <div>
                    <p className={CLASSE_ROTULO}>Minerador</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{blocoAtual.miner_id ?? "gênesis"}</p>
                  </div>
                  <div>
                    <p className={CLASSE_ROTULO}>Eventos</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{blocoAtual.event_count}</p>
                  </div>
                  <div>
                    <p className={CLASSE_ROTULO}>Dificuldade</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{blocoAtual.difficulty}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.2rem] border-l-2 border-slate-200 bg-slate-50/70 p-4">
                    <p className={CLASSE_ROTULO}>Hash anterior</p>
                    <p className="mt-2 break-all font-mono text-xs font-medium text-slate-600">
                      {blocoAtual.previous_hash}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border-l-2 border-slate-200 bg-slate-50/70 p-4">
                    <p className={CLASSE_ROTULO}>Data hash</p>
                    <p className="mt-2 break-all font-mono text-xs font-medium text-slate-600">
                      {blocoAtual.data_hash}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-6 text-sm text-slate-500">
                O nó ativo ainda não devolveu uma referência de cadeia válida.
              </div>
            )}
          </CartaoPainel>
        </div>

        <CartaoPainel
          titulo="Eventos prontos para a próxima rodada"
          descricao="Fila atual observada pelo nó ativo antes da montagem do próximo bloco."
          className={CLASSE_CARTAO}
          destaque={
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              {eventosPendentes.length} pendentes
            </span>
          }
        >
          {eventosPendentes.length === 0 ? (
            <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-6 text-sm text-slate-500">
              Nenhum evento está aguardando mineração neste nó. Cadastre novos eventos na aba de domínio ou espere a propagação da rede.
            </div>
          ) : (
            <div className="space-y-4">
              {eventosPendentes.slice(0, 4).map((evento) => (
                <div key={evento.event_id} className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <BadgeEvento tipo={evento.event_type} />
                    <BadgeEntidade tipo={evento.entity_kind} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                    <div>
                      <p className="text-base font-semibold tracking-tight text-slate-900">{evento.product_name}</p>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>{evento.product_id}</span>
                        <span className="font-mono">{encurtarHash(evento.event_id, 18)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className={CLASSE_ROTULO}>Inputs</p>
                        <p className="mt-2 font-semibold text-slate-900">{evento.input_ids.length}</p>
                      </div>
                      <div>
                        <p className={CLASSE_ROTULO}>Ator</p>
                        <p className="mt-2 truncate font-semibold text-slate-900">{evento.actor_id}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {eventosPendentes.length > 4 && (
                <p className="text-sm text-slate-500">
                  + {eventosPendentes.length - 4} evento{eventosPendentes.length - 4 > 1 ? "s" : ""} ainda aguardando na mempool.
                </p>
              )}
            </div>
          )}
        </CartaoPainel>
      </div>
    </div>
  )
}
