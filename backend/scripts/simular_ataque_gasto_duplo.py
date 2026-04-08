"""Simula um cenário simples de gasto duplo adaptado à composição produtiva."""

from __future__ import annotations

import argparse
import threading
import time

import httpx

from src.core.models.dominio import (
    ENTIDADE_MATERIA_PRIMA,
    ENTIDADE_PRODUTO_COMPOSTO,
    ENTIDADE_PRODUTO_SIMPLES,
    EVENTO_CADASTRAR_MATERIA_PRIMA,
    EVENTO_FABRICAR_PRODUTO_COMPOSTO,
    EVENTO_FABRICAR_PRODUTO_SIMPLES,
    PAPEL_FABRICANTE,
    PAPEL_FORNECEDOR,
    PAPEL_MONTADORA,
)


def _post_evento(cliente: httpx.Client, url_api: str, evento: dict[str, object], *, propagar_rede: bool) -> None:
    """Envia um evento para a API e mostra o resultado."""

    resposta = cliente.post(
        f"{url_api.rstrip('/')}/eventos",
        params={"propagar_rede": "true" if propagar_rede else "false"},
        json=evento,
    )
    print(f"[Ataque] POST {evento['event_id']} em {url_api}: {resposta.status_code} | {resposta.text}")


def _minerar(cliente: httpx.Client, url_api: str) -> None:
    """Aciona a mineração manual de um nó."""

    resposta = cliente.post(f"{url_api.rstrip('/')}/demonstracao/minerar")
    print(f"[Ataque] Minerar em {url_api}: {resposta.status_code} | {resposta.text}")


def _esperar_altura(cliente: httpx.Client, url_api: str, altura_esperada: int, tentativas: int = 20) -> bool:
    """Espera a cadeia atingir uma altura mínima."""

    for _ in range(tentativas):
        resposta = cliente.get(f"{url_api.rstrip('/')}/estado")
        if resposta.is_success:
            altura = resposta.json().get("altura_cadeia", 0)
            if isinstance(altura, int) and altura >= altura_esperada:
                return True
        time.sleep(1)

    return False


def montar_eventos_conflitantes() -> tuple[dict[str, object], dict[str, object], dict[str, object], dict[str, object]]:
    """Prepara a matéria-prima base e os dois ramos conflitantes."""

    materia_prima = {
        "event_id": "EVT-ATAQUE-001",
        "event_type": EVENTO_CADASTRAR_MATERIA_PRIMA,
        "product_id": "ACO-LOTE-01",
        "product_name": "Aço laminado",
        "entity_kind": ENTIDADE_MATERIA_PRIMA,
        "actor_id": "FORNECEDOR-PRIMARIO-CNPJ",
        "actor_role": PAPEL_FORNECEDOR,
        "timestamp": "2026-04-07T12:00:00Z",
        "input_ids": [],
        "metadata": {
            "lot_id": "ACO-LOTE-01",
            "categoria_insumo": "aco",
        },
    }
    produto_alpha = {
        "event_id": "EVT-ATAQUE-002-A",
        "event_type": EVENTO_FABRICAR_PRODUTO_SIMPLES,
        "product_id": "CHAPA-ALPHA-01",
        "product_name": "Chapa Alpha",
        "entity_kind": ENTIDADE_PRODUTO_SIMPLES,
        "actor_id": "FABRICANTE-ALPHA-CNPJ",
        "actor_role": PAPEL_FABRICANTE,
        "timestamp": "2026-04-07T12:05:00Z",
        "input_ids": ["EVT-ATAQUE-001"],
        "metadata": {
            "lot_id": "CHAPA-ALPHA-01",
            "linha": "prensagem-alpha",
        },
    }
    produto_beta = {
        "event_id": "EVT-ATAQUE-002-B",
        "event_type": EVENTO_FABRICAR_PRODUTO_SIMPLES,
        "product_id": "CHAPA-BETA-01",
        "product_name": "Chapa Beta",
        "entity_kind": ENTIDADE_PRODUTO_SIMPLES,
        "actor_id": "FABRICANTE-BETA-CNPJ",
        "actor_role": PAPEL_FABRICANTE,
        "timestamp": "2026-04-07T12:05:30Z",
        "input_ids": ["EVT-ATAQUE-001"],
        "metadata": {
            "lot_id": "CHAPA-BETA-01",
            "linha": "prensagem-beta",
        },
    }
    composto_alpha = {
        "event_id": "EVT-ATAQUE-003-A",
        "event_type": EVENTO_FABRICAR_PRODUTO_COMPOSTO,
        "product_id": "BICICLETA-ALPHA-01",
        "product_name": "Bicicleta Alpha",
        "entity_kind": ENTIDADE_PRODUTO_COMPOSTO,
        "actor_id": "MONTADORA-ALPHA-CNPJ",
        "actor_role": PAPEL_MONTADORA,
        "timestamp": "2026-04-07T12:10:00Z",
        "input_ids": ["EVT-ATAQUE-002-A"],
        "metadata": {
            "lot_id": "BICICLETA-ALPHA-01",
            "linha": "montagem-alpha",
        },
    }
    return materia_prima, produto_alpha, produto_beta, composto_alpha


def criar_parser() -> argparse.ArgumentParser:
    """Monta o parser do script."""

    parser = argparse.ArgumentParser(description="Simula um ataque de gasto duplo com três nós.")
    parser.add_argument("--alpha", default="http://localhost:8001", help="URL da API do nó alpha.")
    parser.add_argument("--beta", default="http://localhost:8002", help="URL da API do nó beta.")
    parser.add_argument("--gamma", default="http://localhost:8003", help="URL da API do nó gamma.")
    return parser


def main():
    """Executa o cenário de fork e reorganização."""

    parser = criar_parser()
    args = parser.parse_args()
    materia_prima, produto_alpha, produto_beta, composto_alpha = montar_eventos_conflitantes()

    with httpx.Client(timeout=10.0) as cliente:
        print("[Ataque] Etapa 1: registrando a matéria-prima base no nó alpha.")
        _post_evento(cliente, args.alpha, materia_prima, propagar_rede=True)
        _minerar(cliente, args.alpha)

        if not _esperar_altura(cliente, args.beta, 2):
            print("[Ataque] O nó beta não recebeu o bloco raiz a tempo.")
            return

        if not _esperar_altura(cliente, args.gamma, 2):
            print("[Ataque] O nó gamma não recebeu o bloco raiz a tempo.")
            return

        print("[Ataque] Etapa 2: fabricando dois itens concorrentes usando o mesmo insumo.")
        _post_evento(cliente, args.alpha, produto_alpha, propagar_rede=False)
        _post_evento(cliente, args.beta, produto_beta, propagar_rede=False)

        print("[Ataque] Etapa 3: minerando os dois ramos quase ao mesmo tempo.")
        thread_alpha = threading.Thread(target=_minerar, args=(cliente, args.alpha))
        thread_beta = threading.Thread(target=_minerar, args=(cliente, args.beta))
        thread_alpha.start()
        thread_beta.start()
        thread_alpha.join()
        thread_beta.join()
        time.sleep(3)

        print("[Ataque] Etapa 4: estendendo o ramo alpha com um produto composto.")
        _post_evento(cliente, args.alpha, composto_alpha, propagar_rede=False)
        _minerar(cliente, args.alpha)
        time.sleep(3)

        print("[Ataque] Estado final dos nós:")
        for nome_no, url_api in (("alpha", args.alpha), ("beta", args.beta), ("gamma", args.gamma)):
            resposta_estado = cliente.get(f"{url_api.rstrip('/')}/estado")
            resposta_demo = cliente.get(f"{url_api.rstrip('/')}/demonstracao")
            resposta_rastreio = cliente.get(f"{url_api.rstrip('/')}/rastreabilidade/BICICLETA-ALPHA-01")
            print(f"[{nome_no}] estado: {resposta_estado.text}")
            print(f"[{nome_no}] demonstracao: {resposta_demo.text}")
            print(f"[{nome_no}] rastreabilidade: {resposta_rastreio.text}")


if __name__ == "__main__":
    main()
