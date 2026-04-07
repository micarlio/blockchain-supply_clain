"""Testes unitarios da mempool."""

from src.core.models.event import SupplyChainEvent
from src.core.services.mempool import Mempool


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


def test_adicionar_evento_valido_insere_na_mempool() -> None:
    """Eventos validos devem entrar na fila pendente."""

    mempool = Mempool()
    event = criar_evento("evt-001")

    assert mempool.adicionar_evento(event) is True
    assert mempool.contem_evento("evt-001") is True
    assert len(mempool) == 1


def test_mempool_rejeita_evento_duplicado() -> None:
    """Dois eventos com o mesmo `event_id` nao podem coexistir."""

    mempool = Mempool()
    event = criar_evento("evt-001")

    assert mempool.adicionar_evento(event) is True
    assert mempool.adicionar_evento(event) is False
    assert len(mempool) == 1


def test_obter_eventos_pendentes_respeita_fifo_e_limite() -> None:
    """A selecao deve manter ordem de chegada e obedecer o limite."""

    mempool = Mempool()
    mempool.adicionar_evento(criar_evento("evt-001"))
    mempool.adicionar_evento(criar_evento("evt-002"))
    mempool.adicionar_evento(criar_evento("evt-003"))

    selecionados = mempool.obter_eventos_pendentes(2)

    assert [event.event_id for event in selecionados] == ["evt-001", "evt-002"]


def test_remover_eventos_retira_apenas_os_confirmados() -> None:
    """A remocao deve atingir apenas os ids informados."""

    mempool = Mempool()
    mempool.adicionar_evento(criar_evento("evt-001"))
    mempool.adicionar_evento(criar_evento("evt-002"))
    mempool.adicionar_evento(criar_evento("evt-003"))

    mempool.remover_eventos(["evt-002"])

    assert mempool.listar_event_ids() == ["evt-001", "evt-003"]


def test_reinserir_eventos_coloca_itens_ao_final_sem_duplicar() -> None:
    """Eventos reinseridos devem voltar ao fim da fila se ainda nao existirem."""

    mempool = Mempool()
    mempool.adicionar_evento(criar_evento("evt-001"))
    mempool.adicionar_evento(criar_evento("evt-002"))
    mempool.remover_eventos(["evt-001"])

    mempool.reinserir_eventos([criar_evento("evt-003"), criar_evento("evt-002"), criar_evento("evt-001")])

    assert mempool.listar_event_ids() == ["evt-002", "evt-003", "evt-001"]
