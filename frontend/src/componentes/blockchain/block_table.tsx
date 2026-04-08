import { useMemo } from "react"

import type { BlocoBlockchain } from "../../lib/api/tipos"
import { encurtarHash, formatarData } from "../../lib/util/formatacao"

export type OrdenacaoTabela =
  | "indice-desc"
  | "indice-asc"
  | "timestamp-desc"
  | "eventos-desc"

export type FiltrosTabelaBlocos = {
  termoBusca: string
  filtroMinerador: string
  filtroComEventos: boolean
  ordenacao: OrdenacaoTabela
  pagina: number
}

const TAMANHO_PAGINA = 20

function valorNumerico(valor: number | undefined) {
  return typeof valor === "number" ? valor : "-"
}

function quantidadeEventos(bloco: BlocoBlockchain) {
  return typeof bloco.event_count === "number" ? bloco.event_count : bloco.events.length
}

export function BlockTable({
  blocos,
  hashSelecionado,
  onSelecionar,
  filtros,
  onMudarFiltros,
}: {
  blocos: BlocoBlockchain[]
  hashSelecionado?: string
  onSelecionar: (bloco: BlocoBlockchain) => void
  filtros: FiltrosTabelaBlocos
  onMudarFiltros: (proximo: Partial<FiltrosTabelaBlocos>) => void
}) {
  const mineradores = useMemo(() => {
    return Array.from(new Set(blocos.map((bloco) => bloco.miner_id ?? "genesis"))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [blocos])

  const hashMaisRecente = useMemo(() => {
    if (blocos.length === 0) {
      return undefined
    }

    return blocos.reduce((maisRecente, atual) =>
      atual.index > maisRecente.index ? atual : maisRecente,
    ).block_hash
  }, [blocos])

  const blocosFiltrados = useMemo(() => {
    const termo = filtros.termoBusca.trim().toLowerCase()

    const itens = blocos.filter((bloco) => {
      const minerador = bloco.miner_id ?? "genesis"
      const correspondeBusca =
        termo.length === 0 ||
        String(bloco.index).includes(termo) ||
        bloco.block_hash.toLowerCase().includes(termo) ||
        bloco.previous_hash.toLowerCase().includes(termo) ||
        minerador.toLowerCase().includes(termo)

      const correspondeMinerador =
        filtros.filtroMinerador === "todos" || minerador === filtros.filtroMinerador
      const correspondeEventos = !filtros.filtroComEventos || quantidadeEventos(bloco) > 0

      return correspondeBusca && correspondeMinerador && correspondeEventos
    })

    return [...itens].sort((a, b) => {
      if (filtros.ordenacao === "indice-asc") {
        return a.index - b.index
      }

      if (filtros.ordenacao === "timestamp-desc") {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }

      if (filtros.ordenacao === "eventos-desc") {
        return quantidadeEventos(b) - quantidadeEventos(a)
      }

      return b.index - a.index
    })
  }, [blocos, filtros])

  const totalPaginas = Math.max(1, Math.ceil(blocosFiltrados.length / TAMANHO_PAGINA))
  const paginaAtual = Math.min(Math.max(filtros.pagina, 1), totalPaginas)
  const inicio = (paginaAtual - 1) * TAMANHO_PAGINA
  const fim = inicio + TAMANHO_PAGINA
  const blocosPaginados = blocosFiltrados.slice(inicio, fim)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 lg:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
        <input
          value={filtros.termoBusca}
          onChange={(event) => onMudarFiltros({ termoBusca: event.target.value, pagina: 1 })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary/40"
          placeholder="Buscar por indice, hash, previous hash ou minerador"
        />

        <select
          value={filtros.filtroMinerador}
          onChange={(event) => onMudarFiltros({ filtroMinerador: event.target.value, pagina: 1 })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary/40"
        >
          <option value="todos">Todos os mineradores</option>
          {mineradores.map((minerador) => (
            <option key={minerador} value={minerador}>
              {minerador}
            </option>
          ))}
        </select>

        <select
          value={filtros.ordenacao}
          onChange={(event) => onMudarFiltros({ ordenacao: event.target.value as OrdenacaoTabela, pagina: 1 })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-primary/40"
        >
          <option value="indice-desc">Ordenar: indice desc</option>
          <option value="indice-asc">Ordenar: indice asc</option>
          <option value="timestamp-desc">Ordenar: timestamp desc</option>
          <option value="eventos-desc">Ordenar: eventos desc</option>
        </select>

        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filtros.filtroComEventos}
            onChange={(event) => onMudarFiltros({ filtroComEventos: event.target.checked, pagina: 1 })}
          />
          Somente com eventos
        </label>
      </div>

      <div className="text-xs text-slate-500">
        {blocosFiltrados.length} bloco{blocosFiltrados.length === 1 ? "" : "s"} exibido
        {blocosFiltrados.length === 1 ? "" : "s"} de {blocos.length}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
        <span>
          Pagina {paginaAtual} de {totalPaginas}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={paginaAtual <= 1}
            onClick={() => onMudarFiltros({ pagina: paginaAtual - 1 })}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => onMudarFiltros({ pagina: paginaAtual + 1 })}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Proxima
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/70 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left">Indice</th>
              <th className="px-3 py-2 text-left">Hash</th>
              <th className="px-3 py-2 text-left">Previous hash</th>
              <th className="px-3 py-2 text-left">Minerador</th>
              <th className="px-3 py-2 text-left">Timestamp</th>
              <th className="px-3 py-2 text-right">Eventos</th>
              <th className="px-3 py-2 text-right">Nonce</th>
              <th className="px-3 py-2 text-right">Dificuldade</th>
              <th className="px-3 py-2 text-right">Acao</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {blocosPaginados.map((bloco) => {
              const selecionado = bloco.block_hash === hashSelecionado
              const eventos = quantidadeEventos(bloco)
              return (
                <tr
                  key={bloco.block_hash}
                  className={selecionado ? "bg-primary/5" : "hover:bg-slate-50/70"}
                >
                  <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                    #{bloco.index}
                    {bloco.block_hash === hashMaisRecente && (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                        recente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-primary">
                    {encurtarHash(bloco.block_hash, 22)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[12px] text-slate-600">
                    {encurtarHash(bloco.previous_hash, 22)}
                  </td>
                  <td className="px-3 py-2.5">{bloco.miner_id ?? "genesis"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{formatarData(bloco.timestamp)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{eventos}</td>
                  <td className="px-3 py-2.5 text-right">{valorNumerico(bloco.nonce)}</td>
                  <td className="px-3 py-2.5 text-right">{valorNumerico(bloco.difficulty)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onSelecionar(bloco)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Inspecionar
                    </button>
                  </td>
                </tr>
              )
            })}

            {blocosPaginados.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">
                  Nenhum bloco corresponde aos filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
