"""Script para subir um nó local com Kafka e API HTTP."""

from __future__ import annotations

import argparse
import logging

import uvicorn

from src.api_http import NoAplicacaoBlockchain, criar_aplicacao_http
from src.core.config import CoreConfig

logging.disable(logging.CRITICAL)


def criar_parser() -> argparse.ArgumentParser:
    """Monta o parser de argumentos do script."""

    parser = argparse.ArgumentParser(description="Inicia um nó da blockchain com Kafka e API HTTP.")
    parser.add_argument("node_id", help="Identificador do nó.")
    parser.add_argument("--observador", action="store_true", help="Sobe o nó sem mineração automática.")
    parser.add_argument("--observer", action="store_true", help="Alias de compatibilidade para --observador.")
    parser.add_argument("--porta-api", type=int, default=8001, help="Porta da API HTTP.")
    parser.add_argument("--host-api", default="0.0.0.0", help="Host da API HTTP.")
    parser.add_argument("--broker-url", default="localhost:9092", help="Endereço do broker Kafka.")
    parser.add_argument(
        "--sem-mineracao-automatica",
        action="store_true",
        help="Mantém o nó minerador ligado, mas sem loop automático de mineração.",
    )
    parser.add_argument("--dificuldade", type=int, default=4, help="Dificuldade local do nó.")
    parser.add_argument(
        "--max-eventos-por-bloco",
        type=int,
        default=4,
        help="Quantidade máxima de eventos por bloco.",
    )
    return parser


def main():
    """Ponto de entrada do script."""

    parser = criar_parser()
    args = parser.parse_args()

    modo_observador = args.observador or args.observer
    config = CoreConfig(
        node_id=args.node_id,
        difficulty=args.dificuldade,
        max_events_per_block=args.max_eventos_por_bloco,
    )
    no_aplicacao = NoAplicacaoBlockchain(
        config=config,
        url_broker=args.broker_url,
        modo_observador=modo_observador,
        iniciar_mineracao_automatica=not args.sem_mineracao_automatica,
    )
    no_aplicacao.iniciar()

    aplicacao = criar_aplicacao_http(no_aplicacao)

    if modo_observador:
        print(f"[Nó] {args.node_id} iniciado em modo observador.")
    else:
        if args.sem_mineracao_automatica:
            print(f"[Nó] {args.node_id} iniciado em modo controle manual.")
        else:
            print(f"[Nó] {args.node_id} iniciado em modo minerador.")

    print(f"[API] Escutando em http://{args.host_api}:{args.porta_api}")
    print("[API] Pressione Ctrl+C para parar.")

    uvicorn.run(aplicacao, host=args.host_api, port=args.porta_api, log_level="warning")


if __name__ == "__main__":
    main()
