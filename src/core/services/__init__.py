"""Servicos do core."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = ["Blockchain", "Consensus", "Mempool", "Miner", "Validator"]

_MAPA_IMPORTS = {
    "Blockchain": ("core.services.blockchain", "Blockchain"),
    "Consensus": ("core.services.consensus", "Consensus"),
    "Mempool": ("core.services.mempool", "Mempool"),
    "Miner": ("core.services.miner", "Miner"),
    "Validator": ("core.services.validator", "Validator"),
}


def __getattr__(name: str) -> Any:
    """Importa sob demanda para evitar ciclo entre os modulos."""

    if name not in _MAPA_IMPORTS:
        raise AttributeError(f"module 'core.services' has no attribute {name!r}")

    module_name, attr_name = _MAPA_IMPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
