import { useRef, useState } from "react"
import { Link } from "react-router-dom"

import { BadgeStatus } from "../comum/badge_status"
import type { ConfiguracaoNo, PapelNo, PayloadConfiguracaoNo } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import {
  detalharCapacidadeMineracao,
  nomeNoPorId,
  rotuloPerfilNo,
  rotuloUltimoEventoNo,
  resumirCapacidadeMineracao,
} from "../../lib/util/rede_cluster"
import type { LinhaNoRede } from "../../lib/util/rede_cluster"
import { NetworkRoleBadge } from "./network_role_badge"
import { SeletorPapelNo } from "./seletor_papel_no"

type Props = {
  linha: LinhaNoRede
  nos: ConfiguracaoNo[]
  aoSelecionarNo: (id: string) => void
  aoAtualizar: (no: ConfiguracaoNo) => void
  atualizando: boolean
  aoSalvarConfiguracao: (no: ConfiguracaoNo, payload: PayloadConfiguracaoNo) => void
  salvandoConfiguracao: boolean
  feedbackConfiguracao?: {
    tipo: "sucesso" | "erro"
    mensagem: string
  }
}

const PERFIS_PADRAO_POR_NO: Partial<
  Record<ConfiguracaoNo["id"], { papel: PapelNo; perfil: string; intervalo: number; tentativas: number }>
> = {
  "node-alpha": {
    papel: "minerador",
    perfil: "padrao",
    intervalo: 2,
    tentativas: 10000,
  },
  "node-beta": {
    papel: "controle",
    perfil: "manual",
    intervalo: 2,
    tentativas: 10000,
  },
  "node-gamma": {
    papel: "observador",
    perfil: "desabilitada",
    intervalo: 2,
    tentativas: 0,
  },
  "node-evil": {
    papel: "minerador",
    perfil: "vantagem_simulada",
    intervalo: 0.5,
    tentativas: 40000,
  },
}

function resolverPerfilMineracaoDestino(
  linha: LinhaNoRede,
  papelSelecionado: PapelNo,
  intervalo: number,
  tentativas: number,
) {
  if (papelSelecionado === "observador") {
    return "desabilitada"
  }

  const perfilAtual = linha.capacidadeMineracao?.perfil ?? "padrao"
  const intervaloAtual = linha.capacidadeMineracao?.intervalo_ciclo_segundos ?? 2
  const tentativasAtuais = linha.capacidadeMineracao?.tentativas_nonce_por_ciclo ?? 0
  if (
    papelSelecionado === linha.papel
    && intervalo === intervaloAtual
    && tentativas === tentativasAtuais
  ) {
    return perfilAtual
  }

  const perfilPadrao = PERFIS_PADRAO_POR_NO[linha.no.id]
  if (
    perfilPadrao
    && perfilPadrao.papel === papelSelecionado
    && perfilPadrao.intervalo === intervalo
    && perfilPadrao.tentativas === tentativas
  ) {
    return perfilPadrao.perfil
  }

  return "customizado"
}

const classeBotaoPrimario =
  "inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
const classeBotaoSecundario =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
const classeCampoConfiguracao =
  "w-full rounded-xl border border-slate-200/70 bg-white/95 px-3 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)] outline-none transition-all focus:border-primary/30 focus:ring-4 focus:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-70"

export function NetworkNodeCard({
  linha,
  nos,
  aoSelecionarNo,
  aoAtualizar,
  atualizando,
  aoSalvarConfiguracao,
  salvandoConfiguracao,
  feedbackConfiguracao,
}: Props) {
  const ultimoBloco = linha.ultimoBloco
  const mineradorTopo = ultimoBloco ? nomeNoPorId(ultimoBloco.miner_id, nos) : "-"
  const ultimaAtividade = linha.ultimaAtividade
  const formularioConfiguracao = useRef<HTMLFormElement | null>(null)
  const [erroValidacaoConfiguracao, setErroValidacaoConfiguracao] = useState<string | null>(null)
  const configuracaoRuntimeKey = [
    linha.papel,
    linha.capacidadeMineracao?.perfil ?? "padrao",
    linha.capacidadeMineracao?.intervalo_ciclo_segundos ?? 2,
    linha.capacidadeMineracao?.tentativas_nonce_por_ciclo ?? 0,
  ].join(":" )
  const feedbackAtual = erroValidacaoConfiguracao
    ? { tipo: "erro" as const, mensagem: erroValidacaoConfiguracao }
    : feedbackConfiguracao
  const statusNo = linha.online ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      em resposta
    </span>
  ) : (
    <BadgeStatus status="offline" />
  )

  return (
    <div
      className={cx(
        "rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]",
        linha.ativo && "border-primary/25 ring-4 ring-primary/10",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight text-slate-900">{linha.no.nome}</h3>
            {linha.ativo ? <BadgeStatus status="ativo" /> : null}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{linha.no.url}</p>
        </div>

        {statusNo}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <NetworkRoleBadge papel={linha.papel} compacto />
        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            linha.perfilNo === "malicioso"
              ? "bg-red-50 text-red-700"
              : "bg-slate-100 text-slate-600",
          )}
        >
          perfil: {rotuloPerfilNo(linha.perfilNo)}
        </span>
        <span
          className={cx(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            linha.mineracaoAutomaticaAtiva
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600",
          )}
        >
          auto mineração: {linha.mineracaoAutomaticaAtiva ? "ativa" : "desligada"}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {rotuloUltimoEventoNo(linha.ultimoEvento)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm xl:grid-cols-4">
        <div className="rounded-2xl bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Altura</p>
          <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">{linha.altura ?? "-"}</p>
        </div>

        <div className="rounded-2xl bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Mempool</p>
          <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">{linha.mempool ?? "-"}</p>
        </div>

        <div className="rounded-2xl bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Último bloco</p>
          <p className="mt-1 text-base font-semibold tracking-tight text-slate-900">
            {ultimoBloco ? `#${ultimoBloco.index}` : "-"}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50/80 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Último contato</p>
          <p className="mt-1 text-sm font-semibold tracking-tight text-slate-900">{formatarData(linha.ultimoContato)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Hash da ponta</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="rounded-full bg-slate-50 px-2.5 py-1">forks: {linha.forks ?? 0}</span>
            <span className="rounded-full bg-slate-50 px-2.5 py-1">minerador topo: {mineradorTopo}</span>
          </div>
        </div>
        <p className="mt-2 break-all font-mono text-[11px] font-medium text-slate-600">{linha.hashPonta ?? "-"}</p>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">PoW global</p>
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            dificuldade {linha.dificuldadeGlobal ?? "-"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            mesma regra de validação usada por todos os nós do cluster
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Hash power simulado</p>
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            {resumirCapacidadeMineracao(linha.capacidadeMineracao)}
          </p>
          <p className="mt-1 text-sm text-slate-600">{detalharCapacidadeMineracao(linha.capacidadeMineracao)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <div className="rounded-2xl bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Último bloco conhecido</p>
            <span className="text-xs text-slate-400">{formatarData(ultimoBloco?.timestamp)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            {ultimoBloco ? `Bloco #${ultimoBloco.index}` : "Sem bloco observado"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {ultimoBloco
              ? `Minerado por ${mineradorTopo} • ${encurtarHash(ultimoBloco.block_hash, 20)}`
              : "A cadeia local ainda não expôs um bloco recente além do gênesis."}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50/80 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Atividade mais recente</p>
            <span className="text-xs text-slate-400">{formatarData(ultimaAtividade?.timestamp)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold tracking-tight text-slate-900">
            {ultimaAtividade?.titulo ?? "Sem atividade registrada"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {ultimaAtividade?.descricao ?? "O backend ainda não expôs eventos recentes para este nó."}
          </p>
        </div>
      </div>

      <form
        key={configuracaoRuntimeKey}
        ref={formularioConfiguracao}
        className="mt-3 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (!formularioConfiguracao.current) {
            return
          }

          const dados = new FormData(formularioConfiguracao.current)
          const papelSelecionado = String(dados.get("papel_no") ?? "controle") as PapelNo
          const tentativasBrutas = String(dados.get("tentativas_nonce_por_ciclo") ?? "").trim()
          const intervaloBruto = String(dados.get("intervalo_ciclo_segundos") ?? "").trim()

          if (!tentativasBrutas || !intervaloBruto) {
            setErroValidacaoConfiguracao("Preencha intervalo e nonces por ciclo antes de aplicar a configuração.")
            return
          }

          const tentativas = Number(tentativasBrutas)
          const intervalo = Number(intervaloBruto)
          if (!Number.isFinite(intervalo) || intervalo < 0.1) {
            setErroValidacaoConfiguracao("Intervalo do ciclo deve ser um número maior ou igual a 0,1 segundo.")
            return
          }

          if (!Number.isFinite(tentativas) || !Number.isInteger(tentativas) || tentativas < 0) {
            setErroValidacaoConfiguracao("Nonces por ciclo deve ser um inteiro maior ou igual a zero.")
            return
          }

          const tentativasEfetivas = papelSelecionado === "observador" ? 0 : tentativas
          setErroValidacaoConfiguracao(null)
          aoSalvarConfiguracao(linha.no, {
            papel_no: papelSelecionado,
            tentativas_nonce_por_ciclo: tentativasEfetivas,
            intervalo_ciclo_segundos: intervalo,
            perfil_mineracao: resolverPerfilMineracaoDestino(
              linha,
              papelSelecionado,
              intervalo,
              tentativasEfetivas,
            ),
          })
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Ajuste em memória</p>
            <p className="mt-1 text-sm text-slate-600">
              Papel do nó e hash power simulado podem ser alterados sem reiniciar o projeto.
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            runtime only
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="space-y-1.5 text-sm text-slate-600">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Papel</span>
            <SeletorPapelNo
              name="papel_no"
              valorInicial={(linha.papel as PapelNo) ?? "controle"}
              disabled={salvandoConfiguracao}
              onChange={() => setErroValidacaoConfiguracao(null)}
            />
          </label>

          <label className="space-y-1.5 text-sm text-slate-600">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Nonces por ciclo</span>
            <input
              name="tentativas_nonce_por_ciclo"
              type="number"
              min={0}
              step={1000}
              defaultValue={linha.capacidadeMineracao?.tentativas_nonce_por_ciclo ?? 0}
              disabled={salvandoConfiguracao}
              onInput={() => setErroValidacaoConfiguracao(null)}
              className={classeCampoConfiguracao}
            />
          </label>

          <label className="space-y-1.5 text-sm text-slate-600">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Intervalo do ciclo (s)</span>
            <input
              name="intervalo_ciclo_segundos"
              type="number"
              min={0.1}
              step={0.1}
              defaultValue={linha.capacidadeMineracao?.intervalo_ciclo_segundos ?? 2}
              disabled={salvandoConfiguracao}
              onInput={() => setErroValidacaoConfiguracao(null)}
              className={classeCampoConfiguracao}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Hash power simulado = tentativas de nonce por ciclo + frequência do ciclo automático.
          </p>
          <button
            type="submit"
            disabled={salvandoConfiguracao || !linha.online}
            className={classeBotaoPrimario}
          >
            {salvandoConfiguracao ? "salvando" : "aplicar ajuste"}
          </button>
        </div>

        {feedbackAtual ? (
          <div
            className={cx(
              "mt-3 rounded-2xl border px-3 py-2 text-sm",
              feedbackAtual.tipo === "sucesso"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            )}
          >
            {feedbackAtual.mensagem}
          </div>
        ) : null}
      </form>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <button
          type="button"
          onClick={() => aoSelecionarNo(linha.no.id)}
          disabled={linha.ativo}
          className={classeBotaoPrimario}
        >
          {linha.ativo ? "nó ativo" : "selecionar nó"}
        </button>

        <button
          type="button"
          onClick={() => aoAtualizar(linha.no)}
          disabled={atualizando}
          className={classeBotaoSecundario}
        >
          {atualizando ? "atualizando" : "atualizar"}
        </button>

        <Link to="/blockchain" onClick={() => aoSelecionarNo(linha.no.id)} className={classeBotaoSecundario}>
          abrir cadeia
        </Link>
      </div>
    </div>
  )
}
