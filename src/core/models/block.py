"""Modelo de bloco utilizado pelo core da blockchain."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from src.core.models.event import SupplyChainEvent
from src.core.services.hasher import (
    calcular_hash_bloco as calcular_hash_bloco_cabecalho,
    calcular_hash_dados as calcular_hash_dados_eventos,
)


def _inteiro_nao_negativo(value: object) -> bool:
    """Nos campos numericos do bloco, basta garantir inteiro simples e >= 0."""

    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _texto_simples(value: object) -> bool:
    """Para o bloco, basta confirmar que o campo veio como texto."""

    return isinstance(value, str) # instance(value, str) é True se value for uma string


@dataclass(slots=True)
class Block:
    """Representa um bloco mineravel e serializavel."""

    index: int # indice do bloco
    timestamp: str # timestamp do bloco
    previous_hash: str # hash do bloco anterior
    difficulty: int # dificuldade do bloco
    nonce: int # nonce do bloco
    event_count: int # quantidade de eventos no bloco
    data_hash: str # hash dos eventos
    events: list[SupplyChainEvent] = field(default_factory=list) # lista de eventos
    block_hash: str = "" # hash do bloco
    miner_id: str | None = None # id do minerador

    def obter_cabecalho_para_hash(self) -> dict[str, Any]:
        """So esses campos entram no hash do bloco."""

        return {
            "index": self.index,
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash,
            "difficulty": self.difficulty,
            "nonce": self.nonce,
            "event_count": self.event_count,
            "data_hash": self.data_hash,
        }

    def calcular_hash_dados(self) -> str:
        """Calcula o hash da lista de eventos."""

        eventos_serializados = [event.para_dict() for event in self.events]
        return calcular_hash_dados_eventos(eventos_serializados)

    def calcular_hash_bloco(self) -> str:
        """Calcula o hash do cabecalho do bloco."""

        return calcular_hash_bloco_cabecalho(self.obter_cabecalho_para_hash())

    def atualizar_hashes(self) -> None:
        """Sempre recalcula primeiro o body e depois o hash final do bloco."""

        self.event_count = len(self.events)
        self.data_hash = self.calcular_hash_dados()
        self.block_hash = self.calcular_hash_bloco()

    def possui_pow_valido(self) -> bool:
        """Confere se o hash encontrado respeita a dificuldade atual."""

        if not _inteiro_nao_negativo(self.difficulty):
            return False

        if not self.block_hash:
            return False

        return self.block_hash.startswith("0" * self.difficulty)

    def para_dict(self) -> dict[str, object]:
        """Transforma o bloco em um dicionario simples para transporte."""

        payload: dict[str, object] = {
            "index": self.index,
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash,
            "difficulty": self.difficulty,
            "nonce": self.nonce,
            "event_count": self.event_count,
            "data_hash": self.data_hash,
            "events": [event.para_dict() for event in self.events],
            "block_hash": self.block_hash,
        }

        if self.miner_id is not None:
            payload["miner_id"] = self.miner_id

        return payload

    @classmethod
    def de_dict(cls, data: dict[str, object]) -> "Block | None":
        """Monta o bloco a partir do payload e deixa o validador cuidar do resto."""

        if not isinstance(data, dict):
            return None

        events_raw = data.get("events", [])
        if not isinstance(events_raw, list):
            return None

        events: list[SupplyChainEvent] = []
        for item in events_raw:
            event = item if isinstance(item, SupplyChainEvent) else SupplyChainEvent.de_dict(item)
            if event is None:
                return None
            events.append(event)

        miner_id_raw = data.get("miner_id")
        if miner_id_raw is not None and not isinstance(miner_id_raw, str):
            return None

        campos_numericos = (
            data.get("index"),
            data.get("difficulty"),
            data.get("nonce"),
            data.get("event_count"),
        )
        if not all(_inteiro_nao_negativo(value) for value in campos_numericos):
            return None

        campos_texto = (
            data.get("timestamp"),
            data.get("previous_hash"),
            data.get("data_hash"),
            data.get("block_hash"),
        )
        if not all(_texto_simples(value) for value in campos_texto):
            return None

        return cls(
            index=data.get("index", 0),
            timestamp=data.get("timestamp", ""),
            previous_hash=data.get("previous_hash", ""),
            difficulty=data.get("difficulty", 0),
            nonce=data.get("nonce", 0),
            event_count=data.get("event_count", 0),
            data_hash=data.get("data_hash", ""),
            events=events,
            block_hash=data.get("block_hash", ""),
            miner_id=miner_id_raw,
        )

    def compute_data_hash(self) -> str:
        """Alias de compatibilidade para `calcular_hash_dados`."""

        return self.calcular_hash_dados()

    def compute_block_hash(self) -> str:
        """Alias de compatibilidade para `calcular_hash_bloco`."""

        return self.calcular_hash_bloco()

    def update_hashes(self) -> None:
        """Alias de compatibilidade para `atualizar_hashes`."""

        self.atualizar_hashes()

    def is_valid_pow(self) -> bool:
        """Alias de compatibilidade para `possui_pow_valido`."""

        return self.possui_pow_valido()

    def to_dict(self) -> dict[str, object]:
        """Alias de compatibilidade para `para_dict`."""

        return self.para_dict()

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "Block | None":
        """Alias de compatibilidade para `de_dict`."""

        return cls.de_dict(data)
