import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Box, Database, FileText, Layers } from "lucide-react"
import { useNos } from "../app/contexto_nos"
import { BadgeEntidade } from "../componentes/comum/badge_entidade"
import { BadgeEvento } from "../componentes/comum/badge_evento"
import { BadgeStatus } from "../componentes/comum/badge_status"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { EstadoVazio } from "../componentes/comum/estado_vazio"
import { KpiCompacto } from "../componentes/dashboard/kpi_compacto"
import { useDemonstracoesNos, useMempoolNo, minerarNo } from "../lib/api/servicos"
import { formatarData } from "../lib/util/formatacao"
import { construirMapaOrigemNo } from "../lib/util/insumos"

export function MempoolPagina() {
  const { noAtivo, nos } = useNos()
  const clienteConsulta = useQueryClient()
  const mempool = useMempoolNo(noAtivo)
  const demonstracoes = useDemonstracoesNos(nos)

  const origemPorEvento = useMemo(
    () =>
      construirMapaOrigemNo(
        demonstracoes.map((consulta, indice) => ({ noId: nos[indice].id, dados: consulta.data })),
      ),
    [demonstracoes, nos],
  )

  const mineracao = useMutation({
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

  const mensagemErroMineracao = mineracao.error instanceof Error ? mineracao.error.message : null

  if (mempool.isLoading) {
    return <CarregandoPainel mensagem="Consultando eventos pendentes no nó ativo..." />
  }

  const eventos = mempool.data?.eventos ?? []
  const countRaw = eventos.filter((evento) => evento.entity_kind === "raw_material").length
  const countSimple = eventos.filter((evento) => evento.entity_kind === "simple_product").length
  const countComposite = eventos.filter((evento) => evento.entity_kind === "composite_product").length

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Fila de Mineração"
        descricao="Acompanhe os eventos pendentes por nó, veja a origem de cada item e dispare mineração manual."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCompacto
          titulo="Eventos pendentes"
          valor={eventos.length}
          subtitulo="total na fila do nó"
          icone={Database}
          destaque={eventos.length > 0 && <span className="flex h-2 w-2 rounded-full bg-amber-400" />}
        />
        <KpiCompacto
          titulo="Matéria-prima"
          valor={countRaw}
          subtitulo="insumos básicos"
          icone={Layers}
        />
        <KpiCompacto
          titulo="Produto simples"
          valor={countSimple}
          subtitulo="itens transformados"
          icone={FileText}
        />
        <KpiCompacto
          titulo="Produto composto"
          valor={countComposite}
          subtitulo="combinação de insumos"
          icone={Box}
        />
      </section>

      <CartaoPainel
        titulo="Mempool do nó ativo"
        descricao={`Fila atual de ${noAtivo.nome}. O backend devolve o estado real, sem mock.`}
        destaque={
          <button
            type="button"
            onClick={() => mineracao.mutate()}
            disabled={mineracao.isPending}
            className="rounded-xl bg-primary-gradient px-4 py-2 text-sm font-semibold text-on-primary transition-[transform,opacity] hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mineracao.isPending ? "Minerando..." : "Minerar agora neste nó"}
          </button>
        }
      >
        {mensagemErroMineracao && (
          <div className="mb-4 rounded-xl bg-error-container px-4 py-3 text-sm text-error">
            {mensagemErroMineracao}
          </div>
        )}
        {mineracao.isSuccess && (
          <div className="mb-4 rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-800">
            Resultado: {mineracao.data.status}
          </div>
        )}

        {eventos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum evento pendente"
            descricao="Cadastre eventos reais ou espere a propagação de outros nós para ver a fila viva."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/80">
            <div className="grid grid-cols-[170px_210px_1fr_180px_160px_120px] gap-4 border-b border-slate-200/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <div>Evento</div>
              <div>Tipo / Entidade</div>
              <div>Item</div>
              <div>Input IDs</div>
              <div>Origem</div>
              <div>Status</div>
            </div>
            <div className="divide-y divide-slate-200/70">
              {eventos.map((evento) => (
                <div
                  key={evento.event_id}
                  className="grid grid-cols-[170px_210px_1fr_180px_160px_120px] gap-4 px-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary">{evento.event_id}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{formatarData(evento.timestamp)}</p>
                  </div>
                  <div className="space-y-2">
                    <BadgeEvento tipo={evento.event_type} />
                    <BadgeEntidade tipo={evento.entity_kind} />
                  </div>
                  <div>
                    <p className="font-semibold">{evento.product_name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{evento.product_id}</p>
                  </div>
                  <div className="space-y-1">
                    {evento.input_ids.length === 0 ? (
                      <span className="text-xs text-on-surface-variant">sem insumos</span>
                    ) : (
                      evento.input_ids.map((inputId) => (
                        <div
                          key={inputId}
                          className="rounded-full bg-surface-container-high px-2.5 py-1 font-mono text-xs text-on-surface-variant"
                        >
                          {inputId}
                        </div>
                      ))
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{origemPorEvento.get(evento.event_id) ?? "nó não inferido"}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{evento.actor_id}</p>
                  </div>
                  <div>
                    <BadgeStatus status="pendente" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CartaoPainel>
    </div>
  )
}
