"""Testes unitarios do servico de mineracao."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from src.core.services.miner import Miner


def criar_materia_prima(event_id: str = "evt-001") -> SupplyChainEvent:
    """Retorna um cadastro válido de matéria-prima para os cenários de mineração."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="CADASTRAR_MATERIA_PRIMA",
        product_id=f"MP-{event_id}",
        product_name="Algodão in natura",
        entity_kind="raw_material",
        actor_id="fornecedor-01",
        actor_role="FORNECEDOR",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=[],
        metadata={"origin": "Fazenda A", "quantity": 100, "unit": "kg"},
    )


def criar_produto_simples(
    event_id: str,
    input_ids: list[str],
    timestamp: str = "2026-04-01T10:01:00Z",
) -> SupplyChainEvent:
    """Cria um produto simples a partir de matérias-primas anteriores."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="FABRICAR_PRODUTO_SIMPLES",
        product_id="TECIDO-001",
        product_name="Tecido Cru",
        entity_kind="simple_product",
        actor_id="fabricante-01",
        actor_role="FABRICANTE",
        timestamp=timestamp,
        input_ids=input_ids,
        metadata={"processo": "tecelagem"},
    )


def test_criar_bloco_candidato_usa_a_ponta_atual_da_cadeia() -> None:
    """O candidato deve herdar index e previous_hash do ultimo bloco."""

    config = CoreConfig(difficulty=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    events = [criar_materia_prima()]

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
        [criar_materia_prima()],
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
        [criar_materia_prima()],
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
        [criar_materia_prima()],
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
        [criar_materia_prima()],
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

    mempool.adicionar_evento(criar_materia_prima("evt-001"))
    mempool.adicionar_evento(
        SupplyChainEvent(
            event_id="evt-002",
            event_type="CADASTRAR_MATERIA_PRIMA",
            product_id="MP-evt-002",
            product_name="Corante Natural",
            entity_kind="raw_material",
            actor_id="fornecedor-02",
            actor_role="FORNECEDOR",
            timestamp="2026-04-01T10:01:00Z",
            input_ids=[],
            metadata={"origin": "Fazenda B"},
        )
    )
    mempool.adicionar_evento(
        SupplyChainEvent(
            event_id="evt-003",
            event_type="CADASTRAR_MATERIA_PRIMA",
            product_id="MP-evt-003",
            product_name="Linha Orgânica",
            entity_kind="raw_material",
            actor_id="fornecedor-03",
            actor_role="FORNECEDOR",
            timestamp="2026-04-01T10:02:00Z",
            input_ids=[],
            metadata={"origin": "Fazenda C"},
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


def test_minerar_da_mempool_pula_evento_fora_de_ordem_sem_travar_fluxo() -> None:
    """Se um evento chegou cedo demais, o minerador tenta o proximo que ja cabe."""

    config = CoreConfig(difficulty=1, max_events_per_block=2, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    mempool = Mempool()

    mempool.adicionar_evento(criar_produto_simples("evt-002", ["evt-001"]))
    mempool.adicionar_evento(criar_materia_prima())

    bloco = miner.minerar_da_mempool(
        blockchain,
        mempool,
        timestamp="2026-04-01T10:05:00Z",
    )

    assert bloco is not None
    assert [event.event_id for event in bloco.events] == ["evt-001"]
    assert mempool.listar_event_ids() == ["evt-002"]


def test_minerar_da_mempool_aproveita_dependencia_que_fica_valida_no_mesmo_bloco() -> (
    None
):
    """Um evento pode entrar depois que sua dependencia foi aceita no mesmo lote."""

    config = CoreConfig(difficulty=1, max_events_per_block=3, node_id="node-miner-1")
    blockchain = Blockchain(config=config)
    miner = Miner(config=config)
    mempool = Mempool()

    mempool.adicionar_evento(criar_materia_prima("evt-001"))
    mempool.adicionar_evento(criar_produto_simples("evt-002", ["evt-001"]))

    bloco = miner.minerar_da_mempool(
        blockchain,
        mempool,
        timestamp="2026-04-01T10:05:00Z",
    )

    assert bloco is not None
    assert [event.event_id for event in bloco.events] == ["evt-001", "evt-002"]
    assert mempool.quantidade_pendente() == 0
