"""Simulação ponta a ponta do projeto para demonstração da banca."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx

from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import bloco_de_dict, bloco_para_json, evento_para_json

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[2]
ARQUIVO_COMPOSE = PROJECT_ROOT / "infra" / "kafka" / "docker-compose.yml"


def anunciar_etapa(numero: int, titulo: str) -> None:
    """Imprime um cabeçalho curto para cada etapa da simulação."""

    print()
    print("=" * 88)
    print(f"[ETAPA {numero}] {titulo}")
    print("=" * 88)


def encurtar_hash(valor: str | None, tamanho: int = 12) -> str:
    """Encorta hashes longos para facilitar leitura no terminal."""

    if not valor:
        return "-"
    if len(valor) <= tamanho:
        return valor
    return valor[:tamanho]


def imprimir_json(titulo: str, payload: dict[str, object]) -> None:
    """Mostra um dicionário JSON de forma legível."""

    print(f"{titulo}:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def porta_livre(host: str, porta: int) -> bool:
    """Verifica se a porta está disponível antes de subir um nó."""

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as conexao:
        conexao.settimeout(0.5)
        return conexao.connect_ex((host, porta)) != 0


def executar_comando(cmd: list[str], *, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Executa um comando simples e devolve o resultado."""

    return subprocess.run(
        cmd,
        cwd=str(cwd or BACKEND_ROOT),
        text=True,
        capture_output=True,
        check=False,
    )


def subir_kafka() -> None:
    """Sobe o ambiente Kafka do projeto."""

    print("[Ambiente] Subindo Kafka via Docker Compose...")
    resultado = executar_comando(
        ["docker", "compose", "-f", str(ARQUIVO_COMPOSE), "up", "-d"],
        cwd=PROJECT_ROOT,
    )
    if resultado.returncode != 0:
        print(resultado.stdout)
        print(resultado.stderr)
        raise SystemExit("Não foi possível subir o Kafka.")


def esperar_kafka(timeout: int = 60) -> None:
    """Espera até o broker e os tópicos ficarem prontos."""

    print("[Ambiente] Aguardando o Kafka ficar pronto...")
    inicio = time.time()
    while time.time() - inicio < timeout:
        resultado = executar_comando(
            [
                "docker",
                "exec",
                "blockchain-kafka",
                "kafka-topics",
                "--list",
                "--bootstrap-server",
                "localhost:9092",
            ],
            cwd=PROJECT_ROOT,
        )
        if resultado.returncode == 0:
            topicos = resultado.stdout.splitlines()
            if "cadeia-suprimentos-eventos" in topicos and "cadeia-suprimentos-blocos" in topicos:
                print("[Ambiente] Kafka pronto.")
                return

        time.sleep(2)

    raise SystemExit("O Kafka não ficou pronto dentro do tempo esperado.")


def derrubar_kafka() -> None:
    """Derruba o ambiente Kafka do projeto."""

    print("[Ambiente] Encerrando Kafka...")
    executar_comando(
        ["docker", "compose", "-f", str(ARQUIVO_COMPOSE), "down", "-v"],
        cwd=PROJECT_ROOT,
    )


def iniciar_no(
    *,
    node_id: str,
    porta_api: int,
    broker_url: str,
    observador: bool,
    dificuldade: int,
    max_eventos_por_bloco: int,
    diretorio_logs: Path,
) -> tuple[subprocess.Popen[str], Path]:
    """Sobe um processo do projeto para representar um nó real."""

    arquivo_log = diretorio_logs / f"{node_id}.log"
    log = arquivo_log.open("w", encoding="utf-8")
    comando = [
        sys.executable,
        "-m",
        "scripts.iniciar_no_kafka",
        node_id,
        "--broker-url",
        broker_url,
        "--porta-api",
        str(porta_api),
        "--host-api",
        "127.0.0.1",
        "--dificuldade",
        str(dificuldade),
        "--max-eventos-por-bloco",
        str(max_eventos_por_bloco),
        "--sem-mineracao-automatica",
    ]
    if observador:
        comando.append("--observador")

    env = dict(os.environ)
    env["PYTHONUNBUFFERED"] = "1"
    processo = subprocess.Popen(
        comando,
        cwd=str(BACKEND_ROOT),
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )
    return processo, arquivo_log


def encerrar_processo(processo: subprocess.Popen[str]) -> None:
    """Tenta encerrar um processo de nó sem deixar lixo no sistema."""

    if processo.poll() is not None:
        return

    processo.terminate()
    try:
        processo.wait(timeout=8)
    except subprocess.TimeoutExpired:
        processo.kill()
        processo.wait(timeout=5)


def esperar_api(url_base: str, timeout: int = 40) -> None:
    """Espera até a API responder na rota raiz."""

    inicio = time.time()
    while time.time() - inicio < timeout:
        try:
            with httpx.Client(timeout=2.0) as cliente:
                resposta = cliente.get(url_base.rstrip("/") + "/")
                if resposta.is_success:
                    return
        except httpx.HTTPError:
            pass
        time.sleep(1)

    raise SystemExit(f"A API {url_base} não respondeu dentro do tempo esperado.")


def esperar_condicao_http(
    descricao: str,
    funcao,
    *,
    timeout: int = 30,
    intervalo: float = 1.0,
) -> object:
    """Espera uma condição baseada em chamadas HTTP ficar verdadeira."""

    inicio = time.time()
    while time.time() - inicio < timeout:
        resultado = funcao()
        if resultado:
            return resultado
        time.sleep(intervalo)

    raise SystemExit(f"Tempo esgotado aguardando: {descricao}")


def obter_json(cliente: httpx.Client, url: str) -> dict[str, object]:
    """Faz um GET e devolve o JSON com validação mínima."""

    resposta = cliente.get(url)
    resposta.raise_for_status()
    return resposta.json()


def postar_evento(
    cliente: httpx.Client,
    url_api: str,
    evento: dict[str, object],
    *,
    propagar_rede: bool,
) -> dict[str, object]:
    """Envia um evento para a API do nó."""

    resposta = cliente.post(
        f"{url_api.rstrip('/')}/eventos",
        params={"propagar_rede": "true" if propagar_rede else "false"},
        json=evento,
    )
    dados = resposta.json()
    print(f"[HTTP] POST /eventos em {url_api} -> {resposta.status_code} | {dados}")
    return {"status_code": resposta.status_code, "body": dados}


def minerar(cliente: httpx.Client, url_api: str) -> dict[str, object]:
    """Dispara a mineração manual em um nó."""

    resposta = cliente.post(f"{url_api.rstrip('/')}/demonstracao/minerar")
    dados = resposta.json()
    print(f"[HTTP] POST /demonstracao/minerar em {url_api} -> {resposta.status_code} | {dados.get('status')}")
    return {"status_code": resposta.status_code, "body": dados}


def obter_estado(cliente: httpx.Client, url_api: str) -> dict[str, object]:
    """Consulta o estado do nó."""

    return obter_json(cliente, f"{url_api.rstrip('/')}/estado")


def obter_mempool(cliente: httpx.Client, url_api: str) -> dict[str, object]:
    """Consulta a mempool do nó."""

    return obter_json(cliente, f"{url_api.rstrip('/')}/mempool")


def obter_cadeia(cliente: httpx.Client, url_api: str) -> dict[str, object]:
    """Consulta a cadeia do nó."""

    return obter_json(cliente, f"{url_api.rstrip('/')}/cadeia")


def obter_demonstracao(cliente: httpx.Client, url_api: str) -> dict[str, object]:
    """Consulta o resumo da demonstração do nó."""

    return obter_json(cliente, f"{url_api.rstrip('/')}/demonstracao")


def obter_rastreabilidade(cliente: httpx.Client, url_api: str, identificador: str) -> dict[str, object]:
    """Consulta a rastreabilidade de um item."""

    return obter_json(cliente, f"{url_api.rstrip('/')}/rastreabilidade/{identificador}")


def atividade_presente(
    url_api: str,
    tipo: str,
    *,
    event_id: str | None = None,
    hash_bloco: str | None = None,
) -> bool:
    """Verifica se uma atividade já apareceu no monitor do nó."""

    with httpx.Client(timeout=5.0) as cliente:
        dados = obter_demonstracao(cliente, url_api)
    atividades = dados.get("atividades", [])
    if not isinstance(atividades, list):
        return False
    for item in atividades:
        if not isinstance(item, dict):
            continue
        if item.get("tipo") != tipo:
            continue
        if event_id is not None and item.get("event_id_relacionado") != event_id:
            continue
        if hash_bloco is not None and item.get("hash_relacionado") != hash_bloco:
            continue
        return True
    return False


def esperar_atividade(
    url_api: str,
    tipo: str,
    *,
    event_id: str | None = None,
    hash_bloco: str | None = None,
    timeout: int = 20,
) -> None:
    """Espera uma atividade aparecer no resumo da demonstração."""

    esperar_condicao_http(
        f"atividade {tipo} em {url_api}",
        lambda: atividade_presente(url_api, tipo, event_id=event_id, hash_bloco=hash_bloco),
        timeout=timeout,
    )


def esperar_altura(urls: dict[str, str], altura: int, timeout: int = 30) -> None:
    """Espera todos os nós atingirem a mesma altura mínima."""

    def _condicao() -> bool:
        with httpx.Client(timeout=5.0) as cliente:
            for url in urls.values():
                estado = obter_estado(cliente, url)
                if estado.get("altura_cadeia") != altura:
                    return False
        return True

    esperar_condicao_http(f"altura {altura} em todos os nós", _condicao, timeout=timeout)


def esperar_mempool(urls: dict[str, str], quantidade: int, timeout: int = 30) -> None:
    """Espera a mempool dos nós ficar na quantidade desejada."""

    def _condicao() -> bool:
        with httpx.Client(timeout=5.0) as cliente:
            for url in urls.values():
                mempool = obter_mempool(cliente, url)
                if mempool.get("quantidade") != quantidade:
                    return False
        return True

    esperar_condicao_http(
        f"mempool com {quantidade} eventos em todos os nós",
        _condicao,
        timeout=timeout,
    )


def imprimir_estado_nos(cliente: httpx.Client, urls: dict[str, str], titulo: str) -> None:
    """Mostra um resumo curto da cadeia e da mempool em cada nó."""

    print()
    print(f"[Resumo] {titulo}")
    for nome_no, url_api in urls.items():
        estado = obter_estado(cliente, url_api)
        print(
            f"  - {nome_no}: altura={estado['altura_cadeia']} | "
            f"mempool={estado['quantidade_mempool']} | "
            f"tip={encurtar_hash(str(estado['hash_ponta']))}"
        )


def imprimir_bloco(bloco: dict[str, object]) -> None:
    """Mostra os campos mais importantes do bloco minerado."""

    print("[Bloco] resumo:")
    print(
        f"  indice={bloco.get('index')} | minerador={bloco.get('miner_id')} | "
        f"nonce={bloco.get('nonce')} | difficulty={bloco.get('difficulty')}"
    )
    print(
        f"  previous_hash={encurtar_hash(str(bloco.get('previous_hash')))} | "
        f"block_hash={encurtar_hash(str(bloco.get('block_hash')))}"
    )
    print(f"  event_count={bloco.get('event_count')}")


def imprimir_arvore_origem(no_origem: dict[str, object] | None, nivel: int = 0) -> None:
    """Imprime a árvore recursiva de composição."""

    if no_origem is None:
        print("  (árvore vazia)")
        return

    prefixo = "  " * nivel
    evento = no_origem.get("evento", {})
    if isinstance(evento, dict):
        print(
            f"{prefixo}- {evento.get('event_type')} | "
            f"{evento.get('product_id')} | "
            f"status={no_origem.get('status')}"
        )

    insumos = no_origem.get("insumos", [])
    if isinstance(insumos, list):
        for item in insumos:
            if isinstance(item, dict):
                imprimir_arvore_origem(item, nivel + 1)


def construir_eventos() -> dict[str, dict[str, object]]:
    """Monta os eventos usados na demonstração ponta a ponta."""

    return {
        "materia_prima_a": {
            "event_id": "EVT-E2E-001",
            "event_type": "CADASTRAR_MATERIA_PRIMA",
            "entity_kind": "raw_material",
            "product_id": "ACO-LOTE-E2E-01",
            "product_name": "Aço laminado",
            "actor_id": "FORNECEDOR-ACO-CNPJ",
            "actor_role": "FORNECEDOR",
            "timestamp": "2026-04-07T09:00:00Z",
            "input_ids": [],
            "metadata": {"lot_id": "ACO-LOTE-E2E-01", "origem": "Usina A"},
        },
        "materia_prima_b": {
            "event_id": "EVT-E2E-002",
            "event_type": "CADASTRAR_MATERIA_PRIMA",
            "entity_kind": "raw_material",
            "product_id": "BORRACHA-LOTE-E2E-01",
            "product_name": "Borracha vulcanizada",
            "actor_id": "FORNECEDOR-BORRACHA-CNPJ",
            "actor_role": "FORNECEDOR",
            "timestamp": "2026-04-07T09:05:00Z",
            "input_ids": [],
            "metadata": {"lot_id": "BORRACHA-LOTE-E2E-01", "origem": "Planta B"},
        },
        "produto_simples": {
            "event_id": "EVT-E2E-003",
            "event_type": "FABRICAR_PRODUTO_SIMPLES",
            "entity_kind": "simple_product",
            "product_id": "QUADRO-E2E-01",
            "product_name": "Quadro de Bicicleta",
            "actor_id": "FABRICANTE-QUADRO-CNPJ",
            "actor_role": "FABRICANTE",
            "timestamp": "2026-04-07T09:10:00Z",
            "input_ids": ["EVT-E2E-001"],
            "metadata": {"lot_id": "QUADRO-E2E-01", "linha": "Linha Q1"},
        },
        "produto_composto": {
            "event_id": "EVT-E2E-004",
            "event_type": "FABRICAR_PRODUTO_COMPOSTO",
            "entity_kind": "composite_product",
            "product_id": "BICICLETA-E2E-01",
            "product_name": "Bicicleta Urbana",
            "actor_id": "MONTADORA-BIKE-CNPJ",
            "actor_role": "MONTADORA",
            "timestamp": "2026-04-07T09:15:00Z",
            "input_ids": ["EVT-E2E-003", "EVT-E2E-002"],
            "metadata": {"lot_id": "BICICLETA-E2E-01", "linha": "Montagem F1"},
        },
        "conflito_consumo": {
            "event_id": "EVT-E2E-005",
            "event_type": "FABRICAR_PRODUTO_SIMPLES",
            "entity_kind": "simple_product",
            "product_id": "QUADRO-E2E-CONFLITO",
            "product_name": "Quadro Reutilizando Insumo",
            "actor_id": "FABRICANTE-CONFLITO-CNPJ",
            "actor_role": "FABRICANTE",
            "timestamp": "2026-04-07T09:20:00Z",
            "input_ids": ["EVT-E2E-001"],
            "metadata": {"lot_id": "QUADRO-E2E-CONFLITO", "linha": "Linha Q2"},
        },
    }


def validar_regras_do_dominio(eventos: dict[str, dict[str, object]]) -> None:
    """Mostra que os payloads do cenário obedecem ao domínio escolhido."""

    materia_prima = eventos["materia_prima_a"]
    simples = eventos["produto_simples"]
    composto = eventos["produto_composto"]

    assert materia_prima["input_ids"] == []
    assert simples["input_ids"] == ["EVT-E2E-001"]
    assert "EVT-E2E-003" in composto["input_ids"]
    assert "EVT-E2E-002" in composto["input_ids"]

    print("[Domínio] Matéria-prima criada sem input_ids: OK")
    print("[Domínio] Produto simples depende de matéria-prima: OK")
    print("[Domínio] Produto composto depende de produto simples + matéria-prima: OK")


def validar_bloco_minerado(bloco: dict[str, object], previous_hash_esperado: str) -> Block:
    """Valida explicitamente os pontos esperados do bloco minerado."""

    bloco_objeto = bloco_de_dict(bloco)
    assert bloco_objeto is not None
    assert bloco_objeto.previous_hash == previous_hash_esperado
    assert bloco_objeto.possui_pow_valido()
    bloco_json = bloco_para_json(bloco_objeto)
    assert isinstance(bloco_json, str) and bloco_json.startswith("{")

    print("[Blockchain] previous_hash correto: OK")
    print("[Blockchain] Proof of Work válido: OK")
    print(f"[Rede] Bloco serializado para JSON antes do envio: OK ({len(bloco_json)} bytes)")
    return bloco_objeto


def mostrar_logs_recentes(arquivos_log: dict[str, Path]) -> None:
    """Ajuda a depurar a execução quando algo falha."""

    print()
    print("[Depuração] Últimas linhas dos logs dos nós:")
    for nome_no, arquivo in arquivos_log.items():
        print(f"--- {nome_no} | {arquivo} ---")
        if not arquivo.exists():
            print("(sem log)")
            continue
        linhas = arquivo.read_text(encoding="utf-8").splitlines()[-20:]
        for linha in linhas:
            print(linha)


def criar_parser() -> argparse.ArgumentParser:
    """Monta os argumentos da simulação."""

    parser = argparse.ArgumentParser(description="Executa uma simulação ponta a ponta da blockchain.")
    parser.add_argument("--alpha", default="http://127.0.0.1:8001", help="URL da API do nó alpha.")
    parser.add_argument("--beta", default="http://127.0.0.1:8002", help="URL da API do nó beta.")
    parser.add_argument("--gamma", default="http://127.0.0.1:8003", help="URL da API do nó gamma.")
    parser.add_argument("--broker-url", default="localhost:9092", help="Endereço do broker Kafka.")
    parser.add_argument("--usar-ambiente-existente", action="store_true", help="Usa Kafka e nós já iniciados.")
    parser.add_argument("--manter-ambiente", action="store_true", help="Não derruba Kafka e nós no final.")
    parser.add_argument("--dificuldade", type=int, default=2, help="Dificuldade usada nos nós iniciados pelo script.")
    parser.add_argument(
        "--max-eventos-por-bloco",
        type=int,
        default=2,
        help="Quantidade máxima de eventos por bloco nos nós iniciados pelo script.",
    )
    return parser


def main() -> None:
    """Executa a simulação completa do sistema."""

    args = criar_parser().parse_args()
    urls = {
        "node-alpha": args.alpha,
        "node-beta": args.beta,
        "node-gamma": args.gamma,
    }
    processos: list[subprocess.Popen[str]] = []
    arquivos_log: dict[str, Path] = {}
    diretorio_logs: Path | None = None

    try:
        anunciar_etapa(0, "Preparação do ambiente")
        if not args.usar_ambiente_existente:
            portas = {
                "node-alpha": int(args.alpha.rsplit(":", 1)[1]),
                "node-beta": int(args.beta.rsplit(":", 1)[1]),
                "node-gamma": int(args.gamma.rsplit(":", 1)[1]),
            }
            for nome_no, porta in portas.items():
                if not porta_livre("127.0.0.1", porta):
                    raise SystemExit(
                        f"A porta {porta} já está ocupada. Pare o nó existente ou use --usar-ambiente-existente."
                    )

            diretorio_logs = Path(tempfile.mkdtemp(prefix="simulacao_supply_chain_"))
            print(f"[Ambiente] Logs dos nós em: {diretorio_logs}")
            subir_kafka()
            esperar_kafka()

            for nome_no, url_api in urls.items():
                porta_api = int(url_api.rsplit(":", 1)[1])
                observador = nome_no == "node-gamma"
                processo, arquivo_log = iniciar_no(
                    node_id=nome_no,
                    porta_api=porta_api,
                    broker_url=args.broker_url,
                    observador=observador,
                    dificuldade=args.dificuldade,
                    max_eventos_por_bloco=args.max_eventos_por_bloco,
                    diretorio_logs=diretorio_logs,
                )
                processos.append(processo)
                arquivos_log[nome_no] = arquivo_log

            for url_api in urls.values():
                esperar_api(url_api)
        else:
            for url_api in urls.values():
                esperar_api(url_api)

        print("[Ambiente] Aguardando os consumidores entrarem no grupo do Kafka...")
        time.sleep(5)

        with httpx.Client(timeout=10.0) as cliente:
            imprimir_estado_nos(cliente, urls, "Estado inicial dos nós")
            eventos = construir_eventos()
            validar_regras_do_dominio(eventos)

            anunciar_etapa(1, "Cadastro da matéria-prima principal")
            evento_1 = eventos["materia_prima_a"]
            imprimir_json("[Evento criado]", evento_1)
            evento_1_objeto = SupplyChainEvent.de_dict(evento_1)
            assert evento_1_objeto is not None
            evento_1_json = evento_para_json(evento_1_objeto)
            print(f"[Rede] Evento serializado para JSON: {len(evento_1_json)} bytes")
            resposta_1 = postar_evento(cliente, args.alpha, evento_1, propagar_rede=True)
            assert resposta_1["status_code"] == 200
            assert resposta_1["body"]["status"] == "evento_adicionado"
            esperar_mempool(urls, 1)
            esperar_atividade(args.alpha, "evento_proprio_descartado", event_id="EVT-E2E-001")
            esperar_atividade(args.beta, "evento_recebido", event_id="EVT-E2E-001")
            esperar_atividade(args.gamma, "evento_recebido", event_id="EVT-E2E-001")
            imprimir_estado_nos(cliente, urls, "Após o cadastro da matéria-prima principal")

            anunciar_etapa(2, "Cadastro da segunda matéria-prima")
            evento_2 = eventos["materia_prima_b"]
            imprimir_json("[Evento criado]", evento_2)
            resposta_2 = postar_evento(cliente, args.alpha, evento_2, propagar_rede=True)
            assert resposta_2["status_code"] == 200
            assert resposta_2["body"]["status"] == "evento_adicionado"
            esperar_mempool(urls, 2)
            esperar_atividade(args.alpha, "evento_proprio_descartado", event_id="EVT-E2E-002")
            esperar_atividade(args.beta, "evento_recebido", event_id="EVT-E2E-002")
            esperar_atividade(args.gamma, "evento_recebido", event_id="EVT-E2E-002")
            imprimir_estado_nos(cliente, urls, "Após as duas matérias-primas entrarem na mempool")

            anunciar_etapa(3, "Mineração do bloco de matérias-primas")
            cadeia_antes = obter_cadeia(cliente, args.alpha)
            ponta_anterior = cadeia_antes["cadeia_ativa"][-1]["block_hash"]
            resposta_mineracao_1 = minerar(cliente, args.alpha)
            assert resposta_mineracao_1["status_code"] == 200
            assert resposta_mineracao_1["body"]["status"] == "bloco_minerado"
            bloco_1 = resposta_mineracao_1["body"]["bloco"]
            bloco_1_objeto = validar_bloco_minerado(bloco_1, ponta_anterior)
            imprimir_bloco(bloco_1)
            assert bloco_1_objeto.event_count == 2
            esperar_altura(urls, 2)
            esperar_mempool(urls, 0)
            esperar_atividade(args.alpha, "bloco_proprio_descartado", hash_bloco=bloco_1_objeto.block_hash)
            esperar_atividade(args.beta, "bloco_recebido", hash_bloco=bloco_1_objeto.block_hash)
            esperar_atividade(args.gamma, "bloco_recebido", hash_bloco=bloco_1_objeto.block_hash)
            imprimir_estado_nos(cliente, urls, "Após propagação do bloco de matérias-primas")

            anunciar_etapa(4, "Fabricação do produto simples")
            evento_3 = eventos["produto_simples"]
            imprimir_json("[Evento criado]", evento_3)
            resposta_3 = postar_evento(cliente, args.alpha, evento_3, propagar_rede=True)
            assert resposta_3["status_code"] == 200
            assert resposta_3["body"]["status"] == "evento_adicionado"
            esperar_mempool(urls, 1)
            esperar_atividade(args.alpha, "evento_proprio_descartado", event_id="EVT-E2E-003")
            esperar_atividade(args.beta, "evento_recebido", event_id="EVT-E2E-003")
            esperar_atividade(args.gamma, "evento_recebido", event_id="EVT-E2E-003")
            imprimir_estado_nos(cliente, urls, "Após o produto simples entrar na mempool")

            anunciar_etapa(5, "Fabricação do produto composto")
            evento_4 = eventos["produto_composto"]
            imprimir_json("[Evento criado]", evento_4)
            resposta_4 = postar_evento(cliente, args.alpha, evento_4, propagar_rede=True)
            assert resposta_4["status_code"] == 200
            assert resposta_4["body"]["status"] == "evento_adicionado"
            esperar_mempool(urls, 2)
            esperar_atividade(args.alpha, "evento_proprio_descartado", event_id="EVT-E2E-004")
            esperar_atividade(args.beta, "evento_recebido", event_id="EVT-E2E-004")
            esperar_atividade(args.gamma, "evento_recebido", event_id="EVT-E2E-004")
            imprimir_estado_nos(cliente, urls, "Após o produto composto entrar na mempool")

            anunciar_etapa(6, "Mineração do bloco de composição")
            cadeia_antes = obter_cadeia(cliente, args.alpha)
            ponta_anterior = cadeia_antes["cadeia_ativa"][-1]["block_hash"]
            resposta_mineracao_2 = minerar(cliente, args.alpha)
            assert resposta_mineracao_2["status_code"] == 200
            assert resposta_mineracao_2["body"]["status"] == "bloco_minerado"
            bloco_2 = resposta_mineracao_2["body"]["bloco"]
            bloco_2_objeto = validar_bloco_minerado(bloco_2, ponta_anterior)
            imprimir_bloco(bloco_2)
            assert bloco_2_objeto.event_count == 2
            esperar_altura(urls, 3)
            esperar_mempool(urls, 0)
            esperar_atividade(args.alpha, "bloco_proprio_descartado", hash_bloco=bloco_2_objeto.block_hash)
            esperar_atividade(args.beta, "bloco_recebido", hash_bloco=bloco_2_objeto.block_hash)
            esperar_atividade(args.gamma, "bloco_recebido", hash_bloco=bloco_2_objeto.block_hash)
            imprimir_estado_nos(cliente, urls, "Após propagação do bloco de composição")

            anunciar_etapa(7, "Consulta de rastreabilidade recursiva")
            rastreabilidade = obter_rastreabilidade(cliente, args.gamma, "BICICLETA-E2E-01")
            assert rastreabilidade["estado_atual"]["status"] == "confirmado"
            arvore = rastreabilidade["arvore_origem"]
            assert isinstance(arvore, dict)
            assert arvore["evento"]["event_id"] == "EVT-E2E-004"
            assert len(arvore["insumos"]) == 2
            no_simples = next(item for item in arvore["insumos"] if item["evento"]["event_id"] == "EVT-E2E-003")
            no_materia_prima_b = next(item for item in arvore["insumos"] if item["evento"]["event_id"] == "EVT-E2E-002")
            assert no_simples["insumos"][0]["evento"]["event_id"] == "EVT-E2E-001"
            assert no_materia_prima_b["evento"]["event_type"] == "CADASTRAR_MATERIA_PRIMA"
            print("[Rastreabilidade] Árvore de origem do produto final:")
            imprimir_arvore_origem(arvore)

            anunciar_etapa(8, "Tentativa de conflito de consumo de insumo")
            evento_conflito = eventos["conflito_consumo"]
            imprimir_json("[Evento criado]", evento_conflito)
            resposta_conflito = postar_evento(cliente, args.alpha, evento_conflito, propagar_rede=False)
            assert resposta_conflito["status_code"] == 400
            assert resposta_conflito["body"]["status"] == "evento_rejeitado"
            assert resposta_conflito["body"]["motivo"] == "evento_invalido_no_contexto_atual"
            esperar_mempool(urls, 0)
            print("[Regra de consumo] Reutilização do mesmo input_id rejeitada: OK")

            anunciar_etapa(9, "Resumo final da cadeia e da rede")
            imprimir_estado_nos(cliente, urls, "Estado final dos nós")
            for nome_no, url_api in urls.items():
                cadeia = obter_cadeia(cliente, url_api)
                demonstracao = obter_demonstracao(cliente, url_api)
                print(f"[{nome_no}] cadeia ativa:")
                for bloco in cadeia["cadeia_ativa"]:
                    print(
                        f"  bloco #{bloco['index']} | minerador={bloco.get('miner_id')} | "
                        f"hash={encurtar_hash(str(bloco['block_hash']))}"
                    )
                atividades = demonstracao.get("atividades", [])
                if isinstance(atividades, list):
                    print(f"[{nome_no}] atividades recentes:")
                    for atividade in atividades[:5]:
                        if isinstance(atividade, dict):
                            print(
                                f"  - {atividade.get('tipo')} | "
                                f"{atividade.get('descricao')}"
                            )

            print()
            print("[Resultado] Fluxo ponta a ponta concluído com sucesso.")
            print("[Resultado] O sistema demonstrou domínio, mempool, mineração, rede, rastreabilidade e rejeição de conflito.")
            print("[Opcional] Para ver fork e reorganização, rode depois:")
            print(
                "python -m scripts.simular_ataque_gasto_duplo "
                f"--alpha {args.alpha} --beta {args.beta} --gamma {args.gamma}"
            )

    except BaseException as erro:  # noqa: BLE001
        print()
        print(f"[FALHA] A simulação não terminou corretamente: {erro}")
        if arquivos_log:
            mostrar_logs_recentes(arquivos_log)
        raise
    finally:
        if not args.usar_ambiente_existente and not args.manter_ambiente:
            for processo in processos:
                encerrar_processo(processo)
            derrubar_kafka()
            if diretorio_logs is not None and diretorio_logs.exists():
                shutil.rmtree(diretorio_logs, ignore_errors=True)


if __name__ == "__main__":
    main()
