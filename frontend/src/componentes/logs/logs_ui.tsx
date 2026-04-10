import {
  Activity,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Pause,
  Pickaxe,
  Play,
  Search,
  Server,
  ShieldAlert,
  Trash2,
  Wifi,
  Check,
  ChevronDown,
} from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"

import type { LogSistema } from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"
import { EstadoVazio } from "../comum/estado_vazio"
import { PreviewPayload } from "../comum/preview_payload"

type OpcaoFiltro = {
  value: string
  label: string
}

const META_CATEGORIAS: Record<
  string,
  {
    label: string
    icon: typeof Activity
    badgeClassName: string
  }
> = {
  api: {
    label: "API",
    icon: Activity,
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
  },
  mineracao: {
    label: "Mineração",
    icon: Pickaxe,
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  consenso: {
    label: "Consenso",
    icon: GitBranch,
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
  },
  validacao: {
    label: "Validação",
    icon: ShieldAlert,
    badgeClassName: "border-blue-200 bg-blue-50 text-blue-800",
  },
  rede_kafka: {
    label: "Rede / Kafka",
    icon: Wifi,
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-800",
  },
  testes: {
    label: "Testes",
    icon: FlaskConical,
    badgeClassName: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  },
  sistema: {
    label: "Sistema",
    icon: Server,
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
  },
}

const META_NIVEIS: Record<
  string,
  {
    badgeClassName: string
    rowClassName: string
  }
> = {
  INFO: {
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
    rowClassName: "hover:bg-slate-50/80",
  },
  DEBUG: {
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
    rowClassName: "bg-sky-50/30 hover:bg-sky-50/60",
  },
  WARN: {
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
    rowClassName: "bg-amber-50/30 hover:bg-amber-50/60",
  },
  ERROR: {
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    rowClassName: "bg-red-50/35 hover:bg-red-50/70",
  },
}

function formatarHoraLog(timestamp: string) {
  const data = new Date(timestamp)
  if (Number.isNaN(data.getTime())) {
    return timestamp
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(data)
}

function obterValorContexto(log: LogSistema, chave: string) {
  const valor = log.context?.[chave]
  return typeof valor === "string" && valor.trim().length > 0 ? valor : null
}

function obterHashRelacionada(log: LogSistema) {
  return (
    obterValorContexto(log, "block_hash")
    ?? obterValorContexto(log, "hash_relacionado")
    ?? obterValorContexto(log, "previous_hash")
  )
}

function obterIdentificadorRelacionada(log: LogSistema) {
  return (
    obterValorContexto(log, "product_id")
    ?? obterValorContexto(log, "event_id")
    ?? obterValorContexto(log, "event_id_relacionado")
  )
}

function BadgeNivelLog({ level }: { level: string }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
        META_NIVEIS[level]?.badgeClassName ?? META_NIVEIS.INFO.badgeClassName,
      )}
    >
      {level}
    </span>
  )
}

function BadgeCategoriaLog({ category }: { category: string }) {
  const meta = META_CATEGORIAS[category] ?? META_CATEGORIAS.api
  const Icone = meta.icon

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-tight",
        meta.badgeClassName,
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  )
}

function SelectFiltroLogs({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: OpcaoFiltro[]
  onChange: (value: string) => void
}) {
  const [aberto, setAberto] = useState(false)
  const referencia = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function aoPressionarFora(evento: PointerEvent) {
      const alvo = evento.target
      if (!(alvo instanceof Node)) {
        return
      }

      if (!referencia.current?.contains(alvo)) {
        setAberto(false)
      }
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false)
      }
    }

    window.addEventListener("pointerdown", aoPressionarFora)
    window.addEventListener("keydown", aoPressionarTecla)

    return () => {
      window.removeEventListener("pointerdown", aoPressionarFora)
      window.removeEventListener("keydown", aoPressionarTecla)
    }
  }, [])

  const opcaoSelecionada = options.find((opcao) => opcao.value === value) ?? options[0]

  return (
    <label className="space-y-1.5 text-sm text-slate-600">
      <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>

      <div className="relative" ref={referencia}>
        <button
          type="button"
          aria-expanded={aberto}
          aria-haspopup="listbox"
          onClick={() => setAberto((estadoAtual) => !estadoAtual)}
          className={cx(
            "group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)] outline-none transition-all focus-visible:border-primary/30 focus-visible:ring-4 focus-visible:ring-primary/5",
            aberto ? "border-primary/25 bg-primary/5" : "hover:border-slate-300 hover:bg-white",
          )}
        >
          <span className="truncate">{opcaoSelecionada?.label ?? value}</span>
          <ChevronDown
            className={cx(
              "h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200",
              aberto ? "rotate-180 text-primary" : "group-hover:text-primary",
            )}
          />
        </button>

        {aberto ? (
          <div className="absolute left-0 top-full z-30 mt-2 min-w-full rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-xl backdrop-blur-sm">
            <div className="px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            </div>

            <div className="max-h-72 space-y-0.5 overflow-y-auto" role="listbox" aria-label={label}>
              {options.map((opcao) => {
                const selecionado = opcao.value === value

                return (
                  <button
                    key={opcao.value}
                    type="button"
                    role="option"
                    aria-selected={selecionado}
                    onClick={() => {
                      onChange(opcao.value)
                      setAberto(false)
                    }}
                    className={cx(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      selecionado
                        ? "bg-primary text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <span className="font-semibold">{opcao.label}</span>
                    {selecionado ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  )
}

function CartaoKpi({
  titulo,
  valor,
  descricao,
  destaque,
}: {
  titulo: string
  valor: string
  descricao: string
  destaque?: boolean
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]",
        destaque ? "border-primary/20 bg-primary/5" : "",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{titulo}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{valor}</p>
      <p className="mt-2 text-sm text-slate-500">{descricao}</p>
    </div>
  )
}

function CampoDetalhe({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <div className="mt-2 text-sm font-medium text-slate-800">{value}</div>
    </div>
  )
}

export function LogsFilterBar({
  opcoesNos,
  noSelecionado,
  aoSelecionarNo,
  opcoesCategoria,
  categoriaSelecionada,
  aoSelecionarCategoria,
  opcoesEndpoint,
  endpointSelecionado,
  aoSelecionarEndpoint,
  opcoesNivel,
  nivelSelecionado,
  aoSelecionarNivel,
  buscaTexto,
  aoAlterarBuscaTexto,
  acompanharTempoReal,
  aoAlternarTempoReal,
  streamPausado,
  aoAlternarStreamPausado,
  aoLimparVisualizacao,
  aoRestaurarHistorico,
  aoExportarLogs,
  aoCopiarFiltro,
  visualizacaoLimpa,
  feedbackAcao,
}: {
  opcoesNos: OpcaoFiltro[]
  noSelecionado: string
  aoSelecionarNo: (value: string) => void
  opcoesCategoria: OpcaoFiltro[]
  categoriaSelecionada: string
  aoSelecionarCategoria: (value: string) => void
  opcoesEndpoint: OpcaoFiltro[]
  endpointSelecionado: string
  aoSelecionarEndpoint: (value: string) => void
  opcoesNivel: OpcaoFiltro[]
  nivelSelecionado: string
  aoSelecionarNivel: (value: string) => void
  buscaTexto: string
  aoAlterarBuscaTexto: (value: string) => void
  acompanharTempoReal: boolean
  aoAlternarTempoReal: () => void
  streamPausado: boolean
  aoAlternarStreamPausado: () => void
  aoLimparVisualizacao: () => void
  aoRestaurarHistorico: () => void
  aoExportarLogs: () => void
  aoCopiarFiltro: () => void
  visualizacaoLimpa: string | null
  feedbackAcao: string | null
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="grid gap-3 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(260px,1.15fr)]">
        <SelectFiltroLogs
          label="Nó"
          value={noSelecionado}
          options={opcoesNos}
          onChange={aoSelecionarNo}
        />
        <SelectFiltroLogs
          label="Categoria"
          value={categoriaSelecionada}
          options={opcoesCategoria}
          onChange={aoSelecionarCategoria}
        />
        <SelectFiltroLogs
          label="Endpoint"
          value={endpointSelecionado}
          options={opcoesEndpoint}
          onChange={aoSelecionarEndpoint}
        />
        <SelectFiltroLogs
          label="Nível"
          value={nivelSelecionado}
          options={opcoesNivel}
          onChange={aoSelecionarNivel}
        />

        <label className="space-y-1.5 text-sm text-slate-600">
          <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Busca textual
          </span>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/95 px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition-all focus-within:border-primary/30 focus-within:ring-4 focus-within:ring-primary/5">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={buscaTexto}
              onChange={(evento) => aoAlterarBuscaTexto(evento.target.value)}
              placeholder="hash, event_id, endpoint, mensagem..."
              className="w-full border-none bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={aoAlternarTempoReal}
            className={cx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors",
              acompanharTempoReal
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-slate-50 text-slate-600",
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            {acompanharTempoReal ? "Acompanhando em tempo real" : "Snapshot manual"}
          </button>

          <button
            type="button"
            onClick={aoAlternarStreamPausado}
            disabled={!acompanharTempoReal}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {streamPausado ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {streamPausado ? "Retomar stream" : "Pausar stream"}
          </button>

          {visualizacaoLimpa ? (
            <button
              type="button"
              onClick={aoRestaurarHistorico}
              className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10"
            >
              Histórico limpo às {formatarHoraLog(visualizacaoLimpa)}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={aoLimparVisualizacao}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar visualização
          </button>
          <button
            type="button"
            onClick={aoExportarLogs}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar logs
          </button>
          <button
            type="button"
            onClick={aoCopiarFiltro}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar filtro atual
          </button>
        </div>
      </div>

      {feedbackAcao ? <p className="mt-3 text-sm text-slate-500">{feedbackAcao}</p> : null}
    </section>
  )
}

export function LogsKpis({
  totalLogs,
  errosRecentes,
  eventosMineracao,
  forksDetectados,
  reorgsDetectadas,
}: {
  totalLogs: number
  errosRecentes: number
  eventosMineracao: number
  forksDetectados: number
  reorgsDetectadas: number
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <CartaoKpi
        titulo="Logs visíveis"
        valor={String(totalLogs)}
        descricao="Total após aplicação dos filtros atuais."
        destaque
      />
      <CartaoKpi
        titulo="Erros recentes"
        valor={String(errosRecentes)}
        descricao="Entradas com nível ERROR no recorte atual."
      />
      <CartaoKpi
        titulo="Mineração"
        valor={String(eventosMineracao)}
        descricao="Eventos ligados à produção de blocos."
      />
      <CartaoKpi
        titulo="Forks detectados"
        valor={String(forksDetectados)}
        descricao="Registros de forks no conjunto visível."
      />
      <CartaoKpi
        titulo="Reorgs"
        valor={String(reorgsDetectadas)}
        descricao="Mudanças de cadeia ativa observadas."
      />
    </div>
  )
}

export function LogsTable({
  logs,
  logSelecionadoId,
  aoSelecionar,
  updatedAt,
}: {
  logs: LogSistema[]
  logSelecionadoId: string | null
  aoSelecionar: (log: LogSistema) => void
  updatedAt: string | null
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-900">Stream de logs</p>
          <p className="mt-1 text-sm text-slate-500">
            Visão estruturada por timestamp, nível, nó, categoria, endpoint e mensagem.
          </p>
        </div>

        <div className="text-right text-xs text-slate-500">
          <p className="font-bold uppercase tracking-[0.14em] text-slate-400">Atualização</p>
          <p className="mt-1">{updatedAt ? formatarData(updatedAt) : "aguardando"}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="grid grid-cols-[120px_92px_120px_150px_210px_minmax(280px,1fr)] gap-3 border-b border-slate-200/70 bg-slate-50/70 px-5 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
            <span>Timestamp</span>
            <span>Nível</span>
            <span>Nó</span>
            <span>Categoria</span>
            <span>Endpoint</span>
            <span>Mensagem resumida</span>
          </div>

          <div className="divide-y divide-slate-200/70">
            {logs.map((log) => {
              const selecionado = log.id === logSelecionadoId

              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => aoSelecionar(log)}
                  className={cx(
                    "grid w-full grid-cols-[120px_92px_120px_150px_210px_minmax(280px,1fr)] gap-3 px-5 py-4 text-left transition-colors",
                    META_NIVEIS[log.level]?.rowClassName ?? META_NIVEIS.INFO.rowClassName,
                    selecionado ? "bg-primary/5" : "",
                  )}
                >
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-slate-900">
                      {formatarHoraLog(log.timestamp)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatarData(log.timestamp)}</p>
                  </div>

                  <div className="pt-0.5">
                    <BadgeNivelLog level={log.level} />
                  </div>

                  <div>
                    <p className="text-sm font-semibold tracking-tight text-slate-900">{log.node_id}</p>
                    {log.request_id ? <p className="mt-1 text-xs text-slate-500">{log.request_id}</p> : null}
                  </div>

                  <div className="pt-0.5">
                    <BadgeCategoriaLog category={log.category} />
                  </div>

                  <div>
                    <p className="font-mono text-[13px] font-semibold text-slate-700">
                      {log.endpoint ?? "-"}
                    </p>
                    {log.method || log.status_code ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {[log.method, log.status_code].filter(Boolean).join(" • ")}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-sm font-semibold tracking-tight text-slate-900">{log.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[
                        log.event_type,
                        obterValorContexto(log, "product_id"),
                        obterHashRelacionada(log) ? encurtarHash(obterHashRelacionada(log), 18) : null,
                      ]
                        .filter(Boolean)
                        .join(" • ") || "sem contexto resumido adicional"}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export function LogDetailsPanel({
  log,
  aoPrepararNavegacao,
  obterNomeNo,
}: {
  log: LogSistema | null
  aoPrepararNavegacao?: (nodeId: string) => void
  obterNomeNo?: (nodeId: string) => string
}) {
  if (!log) {
    return (
        <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] xl:sticky xl:top-20">
        <EstadoVazio
          titulo="Selecione um log"
          descricao="Clique em uma linha do stream para abrir o detalhe completo, incluindo payloads, contexto e atalhos para investigação."
        />
      </section>
    )
  }

  const hashRelacionada = obterHashRelacionada(log)
  const identificadorRelacionada = obterIdentificadorRelacionada(log)
  const scenarioId = obterValorContexto(log, "scenario_id")
  const camposContexto = Object.entries(log.context ?? {}).filter(([, valor]) => valor !== null && valor !== undefined && valor !== "")
  const nomeNoDestino = obterNomeNo?.(log.node_id) ?? log.node_id

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] xl:sticky xl:top-20 overflow-y-auto max-h-[calc(100vh-6rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-slate-900">Detalhe do log</p>
          <p className="mt-1 text-sm text-slate-500">Inspecione mensagem, contexto e payloads associados.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BadgeNivelLog level={log.level} />
          <BadgeCategoriaLog category={log.category} />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Mensagem completa</p>
        <p className="mt-2 text-sm leading-7 text-slate-700">{log.message}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <CampoDetalhe label="Timestamp" value={<span>{formatarData(log.timestamp)} ({formatarHoraLog(log.timestamp)})</span>} />
        <CampoDetalhe label="Nó" value={log.node_id} />
        <CampoDetalhe label="Endpoint" value={log.endpoint ?? "-"} />
        <CampoDetalhe label="Método / status" value={[log.method, log.status_code].filter(Boolean).join(" • ") || "-"} />
        <CampoDetalhe label="Tipo do log" value={log.event_type ?? "-"} />
        <CampoDetalhe label="Request ID" value={log.request_id ?? "-"} />
      </div>

      {log.duration_ms ? (
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <ExternalLink className="h-3.5 w-3.5" />
          {log.duration_ms} ms
        </div>
      ) : null}

      {(hashRelacionada || identificadorRelacionada || scenarioId) ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Atalhos relacionados</p>
              <p className="mt-2 text-sm text-slate-500">
                Os atalhos abaixo abrirão o contexto em <span className="font-semibold text-slate-700">{nomeNoDestino}</span>.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              <Server className="h-3.5 w-3.5" />
              Contexto em {nomeNoDestino}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {hashRelacionada ? (
              <Link
                to={`/blockchain?q=${encodeURIComponent(hashRelacionada)}`}
                onClick={() => aoPrepararNavegacao?.(log.node_id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <GitBranch className="h-3.5 w-3.5" />
                Abrir blockchain
              </Link>
            ) : null}

            {identificadorRelacionada ? (
              <Link
                to={`/rastreabilidade?identificador=${encodeURIComponent(identificadorRelacionada)}`}
                onClick={() => aoPrepararNavegacao?.(log.node_id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <Search className="h-3.5 w-3.5" />
                Abrir rastreabilidade
              </Link>
            ) : null}

            {scenarioId ? (
              <Link
                to="/testes"
                onClick={() => aoPrepararNavegacao?.(log.node_id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Abrir testes
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {camposContexto.length ? (
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Contexto relacionado</p>
          <div className="mt-3 grid gap-2">
            {camposContexto.map(([chave, valor]) => (
              <div key={chave} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{chave.replaceAll("_", " ")}</span>
                <span className="text-right text-sm font-medium text-slate-700">
                  {typeof valor === "string" ? valor : JSON.stringify(valor)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {log.request_payload !== undefined && log.request_payload !== null ? (
        <PreviewPayload titulo="Request payload" payload={log.request_payload} />
      ) : null}

      {log.response_payload !== undefined && log.response_payload !== null ? (
        <PreviewPayload titulo="Response payload" payload={log.response_payload} />
      ) : null}
    </section>
  )
}

export function LogsEmptyState({
  titulo,
  descricao,
  acao,
}: {
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return <EstadoVazio titulo={titulo} descricao={descricao} acao={acao} />
}
