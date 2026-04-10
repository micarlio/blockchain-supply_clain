"""Coletor simples de logs estruturados em memoria."""

from __future__ import annotations

import json
from contextvars import ContextVar, Token
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from threading import RLock
from typing import Any
from uuid import uuid4


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


_CONTEXTO_REQUEST_LOG: ContextVar[dict[str, str] | None] = ContextVar(
    "contexto_request_log",
    default=None,
)


def ativar_contexto_log_request(
    request_id: str,
    method: str,
    endpoint: str,
) -> Token[dict[str, str] | None]:
    """Guarda metadados da request atual para correlacionar logs internos."""

    return _CONTEXTO_REQUEST_LOG.set(
        {
            "request_id": request_id,
            "method": method,
            "endpoint": endpoint,
        }
    )


def restaurar_contexto_log_request(token: Token[dict[str, str] | None]) -> None:
    """Restaura o contexto anterior da request."""

    _CONTEXTO_REQUEST_LOG.reset(token)


def obter_contexto_log_request() -> dict[str, str] | None:
    """Devolve o contexto da request corrente quando existir."""

    return _CONTEXTO_REQUEST_LOG.get()


def normalizar_endpoint_log(path: str) -> str:
    """Converte rotas dinamicas em templates estaveis para observabilidade."""

    if path.startswith("/rastreabilidade/"):
        return "/rastreabilidade/{identificador}"
    if path.startswith("/testes/cenarios/"):
        return "/testes/cenarios/{scenario_id}"
    if path.startswith("/testes/executar/"):
        return "/testes/executar/{scenario_id}"
    return path


def _normalizar_payload(valor: Any) -> Any:
    """Garante que o valor fique serializavel e com tamanho controlado."""

    if valor is None:
        return None

    try:
        serializado = json.dumps(valor, ensure_ascii=True, default=str)
    except TypeError:
        serializado = json.dumps(str(valor), ensure_ascii=True)

    if len(serializado) > 6000:
        return {
            "truncated": True,
            "preview": serializado[:6000],
        }

    try:
        return json.loads(serializado)
    except json.JSONDecodeError:
        return serializado


@dataclass(slots=True)
class EntradaLogMemoria:
    """Representa um log estruturado exposto para o frontend."""

    id: str
    timestamp: str
    level: str
    node_id: str
    category: str
    message: str
    event_type: str | None = None
    endpoint: str | None = None
    method: str | None = None
    request_id: str | None = None
    status_code: int | None = None
    duration_ms: int | None = None
    request_payload: Any = None
    response_payload: Any = None
    context: dict[str, Any] = field(default_factory=dict)

    def para_dict(self) -> dict[str, Any]:
        """Serializa a entrada para a API."""

        return asdict(self)


class ColetorLogsMemoria:
    """Mantem um buffer circular simples de logs estruturados."""

    def __init__(self, node_id: str, *, capacidade_maxima: int = 500) -> None:
        self.node_id = node_id
        self.capacidade_maxima = capacidade_maxima
        self._trava = RLock()
        self._entradas: list[EntradaLogMemoria] = []

    def registrar(
        self,
        *,
        level: str,
        category: str,
        message: str,
        event_type: str | None = None,
        endpoint: str | None = None,
        method: str | None = None,
        request_id: str | None = None,
        status_code: int | None = None,
        duration_ms: int | None = None,
        request_payload: Any = None,
        response_payload: Any = None,
        context: dict[str, Any] | None = None,
        timestamp: str | None = None,
    ) -> dict[str, Any]:
        """Registra um novo log ja pronto para serializacao."""

        contexto_request = obter_contexto_log_request() or {}
        entrada = EntradaLogMemoria(
            id=f"log-{uuid4().hex}",
            timestamp=timestamp or _timestamp_utc_atual(),
            level=level.upper(),
            node_id=self.node_id,
            category=category,
            message=message,
            event_type=event_type,
            endpoint=endpoint or contexto_request.get("endpoint"),
            method=method or contexto_request.get("method"),
            request_id=request_id or contexto_request.get("request_id"),
            status_code=status_code,
            duration_ms=duration_ms,
            request_payload=_normalizar_payload(request_payload),
            response_payload=_normalizar_payload(response_payload),
            context=_normalizar_payload(context or {}) or {},
        )

        with self._trava:
            self._entradas.append(entrada)
            self._entradas = self._entradas[-self.capacidade_maxima :]

        return entrada.para_dict()

    def listar(self, limite: int = 200) -> list[dict[str, Any]]:
        """Lista os logs mais recentes, dos mais novos para os mais antigos."""

        limite_normalizado = max(1, min(int(limite), self.capacidade_maxima))
        with self._trava:
            entradas = list(reversed(self._entradas[-limite_normalizado:]))

        return [entrada.para_dict() for entrada in entradas]

    def limpar(self) -> None:
        """Apaga todas as entradas armazenadas."""

        with self._trava:
            self._entradas = []
