"""Fluxo de mineracao do core da blockchain."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent

if TYPE_CHECKING:
    from src.core.services.blockchain import Blockchain
    from src.core.services.mempool import Mempool


def _timestamp_utc_atual() -> str:
    """Retorna o timestamp atual em UTC no formato usado pelo projeto."""

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class Miner:
    """Responsavel por montar candidatos e encontrar o nonce valido."""

    def __init__(self, config: CoreConfig | None = None) -> None:
        """Guarda a configuracao usada na mineracao."""

        self.config = config or CoreConfig()

    def criar_bloco_candidato(
        self,
        blockchain: "Blockchain",
        events: list[SupplyChainEvent],
        timestamp: str | None = None,
    ) -> Block | None:
        """Monta um bloco candidato a partir da ponta atual da cadeia."""

        if not isinstance(events, list) or not events:
            return None

        if not all(isinstance(event, SupplyChainEvent) for event in events):
            return None

        previous_block = blockchain.obter_ultimo_bloco()
        block = Block(
            index=previous_block.index + 1,
            timestamp=timestamp or _timestamp_utc_atual(),
            previous_hash=previous_block.block_hash,
            difficulty=self.config.difficulty,
            nonce=0,
            event_count=0,
            data_hash="",
            events=deepcopy(events),
            block_hash="",
            miner_id=self.config.node_id,
        )
        block.atualizar_hashes()
        return block

    def minerar_bloco(self, block: Block, limite_nonce: int | None = None) -> Block | None:
        """Testa nonces ate encontrar um hash que respeite a dificuldade."""

        if not isinstance(block, Block):
            return None

        if block.difficulty < 0:
            return None

        nonce_atual = 0
        while limite_nonce is None or nonce_atual <= limite_nonce:
            block.nonce = nonce_atual
            block.event_count = len(block.events)
            block.data_hash = block.calcular_hash_dados()
            block.block_hash = block.calcular_hash_bloco()

            if block.possui_pow_valido():
                return block

            nonce_atual += 1

        return None

    def minerar_da_mempool(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
        timestamp: str | None = None,
        limite_nonce: int | None = None,
    ) -> Block | None:
        """Seleciona eventos pendentes, minera e tenta anexar na cadeia."""

        eventos = mempool.obter_eventos_pendentes(self.config.max_events_per_block)
        if not eventos:
            return None

        bloco_candidato = self.criar_bloco_candidato(blockchain, eventos, timestamp)
        if bloco_candidato is None:
            return None

        bloco_minerado = self.minerar_bloco(bloco_candidato, limite_nonce)
        if bloco_minerado is None:
            return None

        if not blockchain.adicionar_bloco(bloco_minerado):
            return None

        mempool.remover_eventos([event.event_id for event in eventos])
        return bloco_minerado

    def create_candidate_block(
        self,
        blockchain: "Blockchain",
        events: list[SupplyChainEvent],
        timestamp: str | None = None,
    ) -> Block | None:
        """Alias de compatibilidade para `criar_bloco_candidato`."""

        return self.criar_bloco_candidato(blockchain, events, timestamp)

    def mine_block(self, block: Block, max_nonce: int | None = None) -> Block | None:
        """Alias de compatibilidade para `minerar_bloco`."""

        return self.minerar_bloco(block, max_nonce)

    def mine_from_mempool(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
        timestamp: str | None = None,
        max_nonce: int | None = None,
    ) -> Block | None:
        """Alias de compatibilidade para `minerar_da_mempool`."""

        return self.minerar_da_mempool(blockchain, mempool, timestamp, max_nonce)
