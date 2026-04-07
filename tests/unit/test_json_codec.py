"""Testes unitarios do codec JSON."""

import pytest

from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import (
    bloco_de_json,
    bloco_para_json,
    evento_de_json,
    evento_para_json,
)


def criar_evento() -> SupplyChainEvent:
    """Retorna um evento valido para os testes de codec."""

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


def criar_bloco() -> Block:
    """Retorna um bloco simples com hashes calculados."""

    bloco = Block(
        index=1,
        timestamp="2026-04-01T10:05:00Z",
        previous_hash="abc123",
        difficulty=1,
        nonce=4,
        event_count=0,
        data_hash="",
        events=[criar_evento()],
        block_hash="",
        miner_id="node-externo",
    )
    bloco.atualizar_hashes()
    return bloco


def test_evento_para_json_e_de_json_preservam_payload() -> None:
    """O round-trip do evento em JSON deve manter o mesmo conteudo."""

    event = criar_evento()

    payload = evento_para_json(event)
    reconstruido = evento_de_json(payload)

    assert reconstruido == event


def test_bloco_para_json_e_de_json_preservam_payload() -> None:
    """O round-trip do bloco em JSON deve manter o mesmo conteudo."""

    block = criar_bloco()

    payload = bloco_para_json(block)
    reconstruido = bloco_de_json(payload)

    assert reconstruido.para_dict() == block.para_dict()


def test_bloco_de_json_rejeita_payload_invalido() -> None:
    """JSON invalido deve falhar explicitamente."""

    with pytest.raises(ValueError):
        bloco_de_json("{invalido")


def test_evento_de_json_retorna_none_quando_payload_nao_tem_formato_de_evento() -> None:
    """Quando o JSON ate abre, mas nao forma um evento valido, o codec devolve `None`."""

    assert evento_de_json('{"event_id":"evt-001"}') is None
