"""Regras de consenso para comparacao entre cadeias."""

from __future__ import annotations

from copy import deepcopy

from src.core.models.block import Block


class Consensus:
    """Escolhe a melhor cadeia pelo trabalho acumulado."""

    def obter_trabalho_acumulado(self, chain: list[Block]) -> int:
        """Soma o trabalho dos blocos nao gênesis da cadeia."""

        if not isinstance(chain, list):
            return 0

        trabalho_total = 0
        for bloco in chain[1:]:
            trabalho_total += 2 ** bloco.difficulty

        return trabalho_total

    def comparar_cadeias(self, current_chain: list[Block], candidate_chain: list[Block]) -> int:
        """Compara a cadeia atual com uma cadeia candidata."""

        trabalho_atual = self.obter_trabalho_acumulado(current_chain)
        trabalho_candidato = self.obter_trabalho_acumulado(candidate_chain)

        if trabalho_candidato > trabalho_atual:
            return 1
        if trabalho_candidato < trabalho_atual:
            return -1
        return 0

    def escolher_cadeia(self, current_chain: list[Block], candidate_chain: list[Block]) -> list[Block]:
        """Escolhe a cadeia vencedora e devolve uma copia dela."""

        if self.comparar_cadeias(current_chain, candidate_chain) == 1:
            return deepcopy(candidate_chain)

        return deepcopy(current_chain)

    def choose_chain(self, current_chain: list[Block], candidate_chain: list[Block]) -> list[Block]:
        """Alias de compatibilidade para `escolher_cadeia`."""

        return self.escolher_cadeia(current_chain, candidate_chain)

    def compare_chains(self, current_chain: list[Block], candidate_chain: list[Block]) -> int:
        """Alias de compatibilidade para `comparar_cadeias`."""

        return self.comparar_cadeias(current_chain, candidate_chain)
