import { formatarJson } from "../../lib/util/formatacao"

function renderizarValorJson(valor: string) {
  const valorNormalizado = valor.trim()

  if (valorNormalizado.startsWith('"') && valorNormalizado.endsWith('"')) {
    return <span className="text-[#0f766e]">{valor}</span>
  }

  if (/^-?\d+(\.\d+)?$/.test(valorNormalizado)) {
    return <span className="text-[#9333ea]">{valor}</span>
  }

  if (/^(true|false)$/.test(valorNormalizado)) {
    return <span className="text-[#c2410c]">{valor}</span>
  }

  if (valorNormalizado === "null") {
    return <span className="text-[#7c3aed]">{valor}</span>
  }

  return <span className="text-[#334155]">{valor}</span>
}

function renderizarLinhaJson(linha: string) {
  const correspondencia = linha.match(/^(\s*)"([^"]+)":\s(.*?)(,?)$/)

  if (!correspondencia) {
    return <span className="text-[#334155]">{linha}</span>
  }

  const [, indentacao, chave, valor, virgula] = correspondencia

  return (
    <>
      <span className="text-[#334155]">{indentacao}</span>
      <span className="text-[#1d4ed8]">"{chave}"</span>
      <span className="text-[#334155]">: </span>
      {renderizarValorJson(valor)}
      {virgula ? <span className="text-[#334155]">{virgula}</span> : null}
    </>
  )
}

export function PreviewPayload({
  titulo = "Preview do payload",
  payload,
}: {
  titulo?: string
  payload: unknown
}) {
  const linhas = formatarJson(payload).split("\n")

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-[#dbe4f0] bg-[#f8fafc] shadow-[0_18px_42px_rgba(15,23,42,0.1)]">
      <div className="flex items-center justify-between border-b border-[#dbe4f0] bg-[#f1f5f9] px-4 py-3">
        <div className="flex items-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748b]">{titulo}</p>
        </div>
        <span className="rounded-md border border-[#d7e3f2] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#64748b]">
          json
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-fit px-2 py-3">
          {linhas.map((linha, indice) => (
            <div
              key={`${indice}-${linha}`}
              className="grid grid-cols-[3rem_1fr] items-start gap-3 rounded-lg px-2 py-1 text-[13px] leading-7 transition-colors hover:bg-white/70"
            >
              <span className="select-none border-r border-[#e2e8f0] pr-3 text-right font-mono text-[#94a3b8]">
                {String(indice + 1).padStart(2, "0")}
              </span>
              <code className="whitespace-pre font-mono text-[#334155]">{renderizarLinhaJson(linha)}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
