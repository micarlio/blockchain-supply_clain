"""Testes unitários do serviço de blockchain."""

from src.core.config import CoreConfig
from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain


def criar_materia_prima(
    event_id: str = "evt-mp-001",
    product_id: str = "MP-001",
    timestamp: str = "2026-04-01T10:00:00Z",
) -> SupplyChainEvent:
    """Cria um cadastro simples de matéria-prima."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="CADASTRAR_MATERIA_PRIMA",
        product_id=product_id,
        product_name="Algodão in natura",
        entity_kind="raw_material",
        actor_id="fornecedor-01",
        actor_role="FORNECEDOR",
        timestamp=timestamp,
        input_ids=[],
        metadata={"lote": product_id, "origem": "Fazenda A"},
    )


def criar_produto_simples(
    event_id: str = "evt-ps-001",
    product_id: str = "PS-001",
    input_ids: list[str] | None = None,
    timestamp: str = "2026-04-01T10:05:00Z",
) -> SupplyChainEvent:
    """Cria um produto simples a partir de matérias-primas."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="FABRICAR_PRODUTO_SIMPLES",
        product_id=product_id,
        product_name="Tecido Cru",
        entity_kind="simple_product",
        actor_id="fabricante-01",
        actor_role="FABRICANTE",
        timestamp=timestamp,
        input_ids=input_ids or [],
        metadata={"lote": product_id, "processo": "tecelagem"},
    )


def criar_produto_composto(
    event_id: str = "evt-pc-001",
    product_id: str = "PC-001",
    input_ids: list[str] | None = None,
    timestamp: str = "2026-04-01T10:10:00Z",
) -> SupplyChainEvent:
    """Cria um produto composto a partir de produtos intermediários."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="FABRICAR_PRODUTO_COMPOSTO",
        product_id=product_id,
        product_name="Camisa Tingida",
        entity_kind="composite_product",
        actor_id="montadora-01",
        actor_role="MONTADORA",
        timestamp=timestamp,
        input_ids=input_ids or [],
        metadata={"lote": product_id, "linha": "montagem-final"},
    )


def criar_bloco(
    blockchain: Blockchain,
    events: list[SupplyChainEvent],
    timestamp: str = "2026-04-01T10:05:00Z",
) -> Block:
    """Cria um bloco simples válido para a cadeia informada."""

    previous_block = blockchain.obter_ultimo_bloco()
    block = Block(
        index=previous_block.index + 1,
        timestamp=timestamp,
        previous_hash=previous_block.block_hash,
        difficulty=blockchain.config.difficulty,
        nonce=0,
        event_count=0,
        data_hash="",
        events=events,
        block_hash="",
        miner_id=blockchain.config.node_id,
    )
    block.atualizar_hashes()
    return block


def test_blockchain_inicia_com_genesis_deterministico() -> None:
    blockchain = Blockchain()

    assert len(blockchain.chain) == 1
    assert blockchain.chain[0].index == 0
    assert blockchain.chain[0].previous_hash == "GENESIS"
    assert blockchain.chain[0].difficulty == 0
    assert blockchain.chain[0].possui_pow_valido() is True


def test_duas_instancias_geram_o_mesmo_genesis() -> None:
    blockchain_a = Blockchain(config=CoreConfig(difficulty=0, node_id="node-a"))
    blockchain_b = Blockchain(config=CoreConfig(difficulty=4, node_id="node-b"))

    assert blockchain_a.chain[0].para_dict() == blockchain_b.chain[0].para_dict()


def test_adicionar_bloco_valido_anexa_na_cadeia() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco(blockchain, [criar_materia_prima()])

    assert blockchain.adicionar_bloco(block) is True
    assert len(blockchain.chain) == 2
    assert blockchain.obter_ultimo_bloco() == block


def test_rejeita_bloco_com_previous_hash_incorreto() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco(blockchain, [criar_materia_prima()])
    block.previous_hash = "hash-incorreto"
    block.block_hash = block.calcular_hash_bloco()

    assert blockchain.adicionar_bloco(block) is False
    assert len(blockchain.chain) == 1


def test_rejeita_bloco_com_hash_adulterado() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco(blockchain, [criar_materia_prima()])
    block.block_hash = "hash-falso"

    assert blockchain.adicionar_bloco(block) is False


def test_validar_cadeia_rejeita_genesis_diferente_do_esperado() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    chain = blockchain.copiar_cadeia()
    chain[0].timestamp = "2026-02-01T00:00:00Z"
    chain[0].block_hash = chain[0].calcular_hash_bloco()

    assert blockchain.validar_cadeia(chain) is False


def test_validar_cadeia_rejeita_bloco_adulterado() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco(blockchain, [criar_materia_prima()])
    blockchain.adicionar_bloco(block)

    chain = blockchain.copiar_cadeia()
    chain[1].data_hash = "hash-adulterado"

    assert blockchain.validar_cadeia(chain) is False


def test_rejeita_produto_simples_sem_insumo_confirmado() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco(
        blockchain,
        [criar_produto_simples(event_id="evt-ps-002", input_ids=["evt-mp-001"])],
    )

    assert blockchain.adicionar_bloco(block) is False


def test_rejeita_produto_composto_sem_produto_intermediario() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))

    bloco_materia_prima = criar_bloco(
        blockchain,
        [
            criar_materia_prima(event_id="evt-mp-001", product_id="ALGODAO-001"),
            criar_materia_prima(event_id="evt-mp-002", product_id="CORANTE-001", timestamp="2026-04-01T10:01:00Z"),
        ],
    )
    assert blockchain.adicionar_bloco(bloco_materia_prima) is True

    bloco_composto = criar_bloco(
        blockchain,
        [
            criar_produto_composto(
                event_id="evt-pc-001",
                input_ids=["evt-mp-001", "evt-mp-002"],
            )
        ],
        timestamp="2026-04-01T10:10:00Z",
    )

    assert blockchain.adicionar_bloco(bloco_composto) is False


def test_rejeita_reuso_do_mesmo_input_id_na_cadeia() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    bloco_materia_prima = criar_bloco(
        blockchain,
        [criar_materia_prima(event_id="evt-mp-001")],
    )
    assert blockchain.adicionar_bloco(bloco_materia_prima) is True

    bloco_produto_simples_1 = criar_bloco(
        blockchain,
        [criar_produto_simples(event_id="evt-ps-001", input_ids=["evt-mp-001"])],
        timestamp="2026-04-01T10:08:00Z",
    )
    assert blockchain.adicionar_bloco(bloco_produto_simples_1) is True

    bloco_produto_simples_2 = criar_bloco(
        blockchain,
        [criar_produto_simples(event_id="evt-ps-002", input_ids=["evt-mp-001"])],
        timestamp="2026-04-01T10:10:00Z",
    )

    assert blockchain.adicionar_bloco(bloco_produto_simples_2) is False


def test_validar_cadeia_aceita_fluxo_semantico_completo() -> None:
    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))

    bloco_materia_prima = criar_bloco(
        blockchain,
        [criar_materia_prima(event_id="evt-mp-001")],
    )
    assert blockchain.adicionar_bloco(bloco_materia_prima) is True

    bloco_produto_simples = criar_bloco(
        blockchain,
        [criar_produto_simples(event_id="evt-ps-001", input_ids=["evt-mp-001"])],
        timestamp="2026-04-01T10:08:00Z",
    )
    assert blockchain.adicionar_bloco(bloco_produto_simples) is True

    bloco_produto_composto = criar_bloco(
        blockchain,
        [criar_produto_composto(event_id="evt-pc-001", input_ids=["evt-ps-001"])],
        timestamp="2026-04-01T10:12:00Z",
    )
    assert blockchain.adicionar_bloco(bloco_produto_composto) is True

    assert blockchain.validar_cadeia(blockchain.copiar_cadeia()) is True
