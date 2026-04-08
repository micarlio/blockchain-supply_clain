"""Testes unitarios das regras de consenso."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.consensus import Consensus
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


def criar_bloco_filhote(parent: Block, event_id: str, difficulty: int) -> Block:
    """Cria um bloco bruto apontando para o bloco pai informado."""

    block = Block(
        index=parent.index + 1,
        timestamp=f"2026-04-01T10:0{parent.index + 1}:00Z",
        previous_hash=parent.block_hash,
        difficulty=difficulty,
        nonce=0,
        event_count=0,
        data_hash="",
        events=[criar_evento(event_id)],
        block_hash="",
        miner_id="node-test",
    )
    return block


def test_consenso_prefere_cadeia_com_maior_trabalho_acumulado() -> None:
    """A cadeia vencedora deve ser a que soma mais trabalho."""

    consensus = Consensus()
    cadeia_atual = [
        Block(0, "t", "GENESIS", 0, 0, 0, "", [], "hash-0"),
        Block(1, "t1", "hash-0", 1, 0, 0, "", [], "hash-1"),
        Block(2, "t2", "hash-1", 1, 0, 0, "", [], "hash-2"),
    ]
    cadeia_candidata = [
        Block(0, "t", "GENESIS", 0, 0, 0, "", [], "hash-0"),
        Block(1, "t1", "hash-0", 3, 0, 0, "", [], "hash-a"),
    ]

    assert consensus.obter_trabalho_acumulado(cadeia_atual) == 4
    assert consensus.obter_trabalho_acumulado(cadeia_candidata) == 8
    assert consensus.comparar_cadeias(cadeia_atual, cadeia_candidata) == 1
    assert consensus.escolher_cadeia(cadeia_atual, cadeia_candidata) == cadeia_candidata


def test_consenso_mantem_cadeia_atual_em_empate_de_trabalho() -> None:
    """Empate de trabalho nao deve trocar a cadeia ativa."""

    consensus = Consensus()
    cadeia_atual = [
        Block(0, "t", "GENESIS", 0, 0, 0, "", [], "hash-0"),
        Block(1, "t1", "hash-0", 2, 0, 0, "", [], "hash-1"),
    ]
    cadeia_candidata = [
        Block(0, "t", "GENESIS", 0, 0, 0, "", [], "hash-0"),
        Block(1, "t1", "hash-0", 2, 0, 0, "", [], "hash-2"),
    ]

    assert consensus.comparar_cadeias(cadeia_atual, cadeia_candidata) == 0
    assert consensus.escolher_cadeia(cadeia_atual, cadeia_candidata) == cadeia_atual


def test_substituir_cadeia_adota_candidata_melhor() -> None:
    """Uma cadeia valida melhor deve substituir a cadeia ativa."""

    config = CoreConfig(difficulty=1, node_id="node-test")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)

    bloco_ativo = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento("evt-001")],
        timestamp="2026-04-01T10:01:00Z",
    )
    miner.minerar_bloco(bloco_ativo)
    blockchain.adicionar_bloco(bloco_ativo)

    bloco_fork_1 = criar_bloco_filhote(blockchain.chain[0], "evt-010", difficulty=1)
    miner.minerar_bloco(bloco_fork_1)
    cadeia_candidata = [blockchain.chain[0], bloco_fork_1]

    bloco_fork_2 = criar_bloco_filhote(bloco_fork_1, "evt-011", difficulty=1)
    miner.minerar_bloco(bloco_fork_2)
    cadeia_candidata.append(bloco_fork_2)

    assert blockchain.substituir_cadeia(cadeia_candidata) is True
    assert blockchain.obter_ultimo_bloco().block_hash == bloco_fork_2.block_hash
    assert len(blockchain.cadeias_candidatas) == 1
