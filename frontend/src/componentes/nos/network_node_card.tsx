import { Link } from "react-router-dom"

import { BadgeStatus } from "../comum/badge_status"
import type { ConfiguracaoNo } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { nomeNoPorId, rotuloUltimoEventoNo } from "../../lib/util/rede_cluster"
import type { LinhaNoRede } from "../../lib/util/rede_cluster"
import { NetworkRoleBadge } from "./network_role_badge"

type Props = {
  linha: LinhaNoRede
  nos: ConfiguracaoNo[]
  aoSelecionarNo: (id: string) => void
  aoAtualizar: (no: ConfiguracaoNo) => void
  atualizando: boolean
}

const classeBotaoPrimario =
  "inline-flex items-center justify-center rounded-full bg-primary px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
const classeBotaoSecundario =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"

export function NetworkNodeCard({
  linha,
  nos,
  aoSelecionarNo,
  aoAtualizar,
  atualizando,
}: Props) {
  const ultimoBloco = linha.ultimoBloco
  const mineradorTopo = ultimoBloco ? nomeNoPorId(ultimoBloco.miner_id, nos) : "-"
  const ultimaAtividade = linha.ultimaAtividade
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

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
