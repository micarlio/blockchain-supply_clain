"""Modelos de dados do core."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = ["Block", "SupplyChainEvent"]

_MAPA_IMPORTS = {
    "Block": ("core.models.block", "Block"),
    "SupplyChainEvent": ("core.models.event", "SupplyChainEvent"),
}


def __getattr__(name: str) -> Any:
    """Importa sob demanda para evitar ciclo entre os modulos."""

    if name not in _MAPA_IMPORTS:
        raise AttributeError(f"module 'core.models' has no attribute {name!r}")

    module_name, attr_name = _MAPA_IMPORTS[name]
    module = import_module(module_name)
    return getattr(module, attr_name)
