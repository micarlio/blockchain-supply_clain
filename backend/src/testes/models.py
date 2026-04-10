"""Modelos do módulo de testes do backend."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True, slots=True)
class ScenarioInputOption:
    """Opcao de um campo de entrada renderizado genericamente no frontend."""

    value: str
    label: str
    description: str | None = None


@dataclass(frozen=True, slots=True)
class ScenarioInputField:
    """Describe um campo opcional usado por um cenario."""

    id: str
    label: str
    field_type: str
    required: bool = False
    placeholder: str | None = None
    help_text: str | None = None
    default_value: Any = None
    options: list[ScenarioInputOption] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class ScenarioDefinition:
    """Metadados suficientes para o frontend montar a UI do cenario."""

    id: str
    nome: str
    descricao: str
    categoria: str
    severidade: str
    objetivo: str
    precondicoes: list[str]
    comportamento_esperado: list[str]
    requires_node_selection: bool
    node_selection_label: str | None = None
    node_selection_help: str | None = None
    input_fields: list[ScenarioInputField] = field(default_factory=list)
    impactos_execucao: list[str] = field(default_factory=list)
    show_blockchain_impact: bool = True
    show_request_response: bool = True
    show_context: bool = True
    default_target_node_id: str | None = None
    tags: list[str] = field(default_factory=list)

    def para_dict(self) -> dict[str, Any]:
        """Serializa a definicao para a camada HTTP."""

        return asdict(self)


@dataclass(frozen=True, slots=True)
class NodeTestMetadata:
    """Resumo serializavel de um no conhecido pelo executor."""

    node_id: str
    nome: str
    base_url: str | None
    disponivel: bool
    papel_no: str | None = None
    perfil_no: str | None = None
    mineracao_automatica_ativa: bool | None = None
    capacidade_mineracao: dict[str, Any] | None = None
    altura_cadeia: int | None = None
    hash_ponta: str | None = None


@dataclass(frozen=True, slots=True)
class NodeSnapshot:
    """Snapshot dos dados observaveis de um no durante um teste."""

    node: NodeTestMetadata
    estado: dict[str, Any] | None = None
    cadeia: dict[str, Any] | None = None
    rede: dict[str, Any] | None = None
    mempool: dict[str, Any] | None = None
    demonstracao: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class ClusterSnapshot:
    """Snapshot do cluster usado antes e depois da execucao de um cenario."""

    capturado_em: str
    no_executor_id: str
    entradas: list[NodeSnapshot]

    def para_dict(self) -> dict[str, Any]:
        """Serializa o snapshot completo."""

        return asdict(self)


@dataclass(slots=True)
class TestContext:
    """Contexto consolidado que acompanha a execucao do cenario."""

    scenario_id: str
    scenario_name: str
    no_executor_id: str
    no_alvo_id: str
    nos_conhecidos: list[NodeTestMetadata]
    topo_cadeia_antes: str | None
    altura_cadeia_antes: int | None
    mempool_antes: int | None
    itens_confirmados_relevantes: dict[str, Any] = field(default_factory=dict)
    insumo_alvo: dict[str, Any] | None = None
    produto_honesto: dict[str, Any] | None = None
    produto_malicioso: dict[str, Any] | None = None
    snapshot_inicial: dict[str, Any] = field(default_factory=dict)

    def para_dict(self) -> dict[str, Any]:
        """Serializa o contexto relevante para o frontend."""

        return {
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "no_executor_id": self.no_executor_id,
            "no_alvo_id": self.no_alvo_id,
            "nos_conhecidos": [asdict(no) for no in self.nos_conhecidos],
            "topo_cadeia_antes": self.topo_cadeia_antes,
            "altura_cadeia_antes": self.altura_cadeia_antes,
            "mempool_antes": self.mempool_antes,
            "itens_confirmados_relevantes": self.itens_confirmados_relevantes,
            "insumo_alvo": self.insumo_alvo,
            "produto_honesto": self.produto_honesto,
            "produto_malicioso": self.produto_malicioso,
            "snapshot_inicial": self.snapshot_inicial,
        }


@dataclass(slots=True)
class TestExecutionOutcome:
    """Resultado bruto produzido por um cenario antes da formatacao final."""

    status_execucao: str
    teste_aprovado: bool
    resultado_observado: str
    mensagem_interpretada: str
    request_enviada: list[dict[str, Any]] = field(default_factory=list)
    response_recebida: list[dict[str, Any]] = field(default_factory=list)
    impacto_blockchain: dict[str, Any] | None = None
    contexto_relevante: dict[str, Any] = field(default_factory=dict)
    erro_tecnico: dict[str, Any] | None = None
    snapshot_final: dict[str, Any] | None = None


@dataclass(frozen=True, slots=True)
class TestResult:
    """Formato oficial retornado ao frontend para qualquer execucao."""

    scenario_id: str
    scenario_name: str
    status_execucao: str
    teste_aprovado: bool
    resultado_esperado: str
    resultado_observado: str
    mensagem_interpretada: str
    request_enviada: list[dict[str, Any]]
    response_recebida: list[dict[str, Any]]
    impacto_blockchain: dict[str, Any] | None
    contexto_relevante: dict[str, Any]
    erro_tecnico: dict[str, Any] | None = None

    def para_dict(self) -> dict[str, Any]:
        """Serializa o resultado final para a API."""

        return asdict(self)
