"""Registry central dos cenarios de teste disponiveis."""

from __future__ import annotations

from src.testes.scenarios.ataque_51 import Ataque51SimuladoScenario
from src.testes.scenarios.double_spend_adaptado import DoubleSpendAdaptadoScenario


class ScenarioRegistry:
    """Mantem o catalogo de cenarios disponiveis no backend."""

    def __init__(self) -> None:
        self._cenarios = {
            Ataque51SimuladoScenario.definition.id: Ataque51SimuladoScenario(),
            DoubleSpendAdaptadoScenario.definition.id: DoubleSpendAdaptadoScenario(),
        }

    def listar(self) -> list[object]:
        """Lista os cenarios registrados em ordem estavel."""

        return [self._cenarios[chave] for chave in sorted(self._cenarios.keys())]

    def obter(self, scenario_id: str):
        """Retorna o cenario registrado para o id informado."""

        return self._cenarios.get(scenario_id)
