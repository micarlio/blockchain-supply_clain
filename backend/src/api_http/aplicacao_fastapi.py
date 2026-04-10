"""Fábrica da aplicação HTTP baseada em FastAPI."""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from time import perf_counter
from typing import Any
from uuid import uuid4

from fastapi import Body, FastAPI, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api_http.no_aplicacao import NoAplicacaoBlockchain
from src.core.services.logs_memoria import (
    ativar_contexto_log_request,
    normalizar_endpoint_log,
    restaurar_contexto_log_request,
)


def _deve_guardar_payload_resposta(
    endpoint: str,
    method: str,
    status_code: int,
) -> bool:
    """Evita armazenar respostas muito verbosas de chamadas apenas consultivas."""

    if status_code >= 400:
        return True
    if method != "GET":
        return True
    return endpoint == "/rastreabilidade/{identificador}"


async def _capturar_payload_request(request: Request) -> object | None:
    """Lê o corpo sem impedir a FastAPI de consumi-lo depois."""

    corpo = await request.body()

    async def receber() -> dict[str, object]:
        return {
            "type": "http.request",
            "body": corpo,
            "more_body": False,
        }

    request._receive = receber  # type: ignore[attr-defined]
    if not corpo:
        return None

    try:
        return json.loads(corpo.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return corpo.decode("utf-8", errors="ignore")[:2000]


def _capturar_payload_response(response: Response) -> object | None:
    """Extrai o corpo de respostas simples para enriquecer os logs."""

    corpo = getattr(response, "body", None)
    if not corpo:
        return None

    if isinstance(corpo, bytes):
        try:
            return json.loads(corpo.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return corpo.decode("utf-8", errors="ignore")[:2000]

    if isinstance(corpo, str):
        try:
            return json.loads(corpo)
        except json.JSONDecodeError:
            return corpo[:2000]

    return None


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

    @aplicacao.middleware("http")
    async def registrar_requests(request: Request, call_next):
        endpoint = normalizar_endpoint_log(request.url.path)
        if endpoint == "/logs":
            return await call_next(request)

        metodo = request.method.upper()
        request_id = f"req-{uuid4().hex[:12]}"
        payload_request = await _capturar_payload_request(request)
        inicio = perf_counter()
        token = ativar_contexto_log_request(request_id, metodo, endpoint)

        try:
            response = await call_next(request)
        except Exception as erro:
            no_aplicacao.registrar_log(
                level="ERROR",
                category="api",
                message=f"{metodo} {endpoint} falhou com excecao.",
                event_type="api_request",
                endpoint=endpoint,
                method=metodo,
                request_id=request_id,
                status_code=500,
                duration_ms=int((perf_counter() - inicio) * 1000),
                request_payload=payload_request,
                response_payload={"erro": str(erro)},
                context={"query_params": dict(request.query_params)},
            )
            raise
        finally:
            restaurar_contexto_log_request(token)

        payload_response = None
        if _deve_guardar_payload_resposta(endpoint, metodo, response.status_code):
            payload_response = _capturar_payload_response(response)

        nivel = "INFO"
        if response.status_code >= 500:
            nivel = "ERROR"
        elif response.status_code >= 400:
            nivel = "WARN"

        no_aplicacao.registrar_log(
            level=nivel,
            category="api",
            message=f"{metodo} {endpoint} -> {response.status_code}",
            event_type="api_request",
            endpoint=endpoint,
            method=metodo,
            request_id=request_id,
            status_code=response.status_code,
            duration_ms=int((perf_counter() - inicio) * 1000),
            request_payload=payload_request,
            response_payload=payload_response,
            context={"query_params": dict(request.query_params)},
        )
        response.headers["x-request-id"] = request_id
        return response

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

        try:
            return no_aplicacao.obter_rastreabilidade(identificador)
        except ValueError as erro:
            return JSONResponse(
                {"status": "rastreabilidade_rejeitada", "motivo": str(erro)},
                status_code=409,
            )

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

    @aplicacao.patch("/configuracao/no")
    def atualizar_configuracao_no(payload: dict[str, Any] = Body(...)) -> JSONResponse:
        """Atualiza papel e hash power do nó em memória."""

        try:
            resultado = no_aplicacao.atualizar_configuracao_no(payload)
        except ValueError as erro:
            return JSONResponse(
                {"status": "configuracao_rejeitada", "motivo": str(erro)},
                status_code=400,
            )

        return JSONResponse(resultado, status_code=200)

    @aplicacao.patch("/configuracao/rede")
    def atualizar_configuracao_rede(
        payload: dict[str, Any] = Body(...),
    ) -> JSONResponse:
        """Atualiza a dificuldade global usada pelo nó local."""

        try:
            resultado = no_aplicacao.atualizar_dificuldade_global(payload)
        except ValueError as erro:
            return JSONResponse(
                {"status": "configuracao_rejeitada", "motivo": str(erro)},
                status_code=400,
            )
        except RuntimeError as erro:
            return JSONResponse(
                {"status": "configuracao_parcial", "motivo": str(erro)},
                status_code=409,
            )

        return JSONResponse(resultado, status_code=200)

    @aplicacao.post("/memoria/limpar")
    def limpar_memoria() -> JSONResponse:
        """Reinicia o estado em memória do nó para o baseline da execução."""

        resultado = no_aplicacao.limpar_memoria()
        return JSONResponse(resultado, status_code=200)

    @aplicacao.get("/logs")
    def obter_logs(limite: int = Query(200, ge=1, le=500)) -> dict[str, object]:
        """Lista os logs estruturados mais recentes do nó local."""

        return no_aplicacao.obter_logs(limite)

    @aplicacao.get("/testes/cenarios")
    def listar_cenarios_teste() -> list[dict[str, object]]:
        """Lista os cenarios oficiais que o backend sabe executar."""

        return no_aplicacao.listar_cenarios_teste()

    @aplicacao.get("/testes/cenarios/{scenario_id}")
    def detalhar_cenario_teste(scenario_id: str) -> JSONResponse:
        """Retorna a definicao completa de um cenario registrado."""

        resultado = no_aplicacao.detalhar_cenario_teste(scenario_id)
        if resultado is None:
            return JSONResponse(
                {"status": "cenario_nao_encontrado", "motivo": scenario_id},
                status_code=404,
            )
        return JSONResponse(resultado, status_code=200)

    @aplicacao.post("/testes/executar/{scenario_id}")
    def executar_cenario_teste(
        scenario_id: str,
        payload: dict[str, Any] | None = Body(None),
    ) -> JSONResponse:
        """Executa um cenario de teste no backend."""

        resultado = no_aplicacao.executar_cenario_teste(scenario_id, payload or {})
        if resultado is None:
            return JSONResponse(
                {"status": "cenario_nao_encontrado", "motivo": scenario_id},
                status_code=404,
            )
        return JSONResponse(resultado, status_code=200)

    return aplicacao
