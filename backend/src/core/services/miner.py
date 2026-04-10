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

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


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
            difficulty=blockchain.obter_dificuldade_global_ativa(),
            nonce=0,
            event_count=0,
            data_hash="",
            events=deepcopy(events),
            block_hash="",
            miner_id=self.config.node_id,
        )
        block.atualizar_hashes()
        return block

    def minerar_bloco(
        self, block: Block, limite_nonce: int | None = None
    ) -> Block | None:
        """Testa nonces ate encontrar um hash que respeite a dificuldade."""

        quantidade_tentativas = None if limite_nonce is None else limite_nonce + 1
        bloco_minerado, _ = self.tentar_minerar_bloco(
            block,
            nonce_inicial=0,
            quantidade_tentativas=quantidade_tentativas,
        )
        return bloco_minerado

    def tentar_minerar_bloco(
        self,
        block: Block,
        *,
        nonce_inicial: int = 0,
        quantidade_tentativas: int | None = None,
    ) -> tuple[Block | None, int]:
        """Executa uma janela de tentativas sem mudar a regra global de PoW."""

        if not isinstance(block, Block):
            return None, nonce_inicial

        if block.difficulty < 0:
            return None, nonce_inicial

        if not isinstance(nonce_inicial, int) or nonce_inicial < 0:
            return None, 0

        if quantidade_tentativas is not None and quantidade_tentativas <= 0:
            return None, nonce_inicial

        block.event_count = len(block.events)
        block.data_hash = block.calcular_hash_dados()

        nonce_atual = nonce_inicial
        tentativas_executadas = 0
        while (
            quantidade_tentativas is None
            or tentativas_executadas < quantidade_tentativas
        ):
            block.nonce = nonce_atual
            block.block_hash = block.calcular_hash_bloco()

            if block.possui_pow_valido():
                return block, nonce_atual + 1

            nonce_atual += 1
            tentativas_executadas += 1

        return None, nonce_atual

    def minerar_da_mempool(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
        timestamp: str | None = None,
        limite_nonce: int | None = None,
    ) -> Block | None:
        """Seleciona eventos pendentes, minera e tenta anexar na cadeia."""

        eventos = self._selecionar_eventos_mineraveis(blockchain, mempool)
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

    def _selecionar_eventos_mineraveis(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
    ) -> list[SupplyChainEvent]:
        """Monta um lote mineravel sem travar em evento que chegou fora de ordem."""

        eventos_pendentes = mempool.obter_eventos_pendentes(
            mempool.quantidade_pendente()
        )
        contexto_cadeia = blockchain.validator.construir_contexto_cadeia(
            blockchain.chain
        )
        if contexto_cadeia is None:
            return []

        contexto_eventos, contexto_consumidos = contexto_cadeia
        eventos_selecionados: list[SupplyChainEvent] = []

        for event in eventos_pendentes:
            if len(eventos_selecionados) >= self.config.max_events_per_block:
                break

            contexto_atualizado = blockchain.validator.aplicar_evento_ao_contexto(
                event,
                contexto_eventos,
                contexto_consumidos,
            )
            if contexto_atualizado is not None:
                contexto_eventos, contexto_consumidos = contexto_atualizado
                eventos_selecionados.append(event)

        return eventos_selecionados

    def selecionar_eventos_mineraveis(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
    ) -> list[SupplyChainEvent]:
        """Exposicao publica do lote mineravel usado no ciclo automatico."""

        return self._selecionar_eventos_mineraveis(blockchain, mempool)

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

    def try_mine_block(
        self,
        block: Block,
        *,
        start_nonce: int = 0,
        attempt_count: int | None = None,
    ) -> tuple[Block | None, int]:
        """Alias de compatibilidade para `tentar_minerar_bloco`."""

        return self.tentar_minerar_bloco(
            block,
            nonce_inicial=start_nonce,
            quantidade_tentativas=attempt_count,
        )

    def mine_from_mempool(
        self,
        blockchain: "Blockchain",
        mempool: "Mempool",
        timestamp: str | None = None,
        max_nonce: int | None = None,
    ) -> Block | None:
        """Alias de compatibilidade para `minerar_da_mempool`."""

        return self.minerar_da_mempool(blockchain, mempool, timestamp, max_nonce)
