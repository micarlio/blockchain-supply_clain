"""Testes unitarios dos adaptadores Kafka."""

from src.core.config import CoreConfig
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from src.core.services.miner import Miner
from src.rede import no_kafka


class ProdutorFalso:
    """Captura chamadas feitas pelo adaptador sem falar com um broker real."""

    def __init__(self) -> None:
        self.mensagens: list[dict[str, object]] = []
        self.poll_args: list[int] = []
        self.flush_args: list[float] = []

    def produce(self, **kwargs) -> None:
        self.mensagens.append(kwargs)

    def poll(self, timeout: int) -> None:
        self.poll_args.append(timeout)

    def flush(self, timeout: float = 0.0) -> None:
        self.flush_args.append(timeout)


def criar_evento(event_id: str = "evt-001") -> SupplyChainEvent:
    """Cria um evento simples valido para publicacao."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="CADASTRAR_MATERIA_PRIMA",
        product_id=f"MP-{event_id}",
        product_name="Algodao in natura",
        entity_kind="raw_material",
        actor_id="fornecedor-01",
        actor_role="FORNECEDOR",
        timestamp="2026-04-01T10:00:00Z",
        input_ids=[],
        metadata={"origin": "Fazenda A"},
    )


def criar_produtor(monkeypatch) -> tuple[no_kafka.NoProdutor, ProdutorFalso]:
    """Constroi o adaptador com um producer stubado."""

    produtor_falso = ProdutorFalso()
    monkeypatch.setattr(no_kafka, "Producer", lambda config: produtor_falso)

    config = CoreConfig(difficulty=1, node_id="node-teste")
    blockchain = Blockchain(config=config)
    mempool = Mempool()
    produtor = no_kafka.NoProdutor(
        config.node_id,
        "localhost:9092",
        blockchain,
        mempool,
    )
    return produtor, produtor_falso


def test_publicar_evento_enfileira_payload_e_dispara_poll_sem_flush(
    monkeypatch,
) -> None:
    """Publicar evento deve enfileirar sem bloquear em `flush`."""

    produtor, produtor_falso = criar_produtor(monkeypatch)
    evento = criar_evento()

    produtor.publicar_evento(evento)

    assert len(produtor_falso.mensagens) == 1
    mensagem = produtor_falso.mensagens[0]
    assert mensagem["topic"] == no_kafka.TOPICO_EVENTOS
    assert mensagem["value"] == no_kafka.evento_para_json(evento).encode("utf-8")
    assert mensagem["headers"] == [("origem_no", "node-teste")]
    assert callable(mensagem["callback"])
    assert produtor_falso.poll_args == [0]
    assert produtor_falso.flush_args == []


def test_publicar_bloco_enfileira_payload_e_dispara_poll_sem_flush(monkeypatch) -> None:
    """Publicar bloco deve usar o mesmo caminho assíncrono do evento."""

    produtor, produtor_falso = criar_produtor(monkeypatch)
    miner = Miner(config=CoreConfig(difficulty=1, node_id="node-teste"))
    bloco = miner.criar_bloco_candidato(
        produtor.blockchain,
        [criar_evento()],
        timestamp="2026-04-01T10:05:00Z",
    )
    assert bloco is not None

    produtor.publicar_bloco(bloco)

    assert len(produtor_falso.mensagens) == 1
    mensagem = produtor_falso.mensagens[0]
    assert mensagem["topic"] == no_kafka.TOPICO_BLOCOS
    assert mensagem["value"] == no_kafka.bloco_para_json(bloco).encode("utf-8")
    assert mensagem["headers"] == [("origem_no", "node-teste")]
    assert callable(mensagem["callback"])
    assert produtor_falso.poll_args == [0]
    assert produtor_falso.flush_args == []


def test_encerrar_produtor_faz_flush_uma_vez(monkeypatch) -> None:
    """O encerramento deve drenar o buffer apenas na primeira chamada."""

    produtor, produtor_falso = criar_produtor(monkeypatch)

    produtor.encerrar(timeout=1.25)
    produtor.encerrar(timeout=9.0)

    assert produtor_falso.flush_args == [1.25]
