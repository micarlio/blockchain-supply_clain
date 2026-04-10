import { AlertTriangle, CheckCircle2, Plus, RotateCcw, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Link, useLocation } from "react-router-dom"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useNos } from "../../app/contexto_nos"
import { atualizarConfiguracaoRedeNo, limparMemoriaNo, useEstadosNos } from "../../lib/api/servicos"
import { cx } from "../../lib/util/classe"
import { SeletorNoAtivo } from "./seletor_no_ativo"
import { SeletorPowGlobal } from "./seletor_pow_global"

const SECOES: Record<string, string> = {
  "/": "Dashboard",
  "/eventos": "Eventos",
  "/mempool": "Mempool",
  "/mineracao": "Mineração",
  "/blockchain": "Blockchain",
  "/rastreabilidade": "Rastreabilidade",
  "/testes": "Testes",
  "/nos": "Nós da rede",
  "/logs": "Logs & Depuração",
}

type TipoFeedback = {
  tipo: "sucesso" | "erro"
  mensagem: string
}

function DialogoConfirmacaoLimpeza({
  aberto,
  carregando,
  aoCancelar,
  aoConfirmar,
}: {
  aberto: boolean
  carregando: boolean
  aoCancelar: () => void
  aoConfirmar: () => void
}) {
  useEffect(() => {
    if (!aberto) {
      return
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape" && !carregando) {
        aoCancelar()
      }
    }

    window.addEventListener("keydown", aoPressionarTecla)
    return () => window.removeEventListener("keydown", aoPressionarTecla)
  }, [aberto, aoCancelar, carregando])

  if (!aberto || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/22 p-4 backdrop-blur-[7px]"
      onClick={carregando ? undefined : aoCancelar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-limpeza-titulo"
        className="w-full max-w-xl overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.2)]"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/70 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Ação de runtime</p>
              <h3 id="confirmacao-limpeza-titulo" className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Limpar memória do cluster
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Isso vai limpar a memória runtime de todos os nós e voltar o cluster ao estado inicial desta execução.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={aoCancelar}
            disabled={carregando}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-sm leading-7 text-slate-600">
            O histórico em memória, mempool, forks e ajustes runtime locais serão reiniciados. Use essa ação quando quiser um ambiente limpo para nova demonstração ou depuração.
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={aoCancelar}
              disabled={carregando}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aoConfirmar}
              disabled={carregando}
              className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              {carregando ? "Limpando..." : "Confirmar limpeza"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function ToastFeedbackLimpeza({
  feedback,
  aoFechar,
}: {
  feedback: TipoFeedback | null
  aoFechar: () => void
}) {
  if (!feedback || typeof document === "undefined") {
    return null
  }

  const sucesso = feedback.tipo === "sucesso"

  return createPortal(
    <div className="fixed right-8 top-20 z-[95] w-full max-w-sm">
      <div
        className={cx(
          "overflow-hidden rounded-[1.4rem] border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]",
          sucesso ? "border-emerald-200/80" : "border-red-200/80",
        )}
      >
        <div className="flex items-start gap-3 px-4 py-4">
          <div
            className={cx(
              "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              sucesso ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
            )}
          >
            {sucesso ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              {sucesso ? "Operação concluída" : "Falha na operação"}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{feedback.mensagem}</p>
          </div>

          <button
            type="button"
            onClick={aoFechar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function BarraSuperior({ recolhida = false }: { recolhida?: boolean }) {
  const { pathname } = useLocation()
  const { nos, definirNoAtivo, noAtivo } = useNos()
  const clienteConsulta = useQueryClient()
  const [confirmacaoLimpezaAberta, setConfirmacaoLimpezaAberta] = useState(false)
  const [feedbackLimpeza, setFeedbackLimpeza] = useState<TipoFeedback | null>(null)
  const consultas = useEstadosNos(nos)
  const estados = consultas.map((item, indice) => ({
    no: nos[indice],
    dados: item.data,
  }))

  const secaoAtual = SECOES[pathname] ?? "Painel"
  const dificuldadeGlobalAtual =
    estados.find((item) => item.no.id === noAtivo.id)?.dados?.dificuldade_global ?? 4

  const dificuldadeGlobal = useMutation({
    mutationFn: async (dificuldade: number) => {
      await atualizarConfiguracaoRedeNo(noAtivo, { dificuldade_global: dificuldade })

      await Promise.all(
        nos.map((no) =>
          Promise.all([
            clienteConsulta.invalidateQueries({ queryKey: ["estado-no", no.id, no.url] }),
            clienteConsulta.invalidateQueries({ queryKey: ["rede-no", no.id, no.url] }),
            clienteConsulta.invalidateQueries({ queryKey: ["cadeia-no", no.id, no.url] }),
            clienteConsulta.invalidateQueries({ queryKey: ["demonstracao-no", no.id, no.url] }),
          ]),
        ),
      )

      return dificuldade
    },
  })

  const limpezaMemoria = useMutation({
    mutationFn: async () => {
      const resultados = await Promise.allSettled(nos.map((no) => limparMemoriaNo(no)))
      const falhas = resultados.filter((resultado) => resultado.status === "rejected")

      await clienteConsulta.invalidateQueries()

      if (falhas.length > 0) {
        throw new Error(`${falhas.length} nó(s) não aceitaram a limpeza de memória.`)
      }
    },
    onSuccess: () => {
      setConfirmacaoLimpezaAberta(false)
      setFeedbackLimpeza({
        tipo: "sucesso",
        mensagem: "Memória runtime do cluster limpa com sucesso.",
      })
    },
    onError: (erro) => {
      const mensagem = erro instanceof Error ? erro.message : "Falha ao limpar a memória do cluster."
      setConfirmacaoLimpezaAberta(false)
      setFeedbackLimpeza({ tipo: "erro", mensagem })
    },
  })

  useEffect(() => {
    if (!feedbackLimpeza) {
      return
    }

    const temporizador = window.setTimeout(() => setFeedbackLimpeza(null), 3600)
    return () => window.clearTimeout(temporizador)
  }, [feedbackLimpeza])

  const opcoesNos = nos.map((no) => ({
    id: no.id,
    nome: no.nome,
    url: no.url,
    online: Boolean(estados.find((item) => item.no.id === no.id)?.dados),
  }))

  const valorDificuldadeSelecionado =
    dificuldadeGlobal.isPending && typeof dificuldadeGlobal.variables === "number"
      ? dificuldadeGlobal.variables
      : dificuldadeGlobalAtual

  return (
    <header
      className={cx(
        "fixed right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/60 bg-white/80 px-8 backdrop-blur-md transition-[left] duration-300 ease-out",
        recolhida ? "left-24" : "left-72",
      )}
    >
      <div className="flex flex-col justify-center">
        <nav className="flex items-center text-[10px] font-medium uppercase tracking-[0.05em] text-slate-400">
          <span>Supply Chain</span>
          <span className="mx-2 opacity-40">/</span>
          <span className="text-slate-500">{secaoAtual}</span>
        </nav>
        <h1 className="mt-0.5 text-base font-bold tracking-tight text-slate-900">
          {secaoAtual}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <SeletorPowGlobal
            valor={valorDificuldadeSelecionado}
            pendente={dificuldadeGlobal.isPending}
            aoSelecionar={(valor) => dificuldadeGlobal.mutate(valor)}
          />

          {/* 1. Nó ativo (Principal) */}
          <SeletorNoAtivo
            itens={opcoesNos}
            ativoId={noAtivo.id}
            aoSelecionar={definirNoAtivo}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={limpezaMemoria.isPending}
            onClick={() => setConfirmacaoLimpezaAberta(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>{limpezaMemoria.isPending ? "Limpando..." : "Limpar memória"}</span>
          </button>

          <Link
            to="/eventos"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            <span>Criar evento</span>
          </Link>
        </div>
      </div>

      <DialogoConfirmacaoLimpeza
        aberto={confirmacaoLimpezaAberta}
        carregando={limpezaMemoria.isPending}
        aoCancelar={() => setConfirmacaoLimpezaAberta(false)}
        aoConfirmar={() => limpezaMemoria.mutate()}
      />
      <ToastFeedbackLimpeza
        feedback={feedbackLimpeza}
        aoFechar={() => setFeedbackLimpeza(null)}
      />
    </header>
  )
}
