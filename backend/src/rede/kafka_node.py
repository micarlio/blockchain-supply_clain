"""Alias de compatibilidade para o modulo `no_kafka`."""

from src.rede.no_kafka import NoConsumidor, NoProdutor, NodeConsumer, NodeProducer

__all__ = ["NoProdutor", "NoConsumidor", "NodeProducer", "NodeConsumer"]
