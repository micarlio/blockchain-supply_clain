import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"

import { Aplicacao } from "./app/aplicacao"
import { ProvedorNos } from "./app/provedor_nos"
import "./index.css"

const clienteConsulta = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1_500,
    },
  },
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={clienteConsulta}>
      <BrowserRouter>
        <ProvedorNos>
          <Aplicacao />
        </ProvedorNos>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
