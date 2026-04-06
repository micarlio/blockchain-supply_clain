"""Testes unitarios do modelo de bloco."""

from core.models.block import Block
from core.models.event import SupplyChainEvent
from core.services.hasher import calcular_hash_bloco, calcular_hash_dados


def criar_evento_base() -> SupplyChainEvent:
    """Retorna um evento simples para compor blocos."""

    return SupplyChainEvent(
        event_id="evt-001",
        event_type="CREATE_RAW_MATERIAL",
        product_id="lot-001",
        product_name="Leite Cru",
        actor_id="produtor-01",
        actor_role="PRODUCER",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=["origem-001"],
        metadata={"origin": "Fazenda A"},
    )


def criar_bloco_base() -> Block:
    """Retorna um bloco simples ainda sem hashes atualizados."""

    return Block(
        index=1,
        timestamp="2026-04-01T10:05:00Z",
        previous_hash="0000abc123",
        difficulty=0,
        nonce=0,
        event_count=0,
        data_hash="",
        events=[criar_evento_base()],
        block_hash="",
        miner_id="node-1",
    )


def test_atualizar_hashes_recalcula_campos_derivados() -> None:
    """Ao atualizar hashes, o bloco deve refletir o estado atual do body."""

    block = criar_bloco_base()

    block.atualizar_hashes()

    header_esperado = {
        "index": 1,
        "timestamp": "2026-04-01T10:05:00Z",
        "previous_hash": "0000abc123",
        "difficulty": 0,
        "nonce": 0,
        "event_count": 1,
        "data_hash": calcular_hash_dados([criar_evento_base().para_dict()]),
    }

    assert block.event_count == 1
    assert block.data_hash == header_esperado["data_hash"]
    assert block.block_hash == calcular_hash_bloco(header_esperado)


def test_miner_id_nao_participa_do_hash_do_bloco() -> None:
    """Alterar o emissor nao deve mudar o hash quando o resto e identico."""

    block_a = criar_bloco_base()
    block_b = criar_bloco_base()
    block_b.miner_id = "node-2"

    block_a.atualizar_hashes()
    block_b.atualizar_hashes()

    assert block_a.data_hash == block_b.data_hash
    assert block_a.block_hash == block_b.block_hash


def test_possui_pow_valido_respeita_dificuldade_atual() -> None:
    """A verificacao de PoW deve usar o hash atual do bloco."""

    block = criar_bloco_base()
    block.block_hash = "00abc123"
    block.difficulty = 2

    assert block.possui_pow_valido() is True

    block.difficulty = 3
    assert block.possui_pow_valido() is False


def test_bloco_pode_ser_reconstruido_a_partir_de_dicionario() -> None:
    """O round-trip do bloco deve preservar o payload serializado."""

    block = criar_bloco_base()
    block.atualizar_hashes()

    payload = block.para_dict()
    reconstruido = Block.de_dict(payload)

    assert reconstruido.para_dict() == payload
    assert reconstruido.to_dict() == payload
