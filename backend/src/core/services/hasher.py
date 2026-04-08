"""Funcoes utilitarias para serializacao deterministica e hashing."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def _normalizar_payload(payload: Any) -> Any:
    """Deixa o payload num formato simples antes de serializar."""

    if hasattr(payload, "para_dict") and callable(payload.para_dict):
        return _normalizar_payload(payload.para_dict())

    if isinstance(payload, dict):
        return {str(key): _normalizar_payload(value) for key, value in payload.items()}

    if isinstance(payload, list):
        return [_normalizar_payload(item) for item in payload]

    if isinstance(payload, tuple):
        return [_normalizar_payload(item) for item in payload]

    return payload


def serializar_json_estavel(payload: Any) -> str:
    """Serializa sempre com a mesma ordem de chaves."""

    payload_normalizado = _normalizar_payload(payload)
    return json.dumps(
        payload_normalizado,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )


def calcular_sha256_hex(payload: str) -> str:
    """Calcula o SHA256 em hexadecimal."""

    return hashlib.sha256(str(payload).encode("utf-8")).hexdigest()


def calcular_hash_dados(events: list[dict[str, Any]]) -> str:
    """Calcula o hash da lista de eventos do bloco."""

    return calcular_sha256_hex(serializar_json_estavel(events))


def calcular_hash_bloco(header: dict[str, Any]) -> str:
    """Calcula o hash do cabecalho do bloco."""

    return calcular_sha256_hex(serializar_json_estavel(header))


def stable_json_dumps(payload: Any) -> str:
    """Alias de compatibilidade para `serializar_json_estavel`."""

    return serializar_json_estavel(payload)


def sha256_hex(payload: str) -> str:
    """Alias de compatibilidade para `calcular_sha256_hex`."""

    return calcular_sha256_hex(payload)


def compute_data_hash(events: list[dict[str, Any]]) -> str:
    """Alias de compatibilidade para `calcular_hash_dados`."""

    return calcular_hash_dados(events)


def compute_block_hash(header: dict[str, Any]) -> str:
    """Alias de compatibilidade para `calcular_hash_bloco`."""

    return calcular_hash_bloco(header)
