import { Check, ChevronDown } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { PreviewPayload } from "../comum/preview_payload"
import type {
  CampoEntradaTeste,
  ConfiguracaoNo,
  DefinicaoCenarioTeste,
  ResultadoExecucaoTeste,
} from "../../lib/api/tipos"
import { cx } from "../../lib/util/classe"

const classesSeveridade: Record<string, string> = {
  critica: "border-red-200 bg-red-50 text-red-700",
  alta: "border-amber-200 bg-amber-50 text-amber-800",
  media: "border-blue-200 bg-blue-50 text-blue-800",
  baixa: "border-slate-200 bg-slate-50 text-slate-700",
}

function rotuloSeveridade(severidade: string) {
  return severidade.replaceAll("_", " ")
}

function rotuloStatusExecucao(resultado?: ResultadoExecucaoTeste | null) {
  if (!resultado) {
    return "sem execução"
  }

  if (resultado.status_execucao === "concluido") {
    return resultado.teste_aprovado ? "aprovado" : "concluído sem sucesso"
  }

  return resultado.status_execucao.replaceAll("_", " ")
}

function classesResultado(resultado?: ResultadoExecucaoTeste | null) {
  if (!resultado) {
    return "border-slate-200 bg-slate-50 text-slate-700"
  }

  if (resultado.teste_aprovado) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }

  if (resultado.status_execucao === "erro_tecnico") {
    return "border-red-200 bg-red-50 text-red-700"
  }

  return "border-amber-200 bg-amber-50 text-amber-800"
}

function SeletorDropdownTeste({
  value,
  options,
  onChange,
  rotuloPainel,
  disabled = false,
}: {
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  rotuloPainel: string
  disabled?: boolean
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
    <div className="relative" ref={referencia}>
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((estadoAtual) => !estadoAtual)}
        disabled={disabled}
        className={cx(
          "group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/95 px-3 py-2.5 text-left text-sm font-semibold text-slate-900 shadow-[0_4px_12px_rgba(15,23,42,0.04)] outline-none transition-all focus-visible:border-primary/30 focus-visible:ring-4 focus-visible:ring-primary/5 disabled:cursor-not-allowed disabled:opacity-70",
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

      {aberto && !disabled ? (
        <div className="absolute left-0 top-full z-30 mt-2 min-w-full rounded-xl border border-slate-200/60 bg-white/95 p-1 shadow-xl backdrop-blur-sm">
          <div className="px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {rotuloPainel}
            </p>
          </div>

          <div className="space-y-0.5" role="listbox" aria-label={rotuloPainel}>
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
  )
}

function InputCampoTeste({
  campo,
  valor,
  aoAlterar,
}: {
  campo: CampoEntradaTeste
  valor: string
  aoAlterar: (campoId: string, valor: string) => void
}) {
  if (campo.field_type === "select") {
    return (
      <label className="space-y-1.5 text-sm text-slate-600">
        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
          {campo.label}
        </span>
        <SeletorDropdownTeste
          value={valor}
          onChange={(proximoValor) => aoAlterar(campo.id, proximoValor)}
          rotuloPainel={campo.label}
          options={campo.options.map((opcao) => ({
            value: opcao.value,
            label: opcao.label,
          }))}
        />
        {campo.help_text ? <p className="text-xs text-slate-500">{campo.help_text}</p> : null}
      </label>
    )
  }

  return (
    <label className="space-y-1.5 text-sm text-slate-600">
      <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
        {campo.label}
      </span>
      <input
        type={campo.field_type === "number" ? "number" : "text"}
        value={valor}
        placeholder={campo.placeholder ?? undefined}
        onChange={(evento) => aoAlterar(campo.id, evento.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-primary/50"
      />
      {campo.help_text ? <p className="text-xs text-slate-500">{campo.help_text}</p> : null}
    </label>
  )
}

export function ListaCenariosTeste({
  cenarios,
  scenarioIdSelecionado,
  aoSelecionar,
}: {
  cenarios: DefinicaoCenarioTeste[]
  scenarioIdSelecionado: string | null
  aoSelecionar: (scenarioId: string) => void
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-base font-semibold tracking-tight text-slate-900">Cenários disponíveis</p>
      <p className="mt-1 text-sm text-slate-500">
        A lista vem do backend; a UI só renderiza os metadados oficiais de cada cenário.
      </p>

      <div className="mt-4 space-y-3">
        {cenarios.map((cenario) => {
          const selecionado = cenario.id === scenarioIdSelecionado

          return (
            <button
              key={cenario.id}
              type="button"
              onClick={() => aoSelecionar(cenario.id)}
              className={cx(
                "w-full rounded-2xl border p-4 text-left transition-all",
                selecionado
                  ? "border-primary/40 bg-primary/5 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                  : "border-slate-200/80 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold tracking-tight text-slate-900">{cenario.nome}</p>
                <span
                  className={cx(
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                    classesSeveridade[cenario.severidade] ?? classesSeveridade.media,
                  )}
                >
                  {rotuloSeveridade(cenario.severidade)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{cenario.descricao}</p>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function PainelCenarioTeste({
  cenario,
  nos,
  noSelecionadoId,
  aoSelecionarNo,
  valoresCampos,
  aoAlterarCampo,
  executando,
  aoExecutar,
  resultado,
}: {
  cenario: DefinicaoCenarioTeste | null
  nos: ConfiguracaoNo[]
  noSelecionadoId: string
  aoSelecionarNo: (nodeId: string) => void
  valoresCampos: Record<string, string>
  aoAlterarCampo: (campoId: string, valor: string) => void
  executando: boolean
  aoExecutar: () => void
  resultado: ResultadoExecucaoTeste | null
}) {
  if (!cenario) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-sm text-slate-500">
        Nenhum cenário disponível no backend selecionado.
      </section>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold tracking-tight text-slate-900">{cenario.nome}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                {cenario.categoria}
              </span>
              <span
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
                  classesSeveridade[cenario.severidade] ?? classesSeveridade.media,
                )}
              >
                {rotuloSeveridade(cenario.severidade)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{cenario.descricao}</p>
          </div>

          <button
            type="button"
            onClick={aoExecutar}
            disabled={executando}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {executando ? "executando" : "executar cenário"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Objetivo</p>
            <p className="mt-2 text-sm text-slate-700">{cenario.objetivo}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Comportamento esperado</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {cenario.comportamento_esperado.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Pré-condições</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {cenario.precondicoes.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Impactos da execução</p>
            <div className="mt-2 space-y-2 text-sm text-slate-700">
              {cenario.impactos_execucao.length ? (
                cenario.impactos_execucao.map((item) => <p key={item}>{item}</p>)
              ) : (
                <p>Este cenário não declara impactos adicionais na execução.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Execução</p>
            <div className="mt-2 space-y-3 text-sm text-slate-700">
              {cenario.requires_node_selection ? (
                <label className="space-y-1.5 text-sm text-slate-600">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {cenario.node_selection_label ?? "Nó alvo"}
                  </span>
                  <SeletorDropdownTeste
                    value={noSelecionadoId}
                    onChange={aoSelecionarNo}
                    rotuloPainel={cenario.node_selection_label ?? "Nó alvo"}
                    options={nos.map((no) => ({
                      value: no.id,
                      label: no.nome,
                    }))}
                  />
                  <p className="text-xs text-slate-500">
                    {cenario.node_selection_help
                      ?? "Escolha o nó principal que será usado na execução deste cenário."}
                  </p>
                </label>
              ) : (
                <p>Este cenário não exige seleção manual de nó.</p>
              )}

              {cenario.input_fields.length ? (
                <div className="grid gap-3">
                  {cenario.input_fields.map((campo) => (
                    <InputCampoTeste
                      key={campo.id}
                      campo={campo}
                      valor={valoresCampos[campo.id] ?? String(campo.default_value ?? "")}
                      aoAlterar={aoAlterarCampo}
                    />
                  ))}
                </div>
              ) : (
                <p>Este cenário não exige parâmetros extras nesta etapa.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className={cx("rounded-2xl border px-4 py-3", classesResultado(resultado))}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold tracking-tight">Resultado mais recente</p>
              <p className="mt-1 text-sm">{resultado?.mensagem_interpretada ?? "Execute o cenário para receber a interpretação oficial do backend."}</p>
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
              {rotuloStatusExecucao(resultado)}
            </span>
          </div>
        </div>

        {resultado ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm md:grid-cols-2 xl:grid-cols-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status da execução</p>
                <p className="mt-1 font-semibold text-slate-900">{resultado.status_execucao}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Teste aprovado</p>
                <p className="mt-1 font-semibold text-slate-900">{resultado.teste_aprovado ? "sim" : "não"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Cenário</p>
                <p className="mt-1 font-semibold text-slate-900">{resultado.scenario_name}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Resultado esperado</p>
                <p className="mt-1 text-slate-700">{resultado.resultado_esperado}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Resultado observado</p>
                <p className="mt-1 text-slate-700">{resultado.resultado_observado}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Mensagem interpretada</p>
                <p className="mt-1 text-slate-700">{resultado.mensagem_interpretada}</p>
              </div>
            </div>

            {cenario.show_request_response ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">Request enviada</p>
                  {resultado.request_enviada.map((item, indice) => (
                    <PreviewPayload
                      key={`request-${indice}`}
                      titulo={`Passo ${indice + 1}`}
                      payload={item}
                    />
                  ))}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold tracking-tight text-slate-900">Resposta recebida</p>
                  {resultado.response_recebida.map((item, indice) => (
                    <PreviewPayload
                      key={`response-${indice}`}
                      titulo={`Resposta ${indice + 1}`}
                      payload={item}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {cenario.show_context ? (
              <PreviewPayload titulo="Contexto relevante" payload={resultado.contexto_relevante} />
            ) : null}

            {cenario.show_blockchain_impact ? (
              <PreviewPayload
                titulo="Impacto na blockchain"
                payload={resultado.impacto_blockchain}
              />
            ) : null}

            {resultado.erro_tecnico ? (
              <PreviewPayload titulo="Erro técnico" payload={resultado.erro_tecnico} />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  )
}
