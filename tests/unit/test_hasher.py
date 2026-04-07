"""Testes unitarios das funcoes de hashing."""

import pytest

from src.core.services.hasher import (
    calcular_hash_bloco,
    calcular_hash_dados,
    calcular_sha256_hex,
    serializar_json_estavel,
)


def test_serializar_json_estavel_ordena_chaves_recursivamente() -> None:
    """A serializacao deve ser identica independentemente da ordem das chaves."""

    payload = {"b": 1, "a": {"d": 4, "c": 3}}

    assert serializar_json_estavel(payload) == '{"a":{"c":3,"d":4},"b":1}'


def test_calcular_sha256_hex_retorna_valor_conhecido() -> None:
    """O hash de um payload conhecido deve ser previsivel."""

    assert (
        calcular_sha256_hex("abc")
        == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )


def test_calcular_hash_dados_ignora_ordem_das_chaves_do_payload() -> None:
    """Dois payloads semanticamente iguais devem gerar o mesmo hash."""

    events_a = [
        {
            "event_id": "evt-001",
            "metadata": {"origin": "Fazenda A", "quantity": 100},
            "input_ids": ["lote-01"],
        }
    ]
    events_b = [
        {
            "input_ids": ["lote-01"],
            "metadata": {"quantity": 100, "origin": "Fazenda A"},
            "event_id": "evt-001",
        }
    ]

    assert calcular_hash_dados(events_a) == calcular_hash_dados(events_b)


def test_calcular_hash_bloco_ignora_ordem_das_chaves_do_cabecalho() -> None:
    """A ordem das chaves nao pode alterar o hash do cabecalho."""

    header_a = {
        "index": 1,
        "timestamp": "2026-04-01T10:00:00Z",
        "previous_hash": "abc",
        "difficulty": 2,
        "nonce": 10,
        "event_count": 1,
        "data_hash": "def",
    }
    header_b = {
        "event_count": 1,
        "nonce": 10,
        "difficulty": 2,
        "data_hash": "def",
        "previous_hash": "abc",
        "timestamp": "2026-04-01T10:00:00Z",
        "index": 1,
    }

    assert calcular_hash_bloco(header_a) == calcular_hash_bloco(header_b)


def test_serializar_json_estavel_rejeita_tipos_nao_suportados() -> None:
    """Tipos nao JSON devem falhar explicitamente."""

    with pytest.raises(TypeError):
        serializar_json_estavel({"invalid": {1, 2, 3}})
