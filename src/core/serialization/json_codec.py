"""Codec JSON para integracao entre o core e a camada de comunicacao."""

from __future__ import annotations

import json

from core.models.block import Block
from core.models.event import SupplyChainEvent
from core.services.hasher import serializar_json_estavel


def _json_para_dict(payload: str) -> dict[str, object] | None:
    """O codec trabalha sempre com objetos JSON simples."""

    if not isinstance(payload, str):
        return None

    data = json.loads(payload)
    if not isinstance(data, dict):
        return None

    return data


def evento_para_dict(event: SupplyChainEvent) -> dict[str, object]:
    """Serializa um evento para um formato simples de transporte."""

    if not isinstance(event, SupplyChainEvent):
        return {}

    return event.para_dict()


def evento_de_dict(data: dict[str, object]) -> SupplyChainEvent | None:
    """Reconstrui o evento a partir de um dicionario."""

    return SupplyChainEvent.de_dict(data)


def evento_para_json(event: SupplyChainEvent) -> str:
    """Gera um JSON estavel para facilitar transporte e comparacao."""

    return serializar_json_estavel(evento_para_dict(event))


def evento_de_json(payload: str) -> SupplyChainEvent | None:
    """Lê um evento vindo como JSON."""

    data = _json_para_dict(payload)
    if data is None:
        return None

    return evento_de_dict(data)


def bloco_para_dict(block: Block) -> dict[str, object]:
    """Serializa um bloco para um dicionario simples."""

    if not isinstance(block, Block):
        return {}

    return block.para_dict()


def bloco_de_dict(data: dict[str, object]) -> Block | None:
    """Reconstrui um bloco a partir de um dicionario."""

    return Block.de_dict(data)


def bloco_para_json(block: Block) -> str:
    """Gera o JSON estavel do bloco para envio na rede."""

    return serializar_json_estavel(bloco_para_dict(block))


def bloco_de_json(payload: str) -> Block | None:
    """Lê um bloco vindo como JSON."""

    data = _json_para_dict(payload)
    if data is None:
        return None

    return bloco_de_dict(data)


def event_to_dict(event: SupplyChainEvent) -> dict[str, object]:
    """Alias de compatibilidade para `evento_para_dict`."""

    return evento_para_dict(event)


def event_from_dict(data: dict[str, object]) -> SupplyChainEvent | None:
    """Alias de compatibilidade para `evento_de_dict`."""

    return evento_de_dict(data)


def event_to_json(event: SupplyChainEvent) -> str:
    """Alias de compatibilidade para `evento_para_json`."""

    return evento_para_json(event)


def event_from_json(payload: str) -> SupplyChainEvent | None:
    """Alias de compatibilidade para `evento_de_json`."""

    return evento_de_json(payload)


def block_to_dict(block: Block) -> dict[str, object]:
    """Alias de compatibilidade para `bloco_para_dict`."""

    return bloco_para_dict(block)


def block_from_dict(data: dict[str, object]) -> Block | None:
    """Alias de compatibilidade para `bloco_de_dict`."""

    return bloco_de_dict(data)


def block_to_json(block: Block) -> str:
    """Alias de compatibilidade para `bloco_para_json`."""

    return bloco_para_json(block)


def block_from_json(payload: str) -> Block | None:
    """Alias de compatibilidade para `bloco_de_json`."""

    return bloco_de_json(payload)
