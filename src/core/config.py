"""Shared configuration objects for the core module."""

from dataclasses import dataclass


@dataclass(slots=True)
class CoreConfig:
    """Runtime configuration for a local blockchain node."""

    difficulty: int = 4
    max_events_per_block: int = 5
    node_id: str = "node-1"

