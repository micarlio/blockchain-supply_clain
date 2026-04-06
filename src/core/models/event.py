"""Modelo de evento da cadeia de suprimentos."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any


def _texto_valido(value: object) -> bool:
    """Retorna `True` quando o valor e um texto preenchido."""

    return isinstance(value, str) and bool(value.strip())


def _lista_de_textos_valida(values: object) -> bool:
    """Garante que `input_ids` continue simples e previsivel."""

    if not isinstance(values, list):
        return False

    for item in values:
        if not _texto_valido(item):
            return False

    return True


def _valor_serializavel(value: object) -> bool:
    """Aqui a ideia e aceitar so o que conseguimos mandar em JSON sem surpresa."""

    if value is None or isinstance(value, (str, int, float, bool)):
        return True

    if isinstance(value, list):
        return all(_valor_serializavel(item) for item in value)

    if isinstance(value, dict):
        return all(isinstance(key, str) and _valor_serializavel(item) for key, item in value.items())

    return False


@dataclass(slots=True)
class SupplyChainEvent:
    """Representa o evento minimo trafegado pelo core da blockchain."""

    event_id: str
    event_type: str
    product_id: str
    product_name: str
    actor_id: str
    actor_role: str
    timestamp: str
    input_ids: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def validar_basico(self) -> bool:
        """Valida so a estrutura minima do evento."""

        campos_texto = (
            self.event_id,
            self.event_type,
            self.product_id,
            self.product_name,
            self.actor_id,
            self.actor_role,
            self.timestamp,
        )

        if not all(_texto_valido(value) for value in campos_texto):
            return False

        if not _lista_de_textos_valida(self.input_ids):
            return False

        if not isinstance(self.metadata, dict):
            return False

        return _valor_serializavel(self.metadata)

    def para_dict(self) -> dict[str, Any]:
        """Transforma o evento em um dicionario simples para hash e transporte."""

        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "product_id": self.product_id,
            "product_name": self.product_name,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "timestamp": self.timestamp,
            "input_ids": deepcopy(self.input_ids),
            "metadata": deepcopy(self.metadata),
        }

    @classmethod
    def de_dict(cls, data: dict[str, Any]) -> "SupplyChainEvent | None":
        """Monta o evento e deixa a validacao decidir se ele e aceitavel."""

        if not isinstance(data, dict):
            return None

        input_ids = data.get("input_ids", [])
        metadata = data.get("metadata", {})

        if not isinstance(input_ids, list) or not isinstance(metadata, dict):
            return None

        event = cls(
            event_id=data.get("event_id", ""),
            event_type=data.get("event_type", ""),
            product_id=data.get("product_id", ""),
            product_name=data.get("product_name", ""),
            actor_id=data.get("actor_id", ""),
            actor_role=data.get("actor_role", ""),
            timestamp=data.get("timestamp", ""),
            input_ids=deepcopy(input_ids),
            metadata=deepcopy(metadata),
        )

        if not event.validar_basico():
            return None

        return event

    def validate_basic(self) -> bool:
        """Alias de compatibilidade para `validar_basico`."""

        return self.validar_basico()

    def to_dict(self) -> dict[str, Any]:
        """Alias de compatibilidade para `para_dict`."""

        return self.para_dict()

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SupplyChainEvent | None":
        """Alias de compatibilidade para `de_dict`."""

        return cls.de_dict(data)
