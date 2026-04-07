"""Teste de integracao para recepcao de bloco externo."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import bloco_para_dict
from src.core.services.blockchain import (
    STATUS_BLOCO_ADICIONADO,
    STATUS_BLOCO_FORK,
    STATUS_BLOCO_IGNORADO_PROPRIO_NO,
    STATUS_PAYLOAD_INVALIDO,
    STATUS_CADEIA_REORGANIZADA,
    Blockchain,
)
from src.core.services.miner import Miner


def criar_evento(event_id: str) -> SupplyChainEvent:
    """Retorna um evento valido com identificador configuravel."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="CREATE_RAW_MATERIAL",
        product_id=f"lot-{event_id}",
        product_name="Leite Cru",
        actor_id="produtor-01",
        actor_role="PRODUCER",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=["origem-001"],
        metadata={"origin": "Fazenda A"},
    )


def criar_bloco_a_partir_de(parent: Block, event_id: str, miner: Miner, miner_id: str) -> Block:
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
        miner_id=miner_id,
    )
    return miner.minerar_bloco(block)


def test_processar_bloco_recebido_anexa_bloco_valido_na_cadeia_ativa() -> None:
    """Um bloco externo valido na ponta atual deve ser anexado."""

    config = CoreConfig(difficulty=1, node_id="node-local")
    blockchain = Blockchain(config=config)
    miner = Miner(config=CoreConfig(difficulty=1, node_id="node-remoto"))

    block = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento("evt-001")],
        timestamp="2026-04-01T10:01:00Z",
    )
    miner.minerar_bloco(block)

    status = blockchain.processar_bloco_recebido(bloco_para_dict(block))

    assert status == STATUS_BLOCO_ADICIONADO
    assert blockchain.obter_ultimo_bloco().block_hash == block.block_hash


def test_processar_bloco_recebido_ignora_bloco_do_proprio_no() -> None:
    """Bloco recebido do proprio emissor local deve ser ignorado."""

    config = CoreConfig(difficulty=1, node_id="node-local")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)

    block = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento("evt-001")],
        timestamp="2026-04-01T10:01:00Z",
    )
    miner.minerar_bloco(block)

    status = blockchain.processar_bloco_recebido(bloco_para_dict(block))

    assert status == STATUS_BLOCO_IGNORADO_PROPRIO_NO
    assert len(blockchain.chain) == 1


def test_processar_bloco_recebido_detecta_fork_e_reorganiza_quando_preciso() -> None:
    """Blocos externos devem poder criar fork e vencer depois."""

    config = CoreConfig(difficulty=1, node_id="node-local")
    blockchain = Blockchain(config=config)
    miner_local = Miner(config=CoreConfig(difficulty=1, node_id="node-local"))
    miner_remoto = Miner(config=CoreConfig(difficulty=1, node_id="node-remoto"))

    bloco_local = miner_local.criar_bloco_candidato(
        blockchain,
        [criar_evento("evt-local-1")],
        timestamp="2026-04-01T10:01:00Z",
    )
    miner_local.minerar_bloco(bloco_local)
    assert blockchain.adicionar_bloco(bloco_local) is True

    bloco_fork_1 = criar_bloco_a_partir_de(blockchain.chain[0], "evt-remoto-1", miner_remoto, "node-remoto")
    status_fork = blockchain.processar_bloco_recebido(bloco_para_dict(bloco_fork_1))
    assert status_fork == STATUS_BLOCO_FORK

    bloco_fork_2 = criar_bloco_a_partir_de(bloco_fork_1, "evt-remoto-2", miner_remoto, "node-remoto")
    status_reorg = blockchain.processar_bloco_recebido(bloco_para_dict(bloco_fork_2))
    assert status_reorg == STATUS_CADEIA_REORGANIZADA
    assert blockchain.obter_ultimo_bloco().block_hash == bloco_fork_2.block_hash


def test_processar_bloco_recebido_rejeita_payload_invalido() -> None:
    """Payloads inconsistentes devem ser rejeitados sem alterar estado."""

    config = CoreConfig(difficulty=1, node_id="node-local")
    blockchain = Blockchain(config=config)

    status = blockchain.processar_bloco_recebido({"nao": "e um bloco valido"})

    assert status == STATUS_PAYLOAD_INVALIDO
    assert len(blockchain.chain) == 1
