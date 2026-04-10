"""Script para subir um nó local com Kafka e API HTTP."""

from __future__ import annotations

import argparse
import logging
import os

import uvicorn

from src.api_http import NoAplicacaoBlockchain, criar_aplicacao_http
from src.core.config import (
    GLOBAL_MAX_EVENTS_PER_BLOCK,
    GLOBAL_POW_DIFFICULTY,
    PAPEL_NO_CONTROLE,
    PAPEL_NO_OBSERVADOR,
    construir_config_no_por_perfil,
    obter_perfil_no_padrao,
)

logging.disable(logging.CRITICAL)


def _inteiro_env(nome: str, fallback: int) -> int:
    """Le um inteiro do ambiente sem espalhar parse pelo script."""

    valor = os.getenv(nome)
    if valor is None:
        return fallback

    try:
        return int(valor)
    except ValueError:
        return fallback


def criar_parser() -> argparse.ArgumentParser:
    """Monta o parser de argumentos do script."""

    perfil_default = "node-alpha"
    perfil_padrao = obter_perfil_no_padrao(perfil_default)
    parser = argparse.ArgumentParser(
        description="Inicia um nó da blockchain com Kafka e API HTTP."
    )
    parser.add_argument("node_id", help="Identificador do nó.")
    parser.add_argument(
        "--observador", action="store_true", help="Sobe o nó sem mineração automática."
    )
    parser.add_argument(
        "--observer",
        action="store_true",
        help="Alias de compatibilidade para --observador.",
    )
    parser.add_argument(
        "--porta-api",
        type=int,
        default=None,
        help=(
            "Porta da API HTTP. Se omitida, usa a porta do perfil do nó "
            f"(ex.: {perfil_padrao.api_port if perfil_padrao else 8001} para {perfil_default})."
        ),
    )
    parser.add_argument("--host-api", default="0.0.0.0", help="Host da API HTTP.")
    parser.add_argument(
        "--broker-url", default="localhost:9092", help="Endereço do broker Kafka."
    )
    parser.add_argument(
        "--sem-mineracao-automatica",
        action="store_true",
        help="Mantém o nó minerador ligado, mas sem loop automático de mineração.",
    )
    parser.add_argument(
        "--dificuldade",
        type=int,
        default=None,
        help="Dificuldade global do PoW usada por toda a rede.",
    )
    parser.add_argument(
        "--max-eventos-por-bloco",
        type=int,
        default=None,
        help="Quantidade máxima de eventos por bloco.",
    )
    parser.add_argument(
        "--intervalo-mineracao-segundos",
        type=float,
        default=None,
        help="Intervalo entre ciclos automáticos de mineração do nó.",
    )
    parser.add_argument(
        "--tentativas-nonce-por-ciclo",
        type=int,
        default=None,
        help="Quantidade de nonces testados por ciclo automático para simular hash power.",
    )
    return parser


def main():
    """Ponto de entrada do script."""

    parser = criar_parser()
    args = parser.parse_args()

    dificuldade_global = args.dificuldade
    if dificuldade_global is None:
        dificuldade_global = _inteiro_env(
            "NETWORK_POW_DIFFICULTY",
            GLOBAL_POW_DIFFICULTY,
        )

    max_eventos_por_bloco = args.max_eventos_por_bloco
    if max_eventos_por_bloco is None:
        max_eventos_por_bloco = _inteiro_env(
            "NETWORK_MAX_EVENTS_PER_BLOCK",
            GLOBAL_MAX_EVENTS_PER_BLOCK,
        )

    perfil_padrao = obter_perfil_no_padrao(args.node_id)
    config = construir_config_no_por_perfil(
        args.node_id,
        difficulty=dificuldade_global,
        max_events_per_block=max_eventos_por_bloco,
    )

    modo_observador = args.observador or args.observer or config.observer_mode
    iniciar_mineracao_automatica = (
        config.auto_mining_enabled
        and not args.sem_mineracao_automatica
        and not modo_observador
    )
    if modo_observador:
        config.node_role = PAPEL_NO_OBSERVADOR
    elif not iniciar_mineracao_automatica and config.node_role != PAPEL_NO_OBSERVADOR:
        config.node_role = PAPEL_NO_CONTROLE

    config.observer_mode = modo_observador
    config.auto_mining_enabled = iniciar_mineracao_automatica

    if args.intervalo_mineracao_segundos is not None:
        config.mining_cycle_interval_seconds = args.intervalo_mineracao_segundos
    if args.tentativas_nonce_por_ciclo is not None:
        config.nonce_attempts_per_cycle = args.tentativas_nonce_por_ciclo

    porta_api = args.porta_api
    if porta_api is None:
        porta_api = perfil_padrao.api_port if perfil_padrao is not None else 8001

    no_aplicacao = NoAplicacaoBlockchain(
        config=config,
        url_broker=args.broker_url,
        modo_observador=modo_observador,
        iniciar_mineracao_automatica=iniciar_mineracao_automatica,
    )
    no_aplicacao.iniciar()

    aplicacao = criar_aplicacao_http(no_aplicacao)

    if modo_observador:
        print(f"[Nó] {args.node_id} iniciado em modo observador.")
    else:
        if not iniciar_mineracao_automatica:
            print(f"[Nó] {args.node_id} iniciado em modo controle manual.")
        else:
            print(f"[Nó] {args.node_id} iniciado em modo minerador.")

    print(f"[PoW] Dificuldade global da rede: {config.global_difficulty}")
    print(
        "[Mineração] "
        f"perfil={config.mining_profile} | "
        f"intervalo={config.mining_cycle_interval_seconds}s | "
        f"tentativas_por_ciclo={config.nonce_attempts_per_cycle}"
    )
    print(f"[API] Escutando em http://{args.host_api}:{porta_api}")
    print("[API] Pressione Ctrl+C para parar.")

    uvicorn.run(aplicacao, host=args.host_api, port=porta_api, log_level="warning")


if __name__ == "__main__":
    main()
