"""Teste de integracao para deteccao de fork e resolucao de conflito."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.miner import Miner


def criar_evento(event_id: str) -> SupplyChainEvent:
    """Retorna um evento valido com identificador configuravel."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="CADASTRAR_MATERIA_PRIMA",
        product_id=f"lot-{event_id}",
        product_name="Leite Cru",
        entity_kind="raw_material",
        actor_id="fornecedor-01",
        actor_role="FORNECEDOR",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=[],
        metadata={"origin": "Fazenda A"},
    )


def criar_bloco_a_partir_de(parent: Block, event_id: str, miner: Miner) -> Block:
    """Cria e minera um bloco apontando para um bloco pai arbitrario."""

    block = Block(
        index=parent.index + 1,
        timestamp=f"2026-04-01T10:0{parent.index + 1}:00Z",
        previous_hash=parent.block_hash,
        difficulty=miner.config.difficulty,
        nonce=0,
        event_count=0,
        data_hash="",
        events=[criar_evento(event_id)],
        block_hash="",
        miner_id=miner.config.node_id,
    )
    return miner.minerar_bloco(block)


def test_blockchain_detecta_fork_e_adota_cadeia_melhor() -> None:
    """A cadeia ativa deve trocar quando a ramificacao alternativa ficar maior."""

    config = CoreConfig(difficulty=1, node_id="node-main")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)

    bloco_a1 = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento("evt-a1")],
        timestamp="2026-04-01T10:01:00Z",
    )
    miner.minerar_bloco(bloco_a1)
    assert blockchain.adicionar_bloco(bloco_a1) is True
    assert len(blockchain.chain) == 2

    bloco_b1 = criar_bloco_a_partir_de(blockchain.chain[0], "evt-b1", miner)
    assert blockchain.adicionar_bloco(bloco_b1) is True
    assert blockchain.obter_ultimo_bloco().block_hash == bloco_a1.block_hash
    assert len(blockchain.cadeias_candidatas) == 1
    assert blockchain.cadeias_candidatas[0][-1].block_hash == bloco_b1.block_hash

    bloco_b2 = criar_bloco_a_partir_de(bloco_b1, "evt-b2", miner)
    assert blockchain.adicionar_bloco(bloco_b2) is True

    assert blockchain.obter_ultimo_bloco().block_hash == bloco_b2.block_hash
    assert [block.index for block in blockchain.chain] == [0, 1, 2]
    assert len(blockchain.cadeias_candidatas) == 1
    assert blockchain.cadeias_candidatas[0][-1].block_hash == bloco_a1.block_hash
