"""Formatacao do resultado final exposto pela API de testes."""

from __future__ import annotations

from typing import Any

from src.testes.models import (
    ScenarioDefinition,
    TestContext,
    TestExecutionOutcome,
    TestResult,
)


def formatar_resultado_teste(
    definition: ScenarioDefinition,
    context: TestContext,
    outcome: TestExecutionOutcome,
) -> TestResult:
    """Consolida definicao, contexto e outcome em um `TestResult`."""

    contexto_base: dict[str, Any] = context.para_dict()
    contexto_base.update(outcome.contexto_relevante)

    resultado_esperado = " ".join(definition.comportamento_esperado)

    return TestResult(
        scenario_id=definition.id,
        scenario_name=definition.nome,
        status_execucao=outcome.status_execucao,
        teste_aprovado=outcome.teste_aprovado,
        resultado_esperado=resultado_esperado,
        resultado_observado=outcome.resultado_observado,
        mensagem_interpretada=outcome.mensagem_interpretada,
        request_enviada=outcome.request_enviada,
        response_recebida=outcome.response_recebida,
        impacto_blockchain=outcome.impacto_blockchain,
        contexto_relevante=contexto_base,
        erro_tecnico=outcome.erro_tecnico,
    )
