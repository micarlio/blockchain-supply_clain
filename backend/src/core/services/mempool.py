"""Mempool em memoria para eventos pendentes."""

from __future__ import annotations

from copy import deepcopy

from src.core.models.event import SupplyChainEvent


class Mempool:
    """Mantem eventos pendentes em ordem de chegada."""

    def __init__(self) -> None:
        """Comeca vazia e vai enchendo conforme chegam eventos."""

        self._eventos_por_id: dict[str, SupplyChainEvent] = {}

    def adicionar_evento(self, event: SupplyChainEvent) -> bool:
        """Adiciona o evento se ele estiver valido e ainda nao existir."""

        if not isinstance(event, SupplyChainEvent):
            return False

        if not event.validar_basico():
            return False

        if event.event_id in self._eventos_por_id:
            return False

        self._eventos_por_id[event.event_id] = deepcopy(event)
        return True

    def contem_evento(self, event_id: str) -> bool:
        """Confere se o id do evento ainda esta pendente."""

        if not isinstance(event_id, str):
            return False

        return event_id in self._eventos_por_id

    def obter_eventos_pendentes(self, limite: int) -> list[SupplyChainEvent]:
        """Retorna os proximos eventos respeitando a ordem FIFO."""

        if not isinstance(limite, int) or isinstance(limite, bool):
            return []

        if limite <= 0:
            return []

        eventos = list(self._eventos_por_id.values())[:limite]
        return deepcopy(eventos)

    def remover_eventos(self, event_ids: list[str]) -> None:
        """Remove os eventos que ja entraram em algum bloco."""

        if not isinstance(event_ids, list):
            return

        for event_id in event_ids:
            if isinstance(event_id, str):
                self._eventos_por_id.pop(event_id, None)

    def reinserir_eventos(self, events: list[SupplyChainEvent]) -> None:
        """Reinsere eventos no final da fila, ignorando duplicados."""

        if not isinstance(events, list):
            return

        for event in events:
            self.adicionar_evento(event)

    def quantidade_pendente(self) -> int:
        """Quantidade atual de eventos na mempool."""

        return len(self._eventos_por_id)

    def listar_event_ids(self) -> list[str]:
        """Lista os ids na ordem atual da fila."""

        return list(self._eventos_por_id.keys())

    def limpar(self) -> None:
        """Descarta todos os eventos pendentes guardados em memoria."""

        self._eventos_por_id = {}

    def add_event(self, event: SupplyChainEvent) -> bool:
        """Alias de compatibilidade para `adicionar_evento`."""

        return self.adicionar_evento(event)

    def has_event(self, event_id: str) -> bool:
        """Alias de compatibilidade para `contem_evento`."""

        return self.contem_evento(event_id)

    def get_pending_events(self, limit: int) -> list[SupplyChainEvent]:
        """Alias de compatibilidade para `obter_eventos_pendentes`."""

        return self.obter_eventos_pendentes(limit)

    def remove_events(self, event_ids: list[str]) -> None:
        """Alias de compatibilidade para `remover_eventos`."""

        self.remover_eventos(event_ids)

    def reinsert_events(self, events: list[SupplyChainEvent]) -> None:
        """Alias de compatibilidade para `reinserir_eventos`."""

        self.reinserir_eventos(events)

    def __len__(self) -> int:
        """Permite usar `len(mempool)`."""

        return self.quantidade_pendente()
