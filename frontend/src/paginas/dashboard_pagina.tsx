import { useMemo } from "react"
import { Blocks, Database, GitBranch, Zap } from "lucide-react"
import { Link } from "react-router-dom"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { CartaoNoCluster } from "../componentes/dashboard/cartao_no_cluster"
import { ItemTimelineAtividade } from "../componentes/dashboard/item_timeline_atividade"
import { KpiCompacto } from "../componentes/dashboard/kpi_compacto"
import { LinhaBlocoRecente } from "../componentes/dashboard/linha_bloco_recente"
import { useCadeiaNo, useDemonstracoesNos, useEstadosNos } from "../lib/api/servicos"
import { rotuloPapelNo } from "../lib/dominio/dominio"
import { ordenarDescPorTimestamp } from "../lib/util/formatacao"

export function DashboardPagina() {
  const { nos, noAtivo } = useNos()
  const consultasEstado = useEstadosNos(nos)
  const consultasDemo = useDemonstracoesNos(nos)
  const cadeiaAtiva = useCadeiaNo(noAtivo)

  const estados = consultasEstado.map((consulta, indice) => ({
    no: nos[indice],
    dados: consulta.data,
  }))

  const blocosRecentes = useMemo(() => {
    const blocos = cadeiaAtiva.data?.cadeia_ativa.slice(1) ?? []
    return ordenarDescPorTimestamp(blocos).slice(0, 5)
  }, [cadeiaAtiva.data])

  const atividadesRecentes = useMemo(() => {
    const atividades = consultasDemo.flatMap((consulta) => consulta.data?.atividades ?? [])
    return ordenarDescPorTimestamp(atividades).slice(0, 8)
  }, [consultasDemo])

  const mempoolNoAtivo = estados.find(e => e.no.id === noAtivo.id)?.dados?.quantidade_mempool ?? 0
  const ultimoBloco = blocosRecentes[0]
  const ultimaMineracaoValor = ultimoBloco ? `#${ultimoBloco.index}` : "Gênesis"
  const totalBlocosNoAtivo = cadeiaAtiva.data?.cadeia_ativa.length ?? 0

  const itensRastreaveis = useMemo(() => {
    const itens = new Set<string>()
    const blocos = cadeiaAtiva.data?.cadeia_ativa ?? []
    for (const bloco of blocos) {
      for (const evento of (bloco.events || [])) {
        if (evento.product_id) {
          itens.add(evento.product_id)
        } else if (evento.event_id) {
          itens.add(evento.event_id)
        }
      }
    }
    return itens.size
  }, [cadeiaAtiva.data])

  if (consultasEstado.every((consulta) => consulta.isLoading) || cadeiaAtiva.isLoading) {
    return <CarregandoPainel mensagem="Montando a visão geral do cluster..." />
  }

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Visão Geral"
        descricao="Acompanhe o estado do cluster, os blocos recentes e o fluxo operacional distribuído."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCompacto
          titulo="Eventos pendentes"
          valor={mempoolNoAtivo}
          subtitulo="aguardando mineração"
          icone={Database}
          destaque={
            mempoolNoAtivo > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-amber-400" />
            ) : null
          }
        />

        <KpiCompacto
          titulo="Blockchain do nó ativo"
          valor={totalBlocosNoAtivo}
          subtitulo="blocos confirmados neste nó"
          icone={Blocks}
        />

        <KpiCompacto
          titulo="Itens rastreáveis"
          valor={itensRastreaveis}
          subtitulo="produtos e matérias-primas na cadeia"
          icone={GitBranch}
        />

        <KpiCompacto
          titulo="Última mineração"
          valor={ultimaMineracaoValor}
          subtitulo="último bloco minerado"
          icone={Zap}
        />
      </section>

      <section>
        <CartaoPainel
          titulo="Nós da rede"
          descricao="Comparação rápida entre altura, mempool, hash da ponta e papel de cada nó."
          destaque={
            <Link
              to="/nos"
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/20"
            >
              abrir visão completa
            </Link>
          }
          className="p-5"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {estados.map((item) => (
              <CartaoNoCluster
                key={item.no.id}
                nome={item.no.nome}
                id={item.no.id}
                papel={rotuloPapelNo(item.dados?.papel_no ?? "offline")}
                status={item.dados ? "online" : "offline"}
                altura={item.dados?.altura_cadeia ?? "-"}
                mempool={item.dados?.quantidade_mempool ?? "-"}
                dificuldade={item.dados?.difficulty ?? "-"}
                forks={item.dados?.forks_conhecidos ?? "-"}
                hashPonta={item.dados?.hash_ponta ?? ""}
                ativo={item.no.id === noAtivo.id}
              />
            ))}
          </div>
        </CartaoPainel>
      </section>

      <section className="grid items-stretch gap-6 xl:grid-cols-2">
        <CartaoPainel
          titulo="Blocos recentes"
          descricao="Últimos blocos da cadeia ativa do nó selecionado."
          destaque={
            <Link
              to="/blockchain"
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/20"
            >
              explorar
            </Link>
          }
          className="flex h-full flex-col p-5"
        >
          <div className="flex flex-1 flex-col space-y-3">
            {blocosRecentes.map((bloco, indice) => (
              <LinhaBlocoRecente key={bloco.block_hash} bloco={bloco} destaque={indice === 0} />
            ))}

            {blocosRecentes.length === 0 && (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500">
                Nenhum bloco além do gênesis foi minerado ainda no nó ativo.
              </div>
            )}
          </div>
        </CartaoPainel>

        <CartaoPainel
          titulo="Último bloco adicionado"
          descricao={ultimoBloco ? `Bloco #${ultimoBloco.index} validado na cadeia do nó.` : "Nenhum bloco minerado ainda."}
          destaque={
            ultimoBloco && (
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                {new Date(ultimoBloco.timestamp).toLocaleString("pt-BR")}
              </span>
            )
          }
          className="flex h-full flex-col p-5"
        >
          {ultimoBloco ? (
            <div className="flex flex-1 flex-col justify-between">
              <div className="rounded-2xl bg-primary/5 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary/70">Hash do Bloco</p>
                <p className="mt-2 break-all font-mono text-sm font-semibold tracking-tight text-primary">
                  {ultimoBloco.block_hash}
                </p>
              </div>

              <div className="my-6 grid grid-cols-2 gap-y-6 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Minerador</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{ultimoBloco.miner_id || "Gênesis"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Eventos</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{ultimoBloco.event_count}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Dificuldade</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{ultimoBloco.difficulty}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Nonce</p>
                  <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900">{ultimoBloco.nonce}</p>
                </div>
              </div>

              <hr className="border-slate-100" />

              <div className="mt-6 space-y-5">
                <div className="border-l-2 border-slate-200 pl-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Hash Anterior</p>
                  <p className="mt-1 break-all font-mono text-[11px] font-medium tracking-tight text-slate-600">
                    {ultimoBloco.previous_hash}
                  </p>
                </div>
                <div className="border-l-2 border-slate-200 pl-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Hash dos Dados</p>
                  <p className="mt-1 break-all font-mono text-[11px] font-medium tracking-tight text-slate-600">
                    {ultimoBloco.data_hash}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm font-medium text-slate-500">
              Apenas o bloco gênesis compõe a cadeia atual deste nó. Modifique o nó ativo ou crie novos eventos.
            </div>
          )}
        </CartaoPainel>
      </section>

      <section>
        <CartaoPainel
          titulo="Atividades recentes"
          descricao="Timeline das últimas operações observadas entre os nós."
          className="p-5"
        >
          <div className="space-y-4">
            {atividadesRecentes.map((atividade, indice) => (
              <ItemTimelineAtividade
                key={`${atividade.timestamp}-${indice}`}
                atividade={atividade}
                ultimo={indice === atividadesRecentes.length - 1}
              />
            ))}

            {atividadesRecentes.length === 0 && (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5 text-sm text-slate-500">
                As atividades dos nós vão aparecer aqui assim que o backend estiver em uso.
              </div>
            )}
          </div>
        </CartaoPainel>
      </section>
    </div>
  )
}
