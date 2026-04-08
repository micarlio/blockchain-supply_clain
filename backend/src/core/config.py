"""Objetos de configuracao compartilhados pelo core."""

from dataclasses import dataclass


@dataclass(slots=True)
class CoreConfig:
    """Configuracao em tempo de execucao para um no local da blockchain."""

    difficulty: int = 4
    max_events_per_block: int = 5
    node_id: str = "node-1"
