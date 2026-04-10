"""Testes unitarios dos adaptadores Kafka."""

from src.core.config import CoreConfig
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import bloco_para_dict
from src.core.services.blockchain import STATUS_BLOCO_REJEITADO
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


class ConsumidorFalso:
    def __init__(self, *_args, **_kwargs) -> None:
        self.topicos = []

    def subscribe(self, topicos) -> None:
        self.topicos = list(topicos)

    def close(self) -> None:
        return None


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


def criar_produtor(
    monkeypatch,
    config: CoreConfig | None = None,
) -> tuple[no_kafka.NoProdutor, ProdutorFalso]:
    """Constroi o adaptador com um producer stubado."""

    produtor_falso = ProdutorFalso()
    monkeypatch.setattr(no_kafka, "Producer", lambda config: produtor_falso)

    config = config or CoreConfig(difficulty=1, node_id="node-teste")
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


def test_ciclo_automatico_mina_bloco_respeitando_capacidade_do_no(monkeypatch) -> None:
    """A mineracao automatica deve usar a capacidade local sem mudar o PoW."""

    config = CoreConfig(
        difficulty=0,
        node_id="node-teste",
        nonce_attempts_per_cycle=1,
        mining_cycle_interval_seconds=0.25,
    )
    produtor, produtor_falso = criar_produtor(monkeypatch, config=config)
    evento = criar_evento()

    assert produtor.mempool.adicionar_evento(evento) is True

    bloco = produtor.executar_ciclo_mineracao_automatica()

    assert bloco is not None
    assert bloco.difficulty == config.global_difficulty
    assert len(produtor.blockchain.chain) == 2
    assert produtor.mempool.quantidade_pendente() == 0
    assert len(produtor_falso.mensagens) == 1


def test_consumidor_tenta_ressincronizar_quando_bloco_rejeitado(monkeypatch) -> None:
    """Bloco rejeitado por falta de contexto deve disparar tentativa de re-sync."""

    monkeypatch.setattr(no_kafka, "Consumer", ConsumidorFalso)
    blockchain_local = Blockchain(config=CoreConfig(difficulty=1, node_id="node-local"))
    blockchain_remota = Blockchain(
        config=CoreConfig(difficulty=1, node_id="node-remoto")
    )
    mempool = Mempool()
    minerador_remoto = Miner(config=CoreConfig(difficulty=1, node_id="node-remoto"))

    bloco_1 = minerador_remoto.criar_bloco_candidato(
        blockchain_remota,
        [criar_evento("evt-remoto-1")],
        timestamp="2026-04-01T10:01:00Z",
    )
    assert bloco_1 is not None
    minerador_remoto.minerar_bloco(bloco_1)
    assert blockchain_remota.adicionar_bloco(bloco_1) is True

    bloco_2 = minerador_remoto.criar_bloco_candidato(
        blockchain_remota,
        [criar_evento("evt-remoto-2")],
        timestamp="2026-04-01T10:02:00Z",
    )
    assert bloco_2 is not None
    minerador_remoto.minerar_bloco(bloco_2)

    chamadas_sync: list[str] = []
    consumidor = no_kafka.NoConsumidor(
        "node-local",
        "localhost:9092",
        blockchain_local,
        mempool,
        sincronizar_cadeia_remota=lambda node_id: chamadas_sync.append(node_id) or True,
    )

    consumidor._processar_bloco_recebido(
        bloco_para_dict(bloco_2),
        "node-remoto",
    )

    assert (
        blockchain_local.processar_bloco_recebido(bloco_para_dict(bloco_2))
        == STATUS_BLOCO_REJEITADO
    )
    assert chamadas_sync == ["node-remoto"]
