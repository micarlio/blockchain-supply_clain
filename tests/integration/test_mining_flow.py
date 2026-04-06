"""Teste de integracao do fluxo local de mineracao com `LocalNode`."""

from core.config import CoreConfig
from core.demo.local_node import LocalNode
from core.models.event import SupplyChainEvent


def criar_evento(event_id: str) -> SupplyChainEvent:
    """Retorna um evento simples para o fluxo de mineracao local."""

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


def test_local_node_mina_eventos_pendentes_e_limpa_mempool() -> None:
    """O no local deve conseguir minerar a partir da propria mempool."""

    node = LocalNode(config=CoreConfig(difficulty=1, node_id="node-demo", max_events_per_block=2))
    node.iniciar()

    assert node.pronto() is True
    assert node.adicionar_evento(criar_evento("evt-001")) is True
    assert node.adicionar_evento(criar_evento("evt-002")) is True

    bloco = node.minerar_pendentes(timestamp="2026-04-01T10:05:00Z")

    assert bloco is not None
    assert [event.event_id for event in bloco.events] == ["evt-001", "evt-002"]
    assert node.blockchain.obter_ultimo_bloco().block_hash == bloco.block_hash
    assert node.mempool.listar_event_ids() == []
