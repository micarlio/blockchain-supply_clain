import { useEffect, useMemo, useState } from "react"

import type { ConfiguracaoNo } from "../lib/api/tipos"
import { ContextoNos } from "./contexto_nos"

const NOME_CHAVE = "supply-chain-no-ativo"

const NOS_PADRAO: ConfiguracaoNo[] = [
  {
    id: "node-alpha",
    nome: "Node Alpha",
    url: import.meta.env.VITE_NODE_ALPHA_URL ?? "http://127.0.0.1:8001",
  },
  {
    id: "node-beta",
    nome: "Node Beta",
    url: import.meta.env.VITE_NODE_BETA_URL ?? "http://127.0.0.1:8002",
  },
  {
    id: "node-gamma",
    nome: "Node Gamma",
    url: import.meta.env.VITE_NODE_GAMMA_URL ?? "http://127.0.0.1:8003",
  },
]

export function ProvedorNos({ children }: { children: React.ReactNode }) {
  const [noAtivoId, setNoAtivoId] = useState<string>(() => {
    const salvo = window.localStorage.getItem(NOME_CHAVE)
    return salvo || NOS_PADRAO[0].id
  })

  useEffect(() => {
    window.localStorage.setItem(NOME_CHAVE, noAtivoId)
  }, [noAtivoId])

  const noAtivo = useMemo(
    () => NOS_PADRAO.find((no) => no.id === noAtivoId) ?? NOS_PADRAO[0],
    [noAtivoId],
  )

  return (
    <ContextoNos.Provider
      value={{
        nos: NOS_PADRAO,
        noAtivo,
        definirNoAtivo: setNoAtivoId,
      }}
    >
      {children}
    </ContextoNos.Provider>
  )
}
