"""Estrutura simples de no local para as demonstracoes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import bloco_para_dict
from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from src.core.services.miner import Miner


@dataclass(slots=True)
class LocalNode:
    """Junta os componentes principais de um no local."""

    config: CoreConfig
    blockchain: Blockchain | None = field(default=None, init=False)
    mempool: Mempool | None = field(default=None, init=False)
    miner: Miner | None = field(default=None, init=False)

    def iniciar(self) -> None:
        """Cria os objetos principais do no."""

        self.blockchain = Blockchain(config=self.config)
        self.mempool = Mempool()
        self.miner = Miner(config=self.config)

    def pronto(self) -> bool:
        """Ajuda a saber se o no ja foi montado para a demo."""

        return (
            self.blockchain is not None
            and self.mempool is not None
            and self.miner is not None
        )

    def adicionar_evento(self, event: SupplyChainEvent) -> bool:
        """Envia um evento para a mempool local."""

        if not self.pronto():
            return False

        return self.mempool.adicionar_evento(event)

    def minerar_pendentes(
        self,
        timestamp: str | None = None,
        limite_nonce: int | None = None,
    ) -> Block | None:
        """Mina o proximo bloco a partir da mempool local."""

        if not self.pronto():
            return None

        return self.miner.minerar_da_mempool(
            self.blockchain,
            self.mempool,
            timestamp=timestamp,
            limite_nonce=limite_nonce,
        )

    def receber_bloco(self, block: Block) -> str:
        """Recebe um bloco de outro no como se viesse da rede."""

        if not self.pronto():
            return "node_nao_iniciado"

        return self.blockchain.processar_bloco_recebido(bloco_para_dict(block))

    def resumo(self) -> dict[str, Any]:
        """Gera um resumo curto do estado do no para a apresentacao."""

        if not self.pronto():
            return {
                "node_id": self.config.node_id,
                "pronto": False,
            }

        ultimo_bloco = self.blockchain.obter_ultimo_bloco()
        return {
            "node_id": self.config.node_id,
            "pronto": True,
            "altura_cadeia": len(self.blockchain.chain),
            "hash_ponta": ultimo_bloco.block_hash[:12],
            "eventos_pendentes": self.mempool.listar_event_ids(),
            "forks_guardados": len(self.blockchain.cadeias_candidatas),
        }

    def start(self) -> None:
        """Alias de compatibilidade para `iniciar`."""

        self.iniciar()
