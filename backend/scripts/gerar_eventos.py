"""Gerador reproduzível de eventos para a API HTTP do projeto."""

from __future__ import annotations

import argparse
import random
import time
from datetime import datetime, timedelta, timezone

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

MATERIAS_PRIMAS = (
    ("ALGODAO", "Algodão in natura"),
    ("TINTA", "Tinta têxtil"),
    ("ACO", "Aço laminado"),
    ("BORRACHA", "Borracha vulcanizada"),
)

PRODUTOS_SIMPLES = (
    ("TECIDO", "Tecido Cru"),
    ("CHAPA", "Chapa Estrutural"),
    ("PNEU", "Pneu Básico"),
)

PRODUTOS_COMPOSTOS = (
    ("CAMISA", "Camisa Básica"),
    ("BICICLETA", "Bicicleta Urbana"),
    ("MOCHILA", "Mochila Escolar"),
)

FORNECEDORES = (
    "FORNECEDOR-SERRA-CNPJ",
    "FORNECEDOR-VALE-CNPJ",
    "COOPERATIVA-PRIMARIA-CNPJ",
)

FABRICANTES = (
    "FABRICANTE-TECIDOS-CNPJ",
    "FABRICANTE-ESTRUTURAS-CNPJ",
    "FABRICANTE-COMPONENTES-CNPJ",
)

MONTADORAS = (
    "MONTADORA-FINAL-CNPJ",
    "INDUSTRIA-MONTAGEM-CNPJ",
    "MONTADORA-LINHA-2-CNPJ",
)


def _timestamp_deterministico(indice: int) -> str:
    """Gera horários previsíveis para que a seed reproduza a mesma sequência."""

    base = datetime(2026, 1, 10, 8, 0, 0, tzinfo=timezone.utc)
    instante = base + timedelta(minutes=indice)
    return instante.isoformat().replace("+00:00", "Z")


def montar_fluxo_eventos(numero_fluxo: int, gerador: random.Random) -> list[dict[str, object]]:
    """Monta um fluxo de composição: insumos -> produto simples -> produto composto."""

    codigo_materia_1, nome_materia_1 = gerador.choice(MATERIAS_PRIMAS)
    codigo_materia_2, nome_materia_2 = gerador.choice(MATERIAS_PRIMAS)
    codigo_simples, nome_simples = gerador.choice(PRODUTOS_SIMPLES)
    codigo_composto, nome_composto = gerador.choice(PRODUTOS_COMPOSTOS)
    fornecedor_1 = gerador.choice(FORNECEDORES)
    fornecedor_2 = gerador.choice(FORNECEDORES)
    fabricante = gerador.choice(FABRICANTES)
    montadora = gerador.choice(MONTADORAS)

    sufixo = f"{numero_fluxo:04d}"
    materia_1_id = f"{codigo_materia_1}-LOTE-{sufixo}-A"
    materia_2_id = f"{codigo_materia_2}-LOTE-{sufixo}-B"
    produto_simples_id = f"{codigo_simples}-LOTE-{sufixo}"
    produto_composto_id = f"{codigo_composto}-LOTE-{sufixo}"
    evento_materia_1 = f"EVT-{sufixo}-01"
    evento_materia_2 = f"EVT-{sufixo}-02"
    evento_simples = f"EVT-{sufixo}-03"
    evento_composto = f"EVT-{sufixo}-04"

    return [
        {
            "event_id": evento_materia_1,
            "event_type": EVENTO_CADASTRAR_MATERIA_PRIMA,
            "product_id": materia_1_id,
            "product_name": nome_materia_1,
            "entity_kind": ENTIDADE_MATERIA_PRIMA,
            "actor_id": fornecedor_1,
            "actor_role": PAPEL_FORNECEDOR,
            "timestamp": _timestamp_deterministico((numero_fluxo * 4) - 3),
            "input_ids": [],
            "metadata": {
                "lot_id": materia_1_id,
                "categoria_insumo": codigo_materia_1.lower(),
            },
        },
        {
            "event_id": evento_materia_2,
            "event_type": EVENTO_CADASTRAR_MATERIA_PRIMA,
            "product_id": materia_2_id,
            "product_name": nome_materia_2,
            "entity_kind": ENTIDADE_MATERIA_PRIMA,
            "actor_id": fornecedor_2,
            "actor_role": PAPEL_FORNECEDOR,
            "timestamp": _timestamp_deterministico((numero_fluxo * 4) - 2),
            "input_ids": [],
            "metadata": {
                "lot_id": materia_2_id,
                "categoria_insumo": codigo_materia_2.lower(),
            },
        },
        {
            "event_id": evento_simples,
            "event_type": EVENTO_FABRICAR_PRODUTO_SIMPLES,
            "product_id": produto_simples_id,
            "product_name": nome_simples,
            "entity_kind": ENTIDADE_PRODUTO_SIMPLES,
            "actor_id": fabricante,
            "actor_role": PAPEL_FABRICANTE,
            "timestamp": _timestamp_deterministico((numero_fluxo * 4) - 1),
            "input_ids": [evento_materia_1],
            "metadata": {
                "lot_id": produto_simples_id,
                "linha": "fabricacao-simples",
            },
        },
        {
            "event_id": evento_composto,
            "event_type": EVENTO_FABRICAR_PRODUTO_COMPOSTO,
            "product_id": produto_composto_id,
            "product_name": nome_composto,
            "entity_kind": ENTIDADE_PRODUTO_COMPOSTO,
            "actor_id": montadora,
            "actor_role": PAPEL_MONTADORA,
            "timestamp": _timestamp_deterministico(numero_fluxo * 4),
            "input_ids": [evento_simples, evento_materia_2],
            "metadata": {
                "lot_id": produto_composto_id,
                "linha": "montagem-final",
            },
        },
    ]


def gerar_eventos_aleatorios(seed: int, quantidade: int) -> list[dict[str, object]]:
    """Gera uma sequência pseudoaleatória, mas sempre válida e reproduzível."""

    gerador = random.Random(seed)
    eventos: list[dict[str, object]] = []
    numero_fluxo = 1

    while len(eventos) < quantidade:
        eventos.extend(montar_fluxo_eventos(numero_fluxo, gerador))
        numero_fluxo += 1

    return eventos[:quantidade]


def enviar_eventos_para_api(
    *,
    url_api: str,
    eventos: list[dict[str, object]],
    intervalo: float,
) -> None:
    """Envia os eventos gerados para a API HTTP do nó escolhido."""

    with httpx.Client(timeout=10.0) as cliente:
        for evento in eventos:
            resposta = cliente.post(f"{url_api.rstrip('/')}/eventos", json=evento)
            if resposta.is_success:
                print(f"[Gerador] Evento enviado: {evento['event_id']} | {evento['event_type']}")
            else:
                print(f"[Gerador] Evento rejeitado: {evento['event_id']} | {resposta.text}")

            if intervalo > 0:
                time.sleep(intervalo)


def criar_parser() -> argparse.ArgumentParser:
    """Monta o parser do script."""

    parser = argparse.ArgumentParser(description="Gera eventos válidos e reproduzíveis para a API.")
    parser.add_argument("--url-api", required=True, help="URL base da API do nó.")
    parser.add_argument("--seed", type=int, default=42, help="Seed do gerador pseudoaleatório.")
    parser.add_argument("--quantidade", type=int, default=12, help="Quantidade total de eventos.")
    parser.add_argument("--intervalo", type=float, default=0.5, help="Pausa entre cada envio.")
    return parser


def main():
    """Ponto de entrada do gerador."""

    parser = criar_parser()
    args = parser.parse_args()

    eventos = gerar_eventos_aleatorios(args.seed, args.quantidade)
    print(f"[Gerador] Iniciando envio de {len(eventos)} eventos para {args.url_api}")
    print(f"[Gerador] Seed usada: {args.seed}")
    enviar_eventos_para_api(
        url_api=args.url_api,
        eventos=eventos,
        intervalo=args.intervalo,
    )


if __name__ == "__main__":
    main()
