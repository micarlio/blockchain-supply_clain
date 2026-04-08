from fastapi.testclient import TestClient

from src.api_http import NoAplicacaoBlockchain, criar_aplicacao_http
from src.core.config import CoreConfig


def criar_cliente_teste(
    node_id: str = "node-api",
) -> tuple[TestClient, NoAplicacaoBlockchain]:
    no_aplicacao = NoAplicacaoBlockchain(
        config=CoreConfig(node_id=node_id, difficulty=2, max_events_per_block=5),
        iniciar_mineracao_automatica=False,
    )
    no_aplicacao.produtor.publicar_evento = lambda evento: None
    no_aplicacao.produtor.publicar_bloco = lambda bloco: None
    aplicacao = criar_aplicacao_http(no_aplicacao)
    return TestClient(aplicacao), no_aplicacao


def evento_materia_prima(event_id: str = "EVT-100") -> dict[str, object]:
    return {
        "event_id": event_id,
        "event_type": "CADASTRAR_MATERIA_PRIMA",
        "entity_kind": "raw_material",
        "product_id": "ACO-LOTE-100",
        "product_name": "Chapa de Aco",
        "actor_id": "SIDERURGICA-CNPJ",
        "actor_role": "FORNECEDOR",
        "timestamp": "2026-04-07T10:00:00Z",
        "input_ids": [],
        "metadata": {"lot_id": "ACO-LOTE-100"},
    }


def evento_produto_simples(
    event_id: str = "EVT-101",
    input_id: str = "EVT-100",
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "event_type": "FABRICAR_PRODUTO_SIMPLES",
        "entity_kind": "simple_product",
        "product_id": "QUADRO-LOTE-100",
        "product_name": "Quadro de Bicicleta",
        "actor_id": "FABRICA-CNPJ",
        "actor_role": "FABRICANTE",
        "timestamp": "2026-04-07T11:00:00Z",
        "input_ids": [input_id],
        "metadata": {"lot_id": "QUADRO-LOTE-100"},
    }


def evento_produto_composto(
    event_id: str = "EVT-102",
    input_ids: list[str] | None = None,
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "event_type": "FABRICAR_PRODUTO_COMPOSTO",
        "entity_kind": "composite_product",
        "product_id": "BICICLETA-LOTE-100",
        "product_name": "Bicicleta Urbana",
        "actor_id": "MONTADORA-CNPJ",
        "actor_role": "MONTADORA",
        "timestamp": "2026-04-07T12:00:00Z",
        "input_ids": input_ids or ["EVT-101", "EVT-103"],
        "metadata": {"lot_id": "BICICLETA-LOTE-100"},
    }


def test_post_eventos_aceita_evento_valido_e_rejeita_duplicado():
    cliente, _ = criar_cliente_teste()

    resposta_ok = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima()
    )
    assert resposta_ok.status_code == 200
    assert resposta_ok.json()["status"] == "evento_adicionado"

    resposta_duplicada = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima()
    )
    assert resposta_duplicada.status_code == 400
    assert resposta_duplicada.json()["motivo"] == "evento_duplicado"


def test_post_eventos_rejeita_payload_invalido():
    cliente, _ = criar_cliente_teste()

    resposta = cliente.post("/eventos", json={"event_id": "quebrado"})
    assert resposta.status_code == 400
    assert resposta.json()["motivo"] == "payload_invalido"


def test_rastreabilidade_retorna_arvore_recursiva_de_composicao():
    cliente, no_aplicacao = criar_cliente_teste()

    cliente.post("/eventos?propagar_rede=false", json=evento_materia_prima("EVT-100"))
    cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_materia_prima("EVT-103")
        | {
            "product_id": "RODA-LOTE-100",
            "product_name": "Conjunto de Rodas",
            "metadata": {"lot_id": "RODA-LOTE-100"},
        },
    )
    cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_produto_simples("EVT-101", "EVT-100"),
    )
    cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_produto_composto("EVT-102", ["EVT-101", "EVT-103"]),
    )

    resposta_mineracao = cliente.post("/demonstracao/minerar")
    assert resposta_mineracao.status_code == 200
    assert resposta_mineracao.json()["status"] == "bloco_minerado"
    assert len(no_aplicacao.blockchain.chain) == 2

    resposta = cliente.get("/rastreabilidade/BICICLETA-LOTE-100")
    assert resposta.status_code == 200
    dados = resposta.json()
    assert dados["estado_atual"]["status"] == "confirmado"
    assert len(dados["eventos_confirmados"]) == 1
    assert (
        dados["eventos_confirmados"][0]["evento"]["event_type"]
        == "FABRICAR_PRODUTO_COMPOSTO"
    )
    assert dados["arvore_origem"]["evento"]["event_id"] == "EVT-102"
    assert len(dados["arvore_origem"]["insumos"]) == 2
    assert dados["arvore_origem"]["insumos"][0]["evento"]["event_id"] == "EVT-101"
    assert (
        dados["arvore_origem"]["insumos"][0]["insumos"][0]["evento"]["event_id"]
        == "EVT-100"
    )


def test_get_rede_e_estado_expoem_resumo_do_no():
    cliente, _ = criar_cliente_teste("node-resumo")

    estado = cliente.get("/estado")
    assert estado.status_code == 200
    assert estado.json()["node_id"] == "node-resumo"

    rede = cliente.get("/rede")
    assert rede.status_code == 200
    assert rede.json()["node_id"] == "node-resumo"
    assert isinstance(rede.json()["nos_conhecidos"], list)


def test_get_mempool_expoe_quantidade_e_eventos_pendentes():
    cliente, _ = criar_cliente_teste("node-mempool")

    resposta_evento = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-MEMPOOL")
    )
    assert resposta_evento.status_code == 200

    resposta_mempool = cliente.get("/mempool")
    assert resposta_mempool.status_code == 200

    dados = resposta_mempool.json()
    assert dados["node_id"] == "node-mempool"
    assert dados["quantidade"] == 1
    assert len(dados["eventos"]) == 1
    assert dados["eventos"][0]["event_id"] == "EVT-MEMPOOL"
    assert dados["eventos"][0]["event_type"] == "CADASTRAR_MATERIA_PRIMA"
    assert dados["eventos"][0]["metadata"]["lot_id"] == "ACO-LOTE-100"


def test_get_cadeia_expoe_cadeia_ativa_candidatas_e_trabalho_acumulado():
    cliente, no_aplicacao = criar_cliente_teste("node-cadeia")

    cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-CHAIN-100")
    )

    resposta_mineracao = cliente.post("/demonstracao/minerar")
    assert resposta_mineracao.status_code == 200
    assert resposta_mineracao.json()["status"] == "bloco_minerado"
    assert len(no_aplicacao.blockchain.chain) == 2

    resposta_cadeia = cliente.get("/cadeia")
    assert resposta_cadeia.status_code == 200

    dados = resposta_cadeia.json()
    assert dados["node_id"] == "node-cadeia"
    assert len(dados["cadeia_ativa"]) == 2
    assert isinstance(dados["cadeias_candidatas"], list)
    assert isinstance(dados["trabalho_acumulado_ativo"], int)
    assert dados["trabalho_acumulado_ativo"] > 0
    assert dados["cadeia_ativa"][-1]["events"][0]["event_id"] == "EVT-CHAIN-100"
    assert dados["cadeia_ativa"][-1]["event_count"] == 1


def test_get_demonstracao_expoe_estado_resumo_e_atividades_recentes():
    cliente, _ = criar_cliente_teste("node-demo")

    resposta_evento = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-DEMO-100")
    )
    assert resposta_evento.status_code == 200

    resposta_demonstracao = cliente.get("/demonstracao")
    assert resposta_demonstracao.status_code == 200

    dados = resposta_demonstracao.json()
    assert dados["node_id"] == "node-demo"
    assert dados["estado_no"]["node_id"] == "node-demo"
    assert dados["estado_no"]["quantidade_mempool"] == 1
    assert dados["demonstracao"]["fork_detectado"] is False
    assert dados["demonstracao"]["reorganizacao_detectada"] is False
    assert isinstance(dados["atividades"], list)
    assert len(dados["atividades"]) >= 1
    assert dados["atividades"][0]["tipo"] == "evento_adicionado"
    assert dados["atividades"][0]["event_id_relacionado"] == "EVT-DEMO-100"
    assert dados["demonstracao"]["atividade_recente"]["tipo"] == "evento_adicionado"


def test_shutdown_da_aplicacao_encera_recursos_do_no() -> None:
    no_aplicacao = NoAplicacaoBlockchain(
        config=CoreConfig(
            node_id="node-shutdown", difficulty=2, max_events_per_block=5
        ),
        iniciar_mineracao_automatica=False,
    )
    chamadas: list[str] = []
    no_aplicacao.encerrar = lambda: chamadas.append("encerrar")

    aplicacao = criar_aplicacao_http(no_aplicacao)

    with TestClient(aplicacao) as cliente:
        resposta = cliente.get("/")
        assert resposta.status_code == 200

    assert chamadas == ["encerrar"]
