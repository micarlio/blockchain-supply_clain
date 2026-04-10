from fastapi.testclient import TestClient

import src.api_http.no_aplicacao as no_aplicacao_mod
from src.api_http import NoAplicacaoBlockchain, criar_aplicacao_http
from src.core.config import CoreConfig
from src.core.models.event import SupplyChainEvent
from src.core.services.blockchain import Blockchain
from src.core.services.miner import Miner


class RespostaHttpFalsa:
    def __init__(self, status_code: int, payload: dict[str, object]):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def criar_cliente_teste(
    node_id: str = "node-api",
) -> tuple[TestClient, NoAplicacaoBlockchain]:
    no_aplicacao = NoAplicacaoBlockchain(
        config=CoreConfig(node_id=node_id, difficulty=2, max_events_per_block=5),
        iniciar_mineracao_automatica=False,
    )
    no_aplicacao.produtor.publicar_evento = lambda evento: None
    no_aplicacao.produtor.publicar_bloco = lambda bloco: None
    no_aplicacao.produtor.publicar_configuracao_rede = lambda payload: None
    no_aplicacao._sincronizar_dificuldade_global_nos_conhecidos = lambda dificuldade: {
        "nos_atualizados": []
    }
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


def test_post_eventos_rejeita_input_ids_duplicados():
    cliente, _ = criar_cliente_teste("node-input-duplicado")

    cliente.post("/eventos?propagar_rede=false", json=evento_materia_prima("EVT-100"))

    resposta = cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_produto_simples("EVT-101", "EVT-100")
        | {"input_ids": ["EVT-100", "EVT-100"]},
    )

    assert resposta.status_code == 400
    assert resposta.json()["motivo"] == "input_ids_duplicados"


def test_post_eventos_rejeita_product_id_duplicado():
    cliente, _ = criar_cliente_teste("node-product-id-duplicado")

    resposta_base = cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_materia_prima("EVT-100"),
    )
    assert resposta_base.status_code == 200

    resposta = cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_materia_prima("EVT-101") | {"product_id": "ACO-LOTE-100"},
    )

    assert resposta.status_code == 400
    assert resposta.json()["motivo"] == "product_id_duplicado"


def test_get_rastreabilidade_rejeita_identificador_ambiguo_em_memoria():
    cliente, no_aplicacao = criar_cliente_teste("node-rastreio-ambiguo")

    evento_1 = SupplyChainEvent.de_dict(evento_materia_prima("EVT-A1"))
    evento_2 = SupplyChainEvent.de_dict(
        evento_materia_prima("EVT-A2")
        | {
            "product_id": "ACO-LOTE-100",
            "metadata": {"lot_id": "ACO-LOTE-100"},
            "timestamp": "2026-04-07T10:05:00Z",
        }
    )
    assert evento_1 is not None
    assert evento_2 is not None

    assert no_aplicacao.mempool.adicionar_evento(evento_1) is True
    assert no_aplicacao.mempool.adicionar_evento(evento_2) is True

    resposta = cliente.get("/rastreabilidade/ACO-LOTE-100")
    assert resposta.status_code == 409
    assert resposta.json()["status"] == "rastreabilidade_rejeitada"
    assert "Consulte por event_id" in resposta.json()["motivo"]


def test_get_rede_e_estado_expoem_resumo_do_no():
    cliente, _ = criar_cliente_teste("node-resumo")

    estado = cliente.get("/estado")
    assert estado.status_code == 200
    assert estado.json()["node_id"] == "node-resumo"
    assert estado.json()["papel_no"] == "controle"
    assert estado.json()["perfil_no"] == "honesto"
    assert estado.json()["mineracao_automatica_ativa"] is False
    assert estado.json()["dificuldade_global"] == 2
    assert estado.json()["capacidade_mineracao"]["tentativas_nonce_por_ciclo"] > 0

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


def test_patch_configuracao_no_atualiza_papel_e_hash_power_em_memoria():
    cliente, _ = criar_cliente_teste("node-config")

    resposta = cliente.patch(
        "/configuracao/no",
        json={
            "papel_no": "minerador",
            "intervalo_ciclo_segundos": 0.5,
            "tentativas_nonce_por_ciclo": 45000,
        },
    )
    assert resposta.status_code == 200

    dados = resposta.json()["estado"]
    assert dados["papel_no"] == "minerador"
    assert dados["mineracao_automatica_ativa"] is True
    assert dados["capacidade_mineracao"]["intervalo_ciclo_segundos"] == 0.5
    assert dados["capacidade_mineracao"]["tentativas_nonce_por_ciclo"] == 45000


def test_patch_configuracao_rede_atualiza_dificuldade_global_sem_invalidar_bloco_antigo():
    cliente, no_aplicacao = criar_cliente_teste("node-dificuldade")

    cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-DIFF-001")
    )
    resposta_mineracao = cliente.post("/demonstracao/minerar")
    assert resposta_mineracao.status_code == 200
    assert resposta_mineracao.json()["status"] == "bloco_minerado"
    assert (
        no_aplicacao.blockchain.validar_cadeia(no_aplicacao.blockchain.copiar_cadeia())
        is True
    )

    resposta = cliente.patch(
        "/configuracao/rede",
        json={"dificuldade_global": 5},
    )
    assert resposta.status_code == 200

    dados = resposta.json()["estado"]
    assert dados["dificuldade_global"] == 5
    assert dados["difficulty"] == 5
    assert (
        no_aplicacao.blockchain.validar_cadeia(no_aplicacao.blockchain.copiar_cadeia())
        is True
    )

    cliente.post(
        "/eventos?propagar_rede=false",
        json=evento_materia_prima("EVT-DIFF-002")
        | {
            "product_id": "ACO-LOTE-200",
            "metadata": {"lot_id": "ACO-LOTE-200"},
        },
    )
    resposta_mineracao_nova = cliente.post("/demonstracao/minerar")
    assert resposta_mineracao_nova.status_code == 200
    assert resposta_mineracao_nova.json()["bloco"]["difficulty"] == 5


def test_patch_configuracao_rede_inalterada_nao_muda_estado_nem_limpa_forks():
    cliente, no_aplicacao = criar_cliente_teste("node-dificuldade-inalterada")
    no_aplicacao.blockchain.cadeias_candidatas = [
        no_aplicacao.blockchain.copiar_cadeia()
    ]

    resposta = cliente.patch(
        "/configuracao/rede",
        json={"dificuldade_global": no_aplicacao.config.global_difficulty},
    )
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "dificuldade_global_inalterada"
    assert len(no_aplicacao.blockchain.cadeias_candidatas) == 1


def test_patch_configuracao_rede_pode_aplicar_dificuldade_sem_propagacao():
    cliente, no_aplicacao = criar_cliente_teste("node-dificuldade-local")
    publicou = {"valor": False}

    def _publicar_configuracao(_payload):
        publicou["valor"] = True

    no_aplicacao.produtor.publicar_configuracao_rede = _publicar_configuracao

    resposta = cliente.patch(
        "/configuracao/rede",
        json={"dificuldade_global": 6, "propagar_rede": False},
    )
    assert resposta.status_code == 200
    assert resposta.json()["status"] == "dificuldade_global_aplicada_localmente"
    assert resposta.json()["estado"]["dificuldade_global"] == 6
    assert publicou["valor"] is False


def test_patch_configuracao_rede_retorna_409_quando_sincronizacao_global_falha():
    cliente, no_aplicacao = criar_cliente_teste("node-dificuldade-falha")
    no_aplicacao._sincronizar_dificuldade_global_nos_conhecidos = lambda _dificuldade: (
        _ for _ in ()
    ).throw(RuntimeError("falha_sincronizacao_dificuldade_global:node-beta"))

    resposta = cliente.patch(
        "/configuracao/rede",
        json={"dificuldade_global": 6},
    )
    assert resposta.status_code == 409
    assert resposta.json()["status"] == "configuracao_parcial"


def test_sincronizar_dificuldade_global_considera_no_descoberto_no_monitor(monkeypatch):
    cliente, no_aplicacao = criar_cliente_teste("node-sync-monitor")
    no_aplicacao._sincronizar_dificuldade_global_nos_conhecidos = (  # type: ignore[method-assign]
        no_aplicacao_mod.NoAplicacaoBlockchain._sincronizar_dificuldade_global_nos_conhecidos.__get__(
            no_aplicacao,
            no_aplicacao_mod.NoAplicacaoBlockchain,
        )
    )
    no_aplicacao.monitor_rede.atualizar_no(
        "node-custom",
        api_url="http://node-custom:8999",
        status="online",
        ultimo_evento="descoberto",
    )
    chamadas_patch: list[str] = []
    chamadas_get: list[str] = []

    def fake_patch(url, json, timeout):
        chamadas_patch.append(url)
        return RespostaHttpFalsa(200, {"status": "ok"})

    def fake_get(url, timeout):
        chamadas_get.append(url)
        return RespostaHttpFalsa(200, {"dificuldade_global": 6})

    monkeypatch.setattr(no_aplicacao_mod.httpx, "patch", fake_patch)
    monkeypatch.setattr(no_aplicacao_mod.httpx, "get", fake_get)

    resultado = no_aplicacao._sincronizar_dificuldade_global_nos_conhecidos(6)

    assert "node-custom" in resultado["nos_atualizados"]
    assert any(url.startswith("http://node-custom:8999") for url in chamadas_patch)
    assert any(url.startswith("http://node-custom:8999") for url in chamadas_get)


def test_sincronizar_cadeia_com_no_remoto_recupera_bloco_e_poda_mempool(monkeypatch):
    _, no_aplicacao = criar_cliente_teste("node-sync-cadeia")
    blockchain_remota = Blockchain(
        config=CoreConfig(node_id="node-alpha", difficulty=2)
    )
    minerador_remoto = Miner(config=CoreConfig(node_id="node-alpha", difficulty=2))

    bloco_remoto = minerador_remoto.criar_bloco_candidato(
        blockchain_remota,
        [SupplyChainEvent.de_dict(evento_materia_prima("EVT-SYNC-REMOTE"))],
        timestamp="2026-04-10T12:00:00Z",
    )
    assert bloco_remoto is not None
    minerador_remoto.minerar_bloco(bloco_remoto)
    assert blockchain_remota.adicionar_bloco(bloco_remoto) is True

    assert (
        no_aplicacao.adicionar_evento_por_payload(
            evento_materia_prima("EVT-SYNC-REMOTE"),
            publicar_na_rede=False,
        )["status"]
        == "evento_adicionado"
    )
    assert no_aplicacao.mempool.quantidade_pendente() == 1

    no_aplicacao.monitor_rede.atualizar_no(
        "node-alpha",
        api_url="http://node-alpha:8001",
        status="online",
        ultimo_evento="descoberto",
    )

    def fake_get(url, timeout):
        if url.endswith("/cadeia"):
            return RespostaHttpFalsa(
                200,
                {
                    "node_id": "node-alpha",
                    "cadeia_ativa": [
                        bloco.para_dict() for bloco in blockchain_remota.chain
                    ],
                    "cadeias_candidatas": [],
                    "trabalho_acumulado_ativo": blockchain_remota.obter_trabalho_acumulado(
                        blockchain_remota.chain
                    ),
                },
            )
        if url.endswith("/estado"):
            return RespostaHttpFalsa(
                200,
                {
                    "node_id": "node-alpha",
                    "altura_cadeia": len(blockchain_remota.chain),
                    "hash_ponta": blockchain_remota.obter_ultimo_bloco().block_hash,
                    "quantidade_mempool": 0,
                },
            )
        raise AssertionError(url)

    monkeypatch.setattr(no_aplicacao_mod.httpx, "get", fake_get)

    assert no_aplicacao.sincronizar_cadeia_com_no_remoto("node-alpha") is True
    assert len(no_aplicacao.blockchain.chain) == 2
    assert (
        no_aplicacao.blockchain.obter_ultimo_bloco().block_hash
        == blockchain_remota.obter_ultimo_bloco().block_hash
    )
    assert no_aplicacao.mempool.quantidade_pendente() == 0


def test_patch_configuracao_no_invalida_nao_deixa_estado_parcial_aplicado():
    cliente, _ = criar_cliente_teste("node-config-invalido")

    estado_inicial = cliente.get("/estado")
    assert estado_inicial.status_code == 200

    resposta = cliente.patch(
        "/configuracao/no",
        json={
            "papel_no": "observador",
            "intervalo_ciclo_segundos": -1,
            "tentativas_nonce_por_ciclo": 10000,
        },
    )
    assert resposta.status_code == 400
    assert resposta.json()["motivo"] == "intervalo_ciclo_invalido"

    estado_final = cliente.get("/estado")
    assert estado_final.status_code == 200
    assert estado_final.json()["papel_no"] == estado_inicial.json()["papel_no"]
    assert (
        estado_final.json()["mineracao_automatica_ativa"]
        == estado_inicial.json()["mineracao_automatica_ativa"]
    )


def test_post_memoria_limpar_reinicia_estado_runtime_do_no():
    cliente, no_aplicacao = criar_cliente_teste("node-reset")

    cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-RESET-001")
    )
    resposta_mineracao = cliente.post("/demonstracao/minerar")
    assert resposta_mineracao.status_code == 200
    assert resposta_mineracao.json()["status"] == "bloco_minerado"

    resposta_config_no = cliente.patch(
        "/configuracao/no",
        json={
            "papel_no": "observador",
            "intervalo_ciclo_segundos": 0.5,
            "tentativas_nonce_por_ciclo": 12345,
        },
    )
    assert resposta_config_no.status_code == 200

    resposta_config_rede = cliente.patch(
        "/configuracao/rede",
        json={"dificuldade_global": 5},
    )
    assert resposta_config_rede.status_code == 200

    resposta = cliente.post("/memoria/limpar")
    assert resposta.status_code == 200

    dados = resposta.json()
    estado = dados["estado"]
    assert dados["status"] == "memoria_limpa"
    assert estado["node_id"] == "node-reset"
    assert estado["papel_no"] == "controle"
    assert estado["mineracao_automatica_ativa"] is False
    assert estado["dificuldade_global"] == 2
    assert estado["difficulty"] == 2
    assert estado["quantidade_mempool"] == 0
    assert estado["altura_cadeia"] == 1
    assert estado["forks_conhecidos"] == 0
    assert estado["capacidade_mineracao"]["intervalo_ciclo_segundos"] == 2.0
    assert estado["capacidade_mineracao"]["tentativas_nonce_por_ciclo"] == 10000
    assert len(no_aplicacao.blockchain.chain) == 1
    assert no_aplicacao.mempool.quantidade_pendente() == 0
    atividades = no_aplicacao.monitor_rede.listar_atividades(limite=5)
    assert atividades[0]["tipo"] == "memoria_limpa"


def test_get_logs_expoe_trilha_estruturada_da_api_e_validacao():
    cliente, _ = criar_cliente_teste("node-logs")

    resposta_estado = cliente.get("/estado")
    assert resposta_estado.status_code == 200

    resposta_evento = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-LOG-001")
    )
    assert resposta_evento.status_code == 200

    resposta_logs = cliente.get("/logs?limite=50")
    assert resposta_logs.status_code == 200

    dados = resposta_logs.json()
    assert dados["node_id"] == "node-logs"
    assert dados["transport"] == "polling"
    assert isinstance(dados["entries"], list)
    assert len(dados["entries"]) >= 2

    categorias = {entrada["category"] for entrada in dados["entries"]}
    endpoints = {entrada.get("endpoint") for entrada in dados["entries"]}
    assert "api" in categorias
    assert "validacao" in categorias
    assert "/estado" in endpoints
    assert "/eventos" in endpoints


def test_consultas_de_leitura_nao_sobrescrevem_ultimo_evento_operacional():
    cliente, no_aplicacao = criar_cliente_teste("node-monitor")

    resposta_evento = cliente.post(
        "/eventos?propagar_rede=false", json=evento_materia_prima("EVT-MON-001")
    )
    assert resposta_evento.status_code == 200

    no_local_antes = next(
        no
        for no in no_aplicacao.monitor_rede.listar_nos()
        if no["node_id"] == "node-monitor"
    )
    assert no_local_antes["ultimo_evento"] == "evento_adicionado"

    resposta_estado = cliente.get("/estado")
    resposta_rede = cliente.get("/rede")
    assert resposta_estado.status_code == 200
    assert resposta_rede.status_code == 200

    no_local_depois = next(
        no
        for no in no_aplicacao.monitor_rede.listar_nos()
        if no["node_id"] == "node-monitor"
    )
    assert no_local_depois["ultimo_evento"] == "evento_adicionado"


def test_get_testes_cenarios_e_detalhe_expoem_catalogo_backend():
    cliente, _ = criar_cliente_teste("node-testes")

    resposta_lista = cliente.get("/testes/cenarios")
    assert resposta_lista.status_code == 200
    cenarios = resposta_lista.json()
    assert len(cenarios) == 2
    ids = {cenario["id"] for cenario in cenarios}
    assert "attack-51-simulado" in ids
    assert "double-spend-adaptado" in ids

    resposta_detalhe = cliente.get("/testes/cenarios/attack-51-simulado")
    assert resposta_detalhe.status_code == 200
    detalhe = resposta_detalhe.json()
    assert detalhe["id"] == "attack-51-simulado"
    assert detalhe["requires_node_selection"] is True
    assert detalhe["show_blockchain_impact"] is True

    resposta_detalhe_double_spend = cliente.get(
        "/testes/cenarios/double-spend-adaptado"
    )
    assert resposta_detalhe_double_spend.status_code == 200
    detalhe_double_spend = resposta_detalhe_double_spend.json()
    assert detalhe_double_spend["id"] == "double-spend-adaptado"
    assert detalhe_double_spend["categoria"] == "validacao_dominio"
    assert detalhe_double_spend["show_blockchain_impact"] is True
    assert len(detalhe_double_spend["impactos_execucao"]) >= 1


def test_post_testes_executar_delega_para_executor_backend():
    cliente, no_aplicacao = criar_cliente_teste("node-testes-execucao")
    no_aplicacao.executor_testes.executar_cenario = lambda scenario_id, payload: {
        "scenario_id": scenario_id,
        "scenario_name": "Ataque de 51% (simulado)",
        "status_execucao": "concluido",
        "teste_aprovado": True,
        "resultado_esperado": "cenário executado",
        "resultado_observado": "cenário executado no stub",
        "mensagem_interpretada": "stub ok",
        "request_enviada": [{"payload": payload}],
        "response_recebida": [{"status": "ok"}],
        "impacto_blockchain": {"cadeia_vencedora": "maliciosa"},
        "contexto_relevante": {"node_id": payload.get("node_id")},
        "erro_tecnico": None,
    }

    resposta = cliente.post(
        "/testes/executar/attack-51-simulado",
        json={"node_id": "node-evil", "parametros": {}},
    )
    assert resposta.status_code == 200

    dados = resposta.json()
    assert dados["scenario_id"] == "attack-51-simulado"
    assert dados["teste_aprovado"] is True
    assert dados["contexto_relevante"]["node_id"] == "node-evil"


def test_post_testes_executar_double_spend_aprovado_quando_reutilizacao_e_rejeitada():
    cliente, _ = criar_cliente_teste("node-double-spend")

    resposta = cliente.post(
        "/testes/executar/double-spend-adaptado",
        json={"node_id": "node-double-spend", "parametros": {}},
    )
    assert resposta.status_code == 200

    dados = resposta.json()
    assert dados["scenario_id"] == "double-spend-adaptado"
    assert dados["status_execucao"] == "concluido"
    assert dados["teste_aprovado"] is True
    assert dados["response_recebida"][-1]["response"]["status"] == "evento_rejeitado"
    assert (
        dados["response_recebida"][-1]["response"]["motivo"] == "input_id_ja_consumido"
    )
    assert (
        dados["impacto_blockchain"]["cadeia_inalterada_apos_tentativa_invalida"] is True
    )
    assert dados["impacto_blockchain"]["produto_concorrente_confirmado"] is False


def test_rotas_de_testes_retorna_404_para_cenario_inexistente():
    cliente, _ = criar_cliente_teste("node-testes-404")

    resposta_detalhe = cliente.get("/testes/cenarios/inexistente")
    assert resposta_detalhe.status_code == 404

    resposta_execucao = cliente.post("/testes/executar/inexistente", json={})
    assert resposta_execucao.status_code == 404


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
