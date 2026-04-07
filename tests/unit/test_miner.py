"""Testes unitarios do servico de mineracao."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from src.core.services.miner import Miner


def criar_evento_valido() -> SupplyChainEvent:
    """Retorna um evento valido para os cenarios de mineracao."""

    return SupplyChainEvent(
        event_id="evt-001",
        event_type="CREATE_RAW_MATERIAL",
        product_id="lot-001",
        product_name="Leite Cru",
        actor_id="produtor-01",
        actor_role="PRODUCER",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=["origem-001"],
        metadata={"origin": "Fazenda A", "quantity": 100, "unit": "L"},
    )


def test_criar_bloco_candidato_usa_a_ponta_atual_da_cadeia() -> None:
    """O candidato deve herdar index e previous_hash do ultimo bloco."""

    config = CoreConfig(difficulty=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    events = [criar_evento_valido()]

    block = miner.criar_bloco_candidato(
        blockchain,
        events,
        timestamp="2026-04-01T10:05:00Z",
    )

    assert block.index == 1
    assert block.previous_hash == blockchain.obter_ultimo_bloco().block_hash
    assert block.difficulty == 2
    assert block.miner_id == "node-miner-1"
    assert block.event_count == 1
    assert block.data_hash
    assert block.block_hash


def test_minerar_bloco_encontra_nonce_valido() -> None:
    """O minerador deve retornar um bloco que satisfaz a dificuldade."""

    config = CoreConfig(difficulty=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)

    candidate = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento_valido()],
        timestamp="2026-04-01T10:05:00Z",
    )
    mined = miner.minerar_bloco(candidate)

    assert mined is not None
    assert mined.possui_pow_valido() is True
    assert mined.block_hash.startswith("00")
    assert blockchain.validar_bloco(mined, blockchain.obter_ultimo_bloco()) is True


def test_minerar_bloco_retorna_none_quando_o_limite_nao_basta() -> None:
    """Quando o limite nao basta, o minerador simplesmente devolve `None`."""

    config = CoreConfig(difficulty=5, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    candidate = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento_valido()],
        timestamp="2026-04-01T10:05:00Z",
    )

    assert miner.minerar_bloco(candidate, limite_nonce=1) is None


def test_bloco_nao_minerado_e_rejeitado_quando_dificuldade_exige_pow() -> None:
    """Sem mineracao, o bloco candidato nao deve ser aceito pela cadeia."""

    config = CoreConfig(difficulty=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)

    candidate = miner.criar_bloco_candidato(
        blockchain,
        [criar_evento_valido()],
        timestamp="2026-04-01T10:05:00Z",
    )

    assert blockchain.adicionar_bloco(candidate) is False


def test_mine_block_alias_mantem_compatibilidade() -> None:
    """Os aliases em ingles devem refletir o mesmo comportamento."""

    config = CoreConfig(difficulty=1, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    candidate = miner.create_candidate_block(
        blockchain,
        [criar_evento_valido()],
        timestamp="2026-04-01T10:05:00Z",
    )

    mined = miner.mine_block(candidate)

    assert mined is not None
    assert isinstance(mined, Block)
    assert mined.is_valid_pow() is True


def test_minerar_da_mempool_confirma_bloco_e_remove_eventos_confirmados() -> None:
    """A mineracao via mempool deve consumir os primeiros eventos e anexar o bloco."""

    config = CoreConfig(difficulty=1, max_events_per_block=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    mempool = Mempool()

    mempool.adicionar_evento(criar_evento_valido())
    mempool.adicionar_evento(
        SupplyChainEvent(
            event_id="evt-002",
            event_type="TRANSFER_CUSTODY",
            product_id="lot-002",
            product_name="Leite Cru",
            actor_id="distribuidor-01",
            actor_role="DISTRIBUTOR",
            timestamp="2026-04-01T10:01:00Z",
            input_ids=["lot-001"],
            metadata={"destination": "Centro A"},
        )
    )
    mempool.adicionar_evento(
        SupplyChainEvent(
            event_id="evt-003",
            event_type="RECEIVE_PRODUCT",
            product_id="lot-003",
            product_name="Leite Cru",
            actor_id="varejo-01",
            actor_role="RETAIL",
            timestamp="2026-04-01T10:02:00Z",
            input_ids=["lot-002"],
            metadata={"location": "Loja Central"},
        )
    )

    bloco = miner.minerar_da_mempool(
        blockchain,
        mempool,
        timestamp="2026-04-01T10:05:00Z",
    )

    assert bloco is not None
    assert blockchain.obter_ultimo_bloco() == bloco
    assert [event.event_id for event in bloco.events] == ["evt-001", "evt-002"]
    assert mempool.listar_event_ids() == ["evt-003"]


def test_minerar_da_mempool_retorna_none_quando_nao_ha_eventos() -> None:
    """Sem eventos pendentes, nao ha bloco a minerar."""

    config = CoreConfig(difficulty=1, max_events_per_block=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    mempool = Mempool()

    assert miner.minerar_da_mempool(blockchain, mempool) is None
