import { createContext, useContext } from "react"

import type { ConfiguracaoNo } from "../lib/api/tipos"

export type ValorContextoNos = {
  nos: ConfiguracaoNo[]
  noAtivo: ConfiguracaoNo
  definirNoAtivo: (id: string) => void
}

export const ContextoNos = createContext<ValorContextoNos | null>(null)

export function useNos() {
  const contexto = useContext(ContextoNos)
  if (!contexto) {
    throw new Error("useNos precisa estar dentro de ProvedorNos")
  }
  return contexto
}
