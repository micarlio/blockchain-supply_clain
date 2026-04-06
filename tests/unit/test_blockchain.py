"""Testes unitarios do servico de blockchain."""

from core.config import CoreConfig
from core.models.block import Block
from core.models.event import SupplyChainEvent
from core.services.blockchain import Blockchain


def criar_evento_valido() -> SupplyChainEvent:
    """Retorna um evento valido para compor blocos de teste."""

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


def criar_bloco_valido(blockchain: Blockchain, timestamp: str = "2026-04-01T10:05:00Z") -> Block:
    """Cria um bloco simples valido para a cadeia informada."""

    previous_block = blockchain.obter_ultimo_bloco()
    block = Block(
        index=previous_block.index + 1,
        timestamp=timestamp,
        previous_hash=previous_block.block_hash,
        difficulty=blockchain.config.difficulty,
        nonce=0,
        event_count=0,
        data_hash="",
        events=[criar_evento_valido()],
        block_hash="",
        miner_id=blockchain.config.node_id,
    )
    block.atualizar_hashes()
    return block


def test_blockchain_inicia_com_genesis_deterministico() -> None:
    """A cadeia deve nascer com um único bloco gênesis fixo."""

    blockchain = Blockchain()

    assert len(blockchain.chain) == 1
    assert blockchain.chain[0].index == 0
    assert blockchain.chain[0].previous_hash == "GENESIS"
    assert blockchain.chain[0].difficulty == 0
    assert blockchain.chain[0].possui_pow_valido() is True


def test_duas_instancias_geram_o_mesmo_genesis() -> None:
    """O gênesis precisa ser identico em instancias diferentes."""

    blockchain_a = Blockchain(config=CoreConfig(difficulty=0, node_id="node-a"))
    blockchain_b = Blockchain(config=CoreConfig(difficulty=4, node_id="node-b"))

    assert blockchain_a.chain[0].para_dict() == blockchain_b.chain[0].para_dict()


def test_adicionar_bloco_valido_anexa_na_cadeia() -> None:
    """Um bloco valido deve ser anexado ao final da cadeia."""

    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco_valido(blockchain)

    assert blockchain.adicionar_bloco(block) is True
    assert len(blockchain.chain) == 2
    assert blockchain.obter_ultimo_bloco() == block


def test_rejeita_bloco_com_previous_hash_incorreto() -> None:
    """Um bloco que nao aponta para a ponta atual deve ser rejeitado."""

    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco_valido(blockchain)
    block.previous_hash = "hash-incorreto"
    block.block_hash = block.calcular_hash_bloco()

    assert blockchain.adicionar_bloco(block) is False
    assert len(blockchain.chain) == 1


def test_rejeita_bloco_com_hash_adulterado() -> None:
    """A admissao deve falhar quando o hash do bloco foi alterado manualmente."""

    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco_valido(blockchain)
    block.block_hash = "hash-falso"

    assert blockchain.adicionar_bloco(block) is False


def test_validar_cadeia_rejeita_genesis_diferente_do_esperado() -> None:
    """A cadeia so e valida quando o primeiro bloco bate com o gênesis local."""

    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    chain = blockchain.copiar_cadeia()
    chain[0].timestamp = "2026-02-01T00:00:00Z"
    chain[0].block_hash = chain[0].calcular_hash_bloco()

    assert blockchain.validar_cadeia(chain) is False


def test_validar_cadeia_rejeita_bloco_adulterado() -> None:
    """Alteracoes em blocos posteriores devem invalidar a cadeia."""

    blockchain = Blockchain(config=CoreConfig(difficulty=0, node_id="node-1"))
    block = criar_bloco_valido(blockchain)
    blockchain.adicionar_bloco(block)

    chain = blockchain.copiar_cadeia()
    chain[1].data_hash = "hash-adulterado"

    assert blockchain.validar_cadeia(chain) is False
