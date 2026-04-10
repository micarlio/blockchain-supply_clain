"""Executor central do módulo de testes."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.testes.registry import ScenarioRegistry
from src.testes.utils.context_builder import ScenarioContextBuilder
from src.testes.utils.result_formatter import formatar_resultado_teste

if TYPE_CHECKING:
    from src.api_http.no_aplicacao import NoAplicacaoBlockchain


class TestScenarioExecutor:
    """Carrega, executa e formata cenarios registrados no backend."""

    def __init__(self, no_aplicacao: "NoAplicacaoBlockchain") -> None:
        self.no_aplicacao = no_aplicacao
        self.registry = ScenarioRegistry()
        self.context_builder = ScenarioContextBuilder(no_aplicacao)

    def listar_cenarios(self) -> list[dict[str, Any]]:
        """Lista as definicoes serializadas dos cenarios disponiveis."""

        return [cenario.definition.para_dict() for cenario in self.registry.listar()]

    def obter_cenario(self, scenario_id: str) -> dict[str, Any] | None:
        """Retorna a definicao completa de um cenario registrado."""

        cenario = self.registry.obter(scenario_id)
        if cenario is None:
            return None
        return cenario.definition.para_dict()

    def executar_cenario(
        self,
        scenario_id: str,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        """Executa o cenario solicitado e devolve o resultado padronizado."""

        cenario = self.registry.obter(scenario_id)
        if cenario is None:
            return None

        try:
            self.no_aplicacao.registrar_log(
                level="INFO",
                category="testes",
                message=f"Execucao do cenario {scenario_id} iniciada.",
                event_type="cenario_teste_iniciado",
                endpoint=f"/testes/executar/{scenario_id}",
                method="POST",
                request_payload=payload or {},
                context={"scenario_id": scenario_id},
            )
            runtime = self.context_builder.construir_runtime(
                cenario.definition, payload
            )
            outcome = cenario.execute(runtime, payload or {})
            resultado = formatar_resultado_teste(
                cenario.definition,
                runtime.contexto,
                outcome,
            )
            resultado_dict = resultado.para_dict()
            self.no_aplicacao.registrar_log(
                level="INFO" if resultado.teste_aprovado else "WARN",
                category="testes",
                message=(
                    f"Cenario {scenario_id} concluido com status {resultado.status_execucao}."
                ),
                event_type="cenario_teste_concluido",
                endpoint=f"/testes/executar/{scenario_id}",
                method="POST",
                response_payload=resultado_dict,
                context={
                    "scenario_id": scenario_id,
                    "teste_aprovado": resultado.teste_aprovado,
                    "status_execucao": resultado.status_execucao,
                },
            )
            return resultado_dict
        except Exception as erro:  # pragma: no cover - rede/cluster reais
            self.no_aplicacao.registrar_log(
                level="ERROR",
                category="testes",
                message=f"Cenario {scenario_id} falhou com erro tecnico.",
                event_type="cenario_teste_erro",
                endpoint=f"/testes/executar/{scenario_id}",
                method="POST",
                request_payload=payload or {},
                response_payload={"erro_tecnico": str(erro)},
                context={"scenario_id": scenario_id},
            )
            return {
                "scenario_id": cenario.definition.id,
                "scenario_name": cenario.definition.nome,
                "status_execucao": "erro_tecnico",
                "teste_aprovado": False,
                "resultado_esperado": " ".join(
                    cenario.definition.comportamento_esperado
                ),
                "resultado_observado": "A execução falhou antes de produzir um resultado interpretável.",
                "mensagem_interpretada": (
                    "O executor central encontrou um erro técnico não tratado ao "
                    "montar ou executar o cenário solicitado."
                ),
                "request_enviada": [{"payload": payload or {}}],
                "response_recebida": [],
                "impacto_blockchain": None,
                "contexto_relevante": {
                    "scenario_id": scenario_id,
                    "no_executor_id": self.no_aplicacao.config.node_id,
                },
                "erro_tecnico": {"mensagem": str(erro)},
            }
