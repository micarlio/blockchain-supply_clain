"""Utilitarios de serializacao para integracao via transporte."""

from core.serialization.json_codec import (
    block_from_dict,
    block_from_json,
    block_to_dict,
    block_to_json,
    bloco_de_dict,
    bloco_de_json,
    bloco_para_dict,
    bloco_para_json,
    event_from_dict,
    event_from_json,
    event_to_dict,
    event_to_json,
    evento_de_dict,
    evento_de_json,
    evento_para_dict,
    evento_para_json,
)

__all__ = [
    "bloco_de_dict",
    "bloco_de_json",
    "bloco_para_dict",
    "bloco_para_json",
    "evento_de_dict",
    "evento_de_json",
    "evento_para_dict",
    "evento_para_json",
    "block_from_dict",
    "block_from_json",
    "block_to_dict",
    "block_to_json",
    "event_from_dict",
    "event_from_json",
    "event_to_dict",
    "event_to_json",
]
