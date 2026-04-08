"""Fábrica da aplicação HTTP baseada em FastAPI."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api_http.no_aplicacao import NoAplicacaoBlockchain


def criar_aplicacao_http(no_aplicacao: NoAplicacaoBlockchain) -> FastAPI:
    """Monta a API HTTP de um nó da blockchain."""

    @asynccontextmanager
    async def ciclo_vida(_aplicacao: FastAPI):
        try:
            yield
        finally:
            no_aplicacao.encerrar()

    aplicacao = FastAPI(
        title="Blockchain Supply Chain",
        version="1.0.0",
        description="API local da blockchain distribuída para rastreabilidade.",
        lifespan=ciclo_vida,
    )
    aplicacao.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @aplicacao.get("/")
    def inicio() -> dict[str, object]:
        """Resumo curto do nó para facilitar testes e inspeção manual."""

        return {
            "status": "online",
            "node_id": no_aplicacao.config.node_id,
            "papel_no": no_aplicacao.obter_papel_no(),
        }

    @aplicacao.post("/eventos")
    def postar_evento(
        payload: dict[str, Any] = Body(...),
        propagar_rede: bool = Query(True),
    ) -> JSONResponse:
        """Recebe um evento, valida e tenta colocá-lo na mempool."""

        resultado = no_aplicacao.adicionar_evento_por_payload(
            payload,
            publicar_na_rede=propagar_rede,
            origem="api",
        )
        status_code = 200 if resultado["status"] == "evento_adicionado" else 400
        return JSONResponse(resultado, status_code=status_code)

    @aplicacao.get("/estado")
    def obter_estado() -> dict[str, object]:
        """Resumo curto do estado local do nó."""

        return no_aplicacao.obter_estado()

    @aplicacao.get("/cadeia")
    def obter_cadeia() -> dict[str, object]:
        """Serializa a cadeia ativa e as ramificações conhecidas."""

        return no_aplicacao.obter_cadeia()

    @aplicacao.get("/mempool")
    def obter_mempool() -> dict[str, object]:
        """Lista os eventos pendentes no nó local."""

        return no_aplicacao.obter_mempool()

    @aplicacao.get("/rastreabilidade/{identificador}")
    def obter_rastreabilidade(identificador: str) -> dict[str, object]:
        """Busca o histórico de um `product_id` ou `lot_id`."""

        return no_aplicacao.obter_rastreabilidade(identificador)

    @aplicacao.get("/rede")
    def obter_rede() -> dict[str, object]:
        """Entrega a visão local da rede conhecida pelo nó."""

        return no_aplicacao.obter_rede()

    @aplicacao.get("/demonstracao")
    def obter_demonstracao() -> dict[str, object]:
        """Resumo usado na demonstração do projeto."""

        return no_aplicacao.obter_demonstracao()

    @aplicacao.post("/demonstracao/minerar")
    def minerar_uma_vez() -> JSONResponse:
        """Dispara uma rodada manual de mineração no nó atual."""

        resultado = no_aplicacao.minerar_uma_vez()
        status_code = 200
        if resultado["status"] == "mineracao_indisponivel":
            status_code = 400
        return JSONResponse(resultado, status_code=status_code)

    return aplicacao
