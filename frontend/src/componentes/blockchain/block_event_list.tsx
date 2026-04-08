import { Link } from "react-router-dom"

import type { EventoBlockchain } from "../../lib/api/tipos"
import {
  construirLinkRastreabilidade,
  obterIdentificadorRastreabilidade,
} from "../../lib/util/blockchain"
import { formatarData } from "../../lib/util/formatacao"
import { BadgeEntidade } from "../comum/badge_entidade"
import { BadgeEvento } from "../comum/badge_evento"

function metadadosRelevantes(metadata: Record<string, unknown>) {
  return Object.entries(metadata)
    .filter(([, valor]) => ["string", "number", "boolean"].includes(typeof valor))
    .slice(0, 4)
}

export function BlockEventList({ eventos }: { eventos: EventoBlockchain[] }) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm text-slate-500">
        Este bloco nao contem eventos confirmados.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {eventos.map((evento) => {
        const identificador = obterIdentificadorRastreabilidade(evento)
        const linkRastreabilidade = construirLinkRastreabilidade(identificador)
        const metadados = metadadosRelevantes(evento.metadata)

        return (
          <article key={evento.event_id} className="rounded-xl border border-slate-200/70 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <BadgeEvento tipo={evento.event_type} />
                <BadgeEntidade tipo={evento.entity_kind} />
              </div>

              {linkRastreabilidade && (
                <Link
                  to={linkRastreabilidade}
                  className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                >
                  Ver rastreabilidade
                </Link>
              )}
            </div>

            <h4 className="mt-3 text-base font-semibold tracking-tight text-slate-900">
              {evento.product_name || "Item sem nome"}
            </h4>

            <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                <span className="font-semibold text-slate-700">Identificador:</span>{" "}
                {identificador ?? evento.event_id}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Timestamp:</span> {formatarData(evento.timestamp)}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-700">event_id:</span> {evento.event_id}
              </p>
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">input_ids</p>
              {evento.input_ids.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {evento.input_ids.map((inputId) => (
                    <span
                      key={inputId}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-600"
                    >
                      {inputId}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Sem insumos de entrada neste evento.</p>
              )}
            </div>

            <div className="mt-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Metadados relevantes
              </p>
              {metadados.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {metadados.map(([chave, valor]) => (
                    <span
                      key={chave}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                    >
                      {chave}: {String(valor)}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Sem metadados simples para exibicao compacta.</p>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
