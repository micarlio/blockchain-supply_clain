import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../app/contexto_nos"
import { CabecalhoPagina } from "../componentes/comum/cabecalho_pagina"
import { CarregandoPainel } from "../componentes/comum/carregando_painel"
import { CatalogoItens } from "../componentes/comum/catalogo_itens"
import { CartaoPainel } from "../componentes/comum/cartao_painel"
import { PreviewPayload } from "../componentes/comum/preview_payload"
import { SeletorInputs } from "../componentes/comum/seletor_inputs"
import { useCadeiaNo, useDemonstracoesNos, useMempoolNo, enviarEvento } from "../lib/api/servicos"
import type { EventoBlockchain, TipoEvento } from "../lib/api/tipos"
import { TIPOS_EVENTO, papelPorEvento, tipoEntidadePorEvento } from "../lib/dominio/dominio"
import {
  construirItensInsumo,
  filtrarInsumosPorDestino,
  possuiInsumoDerivadoSelecionado,
} from "../lib/util/insumos"

type FormularioBase = {
  event_id: string
  product_id: string
  product_name: string
  actor_id: string
  lot_id: string
  metadata_extra: string
  input_ids: string[]
  propagar_rede: boolean
}

const BASE: FormularioBase = {
  event_id: "",
  product_id: "",
  product_name: "",
  actor_id: "",
  lot_id: "",
  metadata_extra: "",
  input_ids: [],
  propagar_rede: true,
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

export function EventosPagina() {
  const { noAtivo, nos } = useNos()
  const clienteConsulta = useQueryClient()
  const [tipoEvento, setTipoEvento] = useState<TipoEvento>("CADASTRAR_MATERIA_PRIMA")
  const [formulario, setFormulario] = useState<FormularioBase>(BASE)
  const [erroFormulario, setErroFormulario] = useState<string | null>(null)

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

  const itensFiltrados = useMemo(
    () => filtrarInsumosPorDestino(itensInsumo, tipoEntidadePorEvento(tipoEvento)),
    [itensInsumo, tipoEvento],
  )

  const mutation = useMutation({
    mutationFn: (payload: EventoBlockchain) =>
      enviarEvento(noAtivo, payload, formulario.propagar_rede),
    onSuccess: async () => {
      await Promise.all([
        clienteConsulta.invalidateQueries({ queryKey: ["mempool-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no", noAtivo.id, noAtivo.url] }),
        clienteConsulta.invalidateQueries({ queryKey: ["estado-no", noAtivo.id, noAtivo.url] }),
      ])
      setFormulario((atual) => ({
        ...BASE,
        actor_id: atual.actor_id,
        propagar_rede: atual.propagar_rede,
      }))
    },
  })

  const mensagemErroMutacao = mutation.error instanceof Error ? mutation.error.message : null

  function atualizar<K extends keyof FormularioBase>(campo: K, valor: FormularioBase[K]) {
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
    if (
      tipoEvento !== "CADASTRAR_MATERIA_PRIMA" &&
      formulario.input_ids.length === 0
    ) {
      return "Selecione ao menos um input_id válido."
    }
    if (
      tipoEvento === "FABRICAR_PRODUTO_COMPOSTO" &&
      !possuiInsumoDerivadoSelecionado(itensFiltrados, formulario.input_ids)
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
    mutation.mutate(payloadPreview as EventoBlockchain)
  }

  if (cadeia.isLoading || mempool.isLoading) {
    return <CarregandoPainel mensagem="Preparando formulários e insumos disponíveis..." />
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="xl:col-span-2">
        <CabecalhoPagina
          titulo="Eventos do Domínio"
          descricao="Cadastre matéria-prima, produtos simples e produtos compostos usando a API real do nó selecionado."
        />
      </div>

      <div className="space-y-8">
        <CartaoPainel
          titulo="Cadastrar eventos reais"
          descricao="Use os formulários abaixo para interagir com o backend atual do projeto."
          className="p-8"
        >
          <div className="mb-8">
            <div className="grid w-full border-b border-slate-200/80 sm:grid-cols-3">
              {TIPOS_EVENTO.map((item) => (
                <button
                  key={item.valor}
                  type="button"
                  onClick={() => {
                    setTipoEvento(item.valor)
                    setErroFormulario(null)
                    setFormulario((atual) => ({ ...atual, input_ids: [] }))
                  }}
                  className={`inline-flex items-center justify-center whitespace-nowrap border-b-2 px-4 py-3 text-base font-medium tracking-tight transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                    tipoEvento === item.valor
                      ? "border-primary text-slate-900"
                      : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                  }`}
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
          </div>

          <form className="space-y-8" onSubmit={submeter}>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>
                  ID do evento
                </label>
                <input
                  value={formulario.event_id}
                  onChange={(event) => atualizar("event_id", event.target.value)}
                  className={CLASSE_CAMPO}
                  placeholder="EVT-0001"
                />
              </div>
              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>
                  ID do item
                </label>
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
                <label className={CLASSE_ROTULO_CAMPO}>
                  Nome do item
                </label>
                <input
                  value={formulario.product_name}
                  onChange={(event) => atualizar("product_name", event.target.value)}
                  className={CLASSE_CAMPO}
                  placeholder="Bicicleta urbana"
                />
              </div>
              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>
                  {tituloAtor(tipoEvento)}
                </label>
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
                <label className={CLASSE_ROTULO_CAMPO}>
                  Lot ID
                </label>
                <input
                  value={formulario.lot_id}
                  onChange={(event) => atualizar("lot_id", event.target.value)}
                  className={CLASSE_CAMPO}
                  placeholder="Opcional; cai em metadata.lot_id"
                />
              </div>
              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>Propagação</label>
                <label className={`${CLASSE_CAMPO} flex cursor-pointer items-center gap-3`}>
                  <input
                    type="checkbox"
                    checked={formulario.propagar_rede}
                    onChange={(event) => atualizar("propagar_rede", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  <span className="text-sm font-medium text-slate-700">Propagar o evento para a rede via Kafka</span>
                </label>
              </div>
            </div>

            {tipoEvento !== "CADASTRAR_MATERIA_PRIMA" && (
              <div className="space-y-2">
                <label className={CLASSE_ROTULO_CAMPO}>
                  Seleção guiada de input_ids
                </label>
                <SeletorInputs
                  itens={itensFiltrados}
                  selecionados={formulario.input_ids}
                  onChange={(inputIds) => atualizar("input_ids", inputIds)}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className={CLASSE_ROTULO_CAMPO}>
                Metadata extra
              </label>
              <textarea
                value={formulario.metadata_extra}
                onChange={(event) => atualizar("metadata_extra", event.target.value)}
                className={`${CLASSE_CAMPO} min-h-32 font-mono text-sm leading-6`}
                placeholder='{"origem":"Usina A","certificacao":"ISO 9001"}'
              />
            </div>

            {(erroFormulario || mensagemErroMutacao) && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {erroFormulario ?? mensagemErroMutacao}
              </div>
            )}

            {mutation.isSuccess && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Evento enviado com sucesso para {noAtivo.nome}.
              </div>
            )}

            <div className="flex flex-col gap-5 border-t border-slate-100 pt-6 md:flex-row md:items-end md:justify-between">
              <p className="max-w-2xl text-sm leading-7 text-slate-500">
                O formulário já fixa automaticamente `entity_kind` e `actor_role` conforme o tipo de evento selecionado.
              </p>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex min-w-[200px] items-center justify-center rounded-2xl bg-primary-gradient px-6 py-3.5 text-sm font-semibold text-on-primary transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutation.isPending ? "Enviando..." : "Registrar evento"}
              </button>
            </div>
          </form>
        </CartaoPainel>
      </div>

      <div className="space-y-8">
        <PreviewPayload payload={payloadPreview} />

        <CatalogoItens
          itens={itensInsumo}
          titulo="Itens conhecidos"
          descricao="Use este catálogo para localizar IDs, verificar status de consumo e entender o que está disponível antes de criar novos eventos."
        />
      </div>
    </div>
  )
}
