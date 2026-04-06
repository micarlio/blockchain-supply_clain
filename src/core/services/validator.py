"""Servicos de validacao para eventos, blocos e cadeias."""

from __future__ import annotations

from core.config import CoreConfig
from core.models.block import Block
from core.models.event import SupplyChainEvent


def _inteiro_nao_negativo(value: object) -> bool:
    """Retorna `True` quando o valor e um inteiro simples e valido."""

    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _texto_preenchido(value: object) -> bool:
    """No bloco, os campos textuais obrigatorios nao podem vir vazios."""

    return isinstance(value, str) and bool(value)


class Validator:
    """Ponto central de validacao estrutural do core."""

    def __init__(self, config: CoreConfig | None = None) -> None:
        """Guarda a configuracao local usada nas validacoes."""

        self.config = config or CoreConfig()

    def validar_evento(self, event: SupplyChainEvent) -> bool:
        """Evento valido aqui e evento com estrutura minima correta."""

        return isinstance(event, SupplyChainEvent) and event.validar_basico()

    def validar_bloco(self, block: Block, previous_block: Block | None = None) -> bool:
        """Confere estrutura, hashes, PoW e encadeamento do bloco."""

        if not isinstance(block, Block):
            return False

        if not _inteiro_nao_negativo(block.index):
            return False
        if not _inteiro_nao_negativo(block.difficulty):
            return False
        if not _inteiro_nao_negativo(block.nonce):
            return False
        if not _inteiro_nao_negativo(block.event_count):
            return False

        if not _texto_preenchido(block.timestamp):
            return False
        if not _texto_preenchido(block.previous_hash):
            return False
        if not isinstance(block.data_hash, str):
            return False
        if not isinstance(block.block_hash, str):
            return False

        if not isinstance(block.events, list):
            return False
        if block.event_count != len(block.events):
            return False
        if not all(self.validar_evento(event) for event in block.events):
            return False

        if block.data_hash != block.calcular_hash_dados():
            return False
        if block.block_hash != block.calcular_hash_bloco():
            return False
        if not block.possui_pow_valido():
            return False

        if previous_block is None:
            return True

        if not isinstance(previous_block, Block):
            return False
        if block.index != previous_block.index + 1:
            return False
        if block.previous_hash != previous_block.block_hash:
            return False
        if block.difficulty != self.config.difficulty:
            return False

        return True

    def validar_cadeia(self, chain: list[Block]) -> bool:
        """Percorre a cadeia inteira validando bloco por bloco."""

        if not isinstance(chain, list) or not chain:
            return False

        for index, block in enumerate(chain):
            previous_block = None if index == 0 else chain[index - 1]
            if not self.validar_bloco(block, previous_block):
                return False

        return True

    def validate_event(self, event: SupplyChainEvent) -> bool:
        """Alias de compatibilidade para `validar_evento`."""

        return self.validar_evento(event)

    def validate_block(self, block: Block, previous_block: Block | None = None) -> bool:
        """Alias de compatibilidade para `validar_bloco`."""

        return self.validar_bloco(block, previous_block)

    def validate_chain(self, chain: list[Block]) -> bool:
        """Alias de compatibilidade para `validar_cadeia`."""

        return self.validar_cadeia(chain)
