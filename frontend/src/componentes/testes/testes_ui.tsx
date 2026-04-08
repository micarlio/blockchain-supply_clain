import { PreviewPayload } from "../comum/preview_payload"
import { cx } from "../../lib/util/classe"

export type ScenarioSeverity = "validation" | "security" | "consensus"
export type ScenarioExecutionMode = "request_real" | "simulacao_real" | "inspecao_rede"
export type ScenarioTone = "success" | "warning" | "error" | "info"

export type ScenarioListItem = {
  id: string
  name: string
  categoryLabel: string
  severity: ScenarioSeverity
  shortDescription: string
  expectedBehavior: string
  ready: boolean
  prerequisiteMessage?: string
}

export type ScenarioCategorySection = {
  id: string
  title: string
  description: string
  items: ScenarioListItem[]
}

export type ScenarioPanelView = {
  id: string
  name: string
  categoryLabel: string
  severity: ScenarioSeverity
  shortDescription: string
  description: string
  expectedBehavior: string
  importance: string
  executionMode: ScenarioExecutionMode
  ready: boolean
  prerequisiteMessage?: string
  supportTexts: string[]
}

export type ScenarioPayloadPreview = {
  label: string
  payload: unknown
}

export type ScenarioContextRow = {
  label: string
  value: string
  mono?: boolean
}

export type ScenarioContextSection = {
  title: string
  description?: string
  rows: ScenarioContextRow[]
}

export type ScenarioImpactRow = {
  label: string
  before: string
  after: string
  changed: boolean
}

export type ScenarioImpactView = {
  title: string
  summary: string
  tone: ScenarioTone
  rows: ScenarioImpactRow[]
  affectedBlocks: string[]
  notes: string[]
}

export type ScenarioResultView = {
  scenarioId: string
  scenarioName: string
  targetNodes: string[]
  executionMode: ScenarioExecutionMode
  statusLabel: string
  tone: ScenarioTone
  httpStatus?: string
  expectedBehavior: string
  observedBehavior: string
  finalInterpretation: string
  highlights: string[]
  requests: ScenarioPayloadPreview[]
  responses: ScenarioPayloadPreview[]
  impact: ScenarioImpactView | null
}

const severityMeta: Record<ScenarioSeverity, { label: string; classes: string }> = {
  validation: {
    label: "Validação",
    classes: "border-blue-200 bg-blue-50 text-blue-800",
  },
  security: {
    label: "Segurança",
    classes: "border-amber-200 bg-amber-50 text-amber-800",
  },
  consensus: {
    label: "Consenso / 51%",
    classes: "border-red-200 bg-red-50 text-red-700",
  },
}

const toneClasses: Record<ScenarioTone, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-800",
}

const executionModeLabel: Record<ScenarioExecutionMode, string> = {
  request_real: "request real",
  simulacao_real: "simulação real",
  inspecao_rede: "inspeção da rede",
}

export function ScenarioSeverityBadge({ severity }: { severity: ScenarioSeverity }) {
  const meta = severityMeta[severity]

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        meta.classes,
      )}
    >
      {meta.label}
    </span>
  )
}

export function ScenarioCategoryList({
  sections,
  selectedId,
  onSelect,
}: {
  sections: ScenarioCategorySection[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-5">
      {sections.map((section) => (
        <div key={section.id} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-3">
            <p className="text-sm font-semibold tracking-tight text-slate-900">{section.title}</p>
            <p className="mt-1 text-sm text-slate-500">{section.description}</p>
          </div>

          <div className="space-y-2.5">
            {section.items.map((item) => {
              const selected = item.id === selectedId

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cx(
                    "w-full rounded-2xl border p-4 text-left transition-all",
                    selected
                      ? "border-primary/40 bg-primary/5 shadow-[0_0_0_3px_rgba(59,130,246,0.08)]"
                      : "border-slate-200/80 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold tracking-tight text-slate-900">{item.name}</p>
                    <ScenarioSeverityBadge severity={item.severity} />
                    <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                      {item.categoryLabel}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-600">{item.shortDescription}</p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Esperado: {item.expectedBehavior}
                  </p>

                  {!item.ready ? (
                    <p className="mt-2 text-xs text-amber-700">{item.prerequisiteMessage}</p>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ScenarioResultCard({ result }: { result: ScenarioResultView }) {
  return (
    <div className="space-y-4">
      <div className={cx("rounded-2xl border px-4 py-3", toneClasses[result.tone])}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-tight">{result.scenarioName}</p>
            <p className="mt-1 text-sm">{result.finalInterpretation}</p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
            {result.statusLabel}
          </span>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Nó alvo</p>
          <p className="mt-1 font-semibold text-slate-900">{result.targetNodes.join(", ")}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Tipo de execução</p>
          <p className="mt-1 font-semibold text-slate-900">{executionModeLabel[result.executionMode]}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Status HTTP / execução</p>
          <p className="mt-1 font-semibold text-slate-900">{result.httpStatus ?? "sem HTTP relevante"}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Comportamento esperado</p>
          <p className="mt-1 text-slate-700">{result.expectedBehavior}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Comportamento observado</p>
          <p className="mt-1 text-slate-700">{result.observedBehavior}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Interpretação final</p>
          <p className="mt-1 text-slate-700">{result.finalInterpretation}</p>
        </div>
      </div>

      {result.highlights.length ? (
        <div className="flex flex-wrap gap-2">
          {result.highlights.map((highlight) => (
            <span
              key={highlight}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600"
            >
              {highlight}
            </span>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Request enviada</p>
          <div className="space-y-3">
            {result.requests.map((request) => (
              <PreviewPayload key={request.label} titulo={request.label} payload={request.payload} />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold tracking-tight text-slate-900">Resposta recebida</p>
          <div className="space-y-3">
            {result.responses.map((response) => (
              <PreviewPayload key={response.label} titulo={response.label} payload={response.payload} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ScenarioExecutionPanel({
  scenario,
  running,
  onRun,
  preparedRequests,
  result,
}: {
  scenario: ScenarioPanelView
  running: boolean
  onRun: () => void
  preparedRequests: ScenarioPayloadPreview[]
  result: ScenarioResultView | null
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-semibold tracking-tight text-slate-900">{scenario.name}</p>
              <ScenarioSeverityBadge severity={scenario.severity} />
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                {scenario.categoryLabel}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{scenario.shortDescription}</p>
          </div>

          <button
            type="button"
            onClick={onRun}
            disabled={!scenario.ready || running}
            className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {running ? "executando" : "executar cenário"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Descrição</p>
            <p className="mt-2 text-sm text-slate-700">{scenario.description}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Comportamento esperado</p>
            <p className="mt-2 text-sm text-slate-700">{scenario.expectedBehavior}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Por que importa</p>
            <p className="mt-2 text-sm text-slate-700">{scenario.importance}</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Execução</p>
            <p className="mt-2 text-sm text-slate-700">{executionModeLabel[scenario.executionMode]}</p>
            {!scenario.ready ? (
              <p className="mt-2 text-sm text-amber-700">{scenario.prerequisiteMessage}</p>
            ) : null}
          </div>
        </div>

        {scenario.supportTexts.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {scenario.supportTexts.map((text) => (
              <div key={text} className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-700">
                {text}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-base font-semibold tracking-tight text-slate-900">Preview da execução</p>
        <p className="mt-1 text-sm text-slate-500">A aba usa requests reais ou inspeções reais contra o cluster atual.</p>

        <div className="mt-4 space-y-3">
          {preparedRequests.map((request) => (
            <PreviewPayload key={request.label} titulo={request.label} payload={request.payload} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <p className="text-base font-semibold tracking-tight text-slate-900">Último resultado</p>
        <p className="mt-1 text-sm text-slate-500">
          Erro esperado do backend aparece como teste aprovado. Falhas locais e aceitações indevidas aparecem separadamente.
        </p>

        <div className="mt-4">
          {result ? (
            <ScenarioResultCard result={result} />
          ) : (
            <p className="text-sm text-slate-500">Execute um cenário para registrar request, resposta, impacto na cadeia e interpretação final.</p>
          )}
        </div>
      </section>
    </div>
  )
}

export function ScenarioContextCard({
  sections,
}: {
  sections: ScenarioContextSection[]
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-base font-semibold tracking-tight text-slate-900">Contexto do cenário</p>
      <p className="mt-1 text-sm text-slate-500">O painel tenta reaproveitar dados reais do nó ativo e do cluster antes de executar qualquer cenário.</p>

      <div className="mt-4 space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-900">{section.title}</p>
              {section.description ? <p className="mt-1 text-sm text-slate-500">{section.description}</p> : null}
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              {section.rows.map((row) => (
                <div key={`${section.title}-${row.label}`} className="flex items-start justify-between gap-4 border-b border-slate-200/70 pb-2 last:border-b-0 last:pb-0">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className={cx("text-right font-semibold text-slate-900", row.mono && "font-mono text-[12px]")}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ScenarioBlockchainImpact({
  impact,
  expectedSummary,
}: {
  impact: ScenarioImpactView | null
  expectedSummary: string
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-base font-semibold tracking-tight text-slate-900">Impacto na blockchain</p>
      <p className="mt-1 text-sm text-slate-500">A aba não para em aceitou ou rejeitou: ela compara a cadeia antes e depois e resume o efeito observado.</p>

      {impact ? (
        <div className="mt-4 space-y-4">
          <div className={cx("rounded-2xl border px-4 py-3", toneClasses[impact.tone])}>
            <p className="text-sm font-semibold tracking-tight">{impact.title}</p>
            <p className="mt-1 text-sm">{impact.summary}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {impact.rows.map((row) => (
              <div key={row.label} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{row.label}</p>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Antes</p>
                    <p className="mt-1 break-all text-slate-700">{row.before}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Depois</p>
                    <p className={cx("mt-1 break-all", row.changed ? "font-semibold text-slate-900" : "text-slate-700")}>{row.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {impact.affectedBlocks.length ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Blocos afetados</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {impact.affectedBlocks.map((block) => (
                  <span key={block} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    {block}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {impact.notes.length ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Leitura do impacto</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {impact.notes.map((note) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-sm text-slate-600">
          {expectedSummary}
        </div>
      )}
    </section>
  )
}
