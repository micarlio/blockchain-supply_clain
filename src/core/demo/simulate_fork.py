"""Roteiro local para demonstrar fork e convergencia da cadeia."""

from __future__ import annotations

import sys
from pathlib import Path

if __package__ in (None, ""):
    # Isso permite rodar o arquivo direto com `python3 src/core/demo/simulate_fork.py`.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from core.config import CoreConfig
from core.demo.local_node import LocalNode
from core.models.event import SupplyChainEvent


def criar_evento_conflitante(
    event_id: str,
    produto_final: str,
    lote_base: str,
    actor_id: str,
    timestamp: str,
) -> SupplyChainEvent:
    """Cria um evento simples de transformacao para o cenario da demo."""

    return SupplyChainEvent(
        event_id=event_id,
        event_type="TRANSFORM_PRODUCT",
        product_id=produto_final,
        product_name=produto_final,
        actor_id=actor_id,
        actor_role="PRODUCER",
        timestamp=timestamp,
        input_ids=[lote_base],
        metadata={
            "produto_origem": lote_base,
            "descricao": f"Lote {lote_base} usado para gerar {produto_final}",
        },
    )


def montar_nos_para_demo() -> tuple[LocalNode, LocalNode]:
    """Cria dois nos locais para a simulacao."""

    node_a = LocalNode(config=CoreConfig(difficulty=1, node_id="node-a", max_events_per_block=2))
    node_b = LocalNode(config=CoreConfig(difficulty=1, node_id="node-b", max_events_per_block=2))

    node_a.iniciar()
    node_b.iniciar()

    return node_a, node_b


def executar_demo_fork() -> dict[str, object]:
    """Executa um fork simples com conflito adaptado ao supply chain."""

    node_a, node_b = montar_nos_para_demo()

    # Os dois nos partem do mesmo gênesis.
    node_a.adicionar_evento(
        criar_evento_conflitante(
            event_id="evt-a1",
            produto_final="cheese-01",
            lote_base="milk-01",
            actor_id="produtor-a",
            timestamp="2026-04-10T10:00:00Z",
        )
    )
    bloco_a1 = node_a.minerar_pendentes(timestamp="2026-04-10T10:01:00Z")

    # O segundo no monta uma versao conflitante usando o mesmo lote base.
    node_b.adicionar_evento(
        criar_evento_conflitante(
            event_id="evt-b1",
            produto_final="cheese-02",
            lote_base="milk-01",
            actor_id="produtor-b",
            timestamp="2026-04-10T10:00:30Z",
        )
    )
    bloco_b1 = node_b.minerar_pendentes(timestamp="2026-04-10T10:01:30Z")

    status_fork = node_a.receber_bloco(bloco_b1)

    # O no B encontra mais um bloco antes da cadeia do no A crescer.
    node_b.adicionar_evento(
        SupplyChainEvent(
            event_id="evt-b2",
            event_type="TRANSFER_CUSTODY",
            product_id="cheese-02",
            product_name="cheese-02",
            actor_id="distribuidor-b",
            actor_role="DISTRIBUTOR",
            timestamp="2026-04-10T10:02:00Z",
            input_ids=["cheese-02"],
            metadata={"destino": "centro-b"},
        )
    )
    bloco_b2 = node_b.minerar_pendentes(timestamp="2026-04-10T10:02:30Z")

    status_reorganizacao = node_a.receber_bloco(bloco_b2)

    return {
        "bloco_a1": bloco_a1,
        "bloco_b1": bloco_b1,
        "bloco_b2": bloco_b2,
        "status_fork": status_fork,
        "status_reorganizacao": status_reorganizacao,
        "resumo_node_a": node_a.resumo(),
        "resumo_node_b": node_b.resumo(),
    }


def main() -> None:
    """Executa a demo e imprime um resumo facil de apresentar."""

    resultado = executar_demo_fork()

    print("Demo local de fork e convergencia")
    print()
    print("1. Node A minerou um bloco usando milk-01 para gerar cheese-01.")
    print("2. Node B minerou um bloco concorrente usando milk-01 para gerar cheese-02.")
    print(f"3. Quando o bloco de B chegou em A: {resultado['status_fork']}")
    print(f"4. Depois que B minerou mais um bloco: {resultado['status_reorganizacao']}")
    print()
    print("Resumo final do node A:")
    print(resultado["resumo_node_a"])
    print()
    print("Resumo final do node B:")
    print(resultado["resumo_node_b"])


if __name__ == "__main__":
    main()
