"""Montagem de contexto e clientes usados pelos cenarios de teste."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any
from urllib.parse import quote

import httpx

from src.core.config import listar_perfis_no_padrao, obter_perfil_no_padrao
from src.testes.models import (
    ClusterSnapshot,
    NodeSnapshot,
    NodeTestMetadata,
    ScenarioDefinition,
    TestContext,
)
from src.testes.utils.blockchain_snapshot import (
    capturar_snapshot_cluster,
    obter_entrada,
)

if TYPE_CHECKING:
    from src.api_http.no_aplicacao import NoAplicacaoBlockchain


DEFAULT_HTTP_TIMEOUT = httpx.Timeout(4.0, connect=0.8)
MINING_HTTP_TIMEOUT = httpx.Timeout(180.0, connect=1.0)


def _chave_env_no(node_id: str) -> str:
    """Normaliza o id do no para lookup em variaveis de ambiente."""

    return node_id.replace("-", "_").upper()


@dataclass(slots=True)
class NodeControlClient:
    """Cliente local/remoto usado pelo executor para operar os nos."""

    metadata: NodeTestMetadata
    no_local: "NoAplicacaoBlockchain | None" = None

    @property
    def node_id(self) -> str:
        return self.metadata.node_id

    @property
    def disponivel(self) -> bool:
        return self.metadata.disponivel or self.no_local is not None

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        json_payload: dict[str, Any] | None = None,
        timeout: httpx.Timeout | None = None,
    ) -> dict[str, Any]:
        """Executa uma request HTTP simples contra um no remoto."""

        if not self.metadata.base_url:
            raise RuntimeError(f"node_unreachable:{self.node_id}")

        response = httpx.request(
            method,
            f"{self.metadata.base_url}{path}",
            json=json_payload,
            timeout=timeout or DEFAULT_HTTP_TIMEOUT,
        )
        try:
            payload = response.json() if response.content else {}
        except ValueError:
            payload = {"raw": response.text}

        if response.status_code >= 400:
            raise RuntimeError(
                f"http_error:{self.node_id}:{response.status_code}:{payload}"
            )

        if not isinstance(payload, dict):
            raise RuntimeError(f"unexpected_payload:{self.node_id}:{path}")

        return payload

    def consultar_estado(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_estado()
        return self._request_json("GET", "/estado")

    def consultar_cadeia(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_cadeia()
        return self._request_json("GET", "/cadeia")

    def consultar_mempool(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_mempool()
        return self._request_json("GET", "/mempool")

    def consultar_rede(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_rede()
        return self._request_json("GET", "/rede")

    def consultar_demonstracao(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_demonstracao()
        return self._request_json("GET", "/demonstracao")

    def consultar_rastreabilidade(self, identificador: str) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.obter_rastreabilidade(identificador)
        return self._request_json(
            "GET",
            f"/rastreabilidade/{quote(identificador, safe='')}",
        )

    def postar_evento(
        self,
        payload: dict[str, Any],
        *,
        propagar_rede: bool = True,
    ) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.adicionar_evento_por_payload(
                payload,
                publicar_na_rede=propagar_rede,
                origem="teste",
            )
        return self._request_json(
            "POST",
            f"/eventos?propagar_rede={'true' if propagar_rede else 'false'}",
            json_payload=payload,
        )

    def minerar_uma_vez(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.minerar_uma_vez()
        return self._request_json(
            "POST",
            "/demonstracao/minerar",
            timeout=MINING_HTTP_TIMEOUT,
        )

    def atualizar_configuracao_no(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.atualizar_configuracao_no(payload)
        return self._request_json("PATCH", "/configuracao/no", json_payload=payload)

    def atualizar_configuracao_rede(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.atualizar_dificuldade_global(payload)
        return self._request_json(
            "PATCH",
            "/configuracao/rede",
            json_payload=payload,
        )

    def limpar_memoria(self) -> dict[str, Any]:
        if self.no_local is not None:
            return self.no_local.limpar_memoria()
        return self._request_json("POST", "/memoria/limpar")


@dataclass(slots=True)
class ScenarioRuntime:
    """Runtime usado internamente pelo executor e pelos cenarios."""

    definition: ScenarioDefinition
    no_local: "NoAplicacaoBlockchain"
    no_alvo_id: str
    clients: dict[str, NodeControlClient]
    snapshot_inicial: ClusterSnapshot
    contexto: TestContext

    def obter_client(self, node_id: str) -> NodeControlClient:
        """Retorna o cliente de um no conhecido ou falha cedo."""

        client = self.clients.get(node_id)
        if client is None:
            raise RuntimeError(f"node_not_registered:{node_id}")
        return client


class ScenarioContextBuilder:
    """Resolve nos do cluster e monta o contexto base de execucao."""

    def __init__(self, no_aplicacao: "NoAplicacaoBlockchain") -> None:
        self.no_aplicacao = no_aplicacao

    def _resolver_base_url(self, node_id: str, api_port: int) -> str | None:
        """Tenta encontrar um endpoint HTTP funcional para o no informado."""

        chave_env = _chave_env_no(node_id)
        candidatos: list[str] = []
        valor_env = os.getenv(f"{chave_env}_API_URL")
        if valor_env:
            candidatos.append(valor_env.rstrip("/"))

        candidatos.extend(
            [
                f"http://{node_id}:{api_port}",
                f"http://127.0.0.1:{api_port}",
                f"http://localhost:{api_port}",
            ]
        )

        for candidato in candidatos:
            try:
                response = httpx.get(
                    f"{candidato}/estado",
                    timeout=httpx.Timeout(1.2, connect=0.4),
                )
                if response.status_code < 500:
                    return candidato.rstrip("/")
            except httpx.HTTPError:
                continue

        return None

    def construir_clients(self) -> dict[str, NodeControlClient]:
        """Resolve os clientes HTTP/diretos para os nos conhecidos."""

        clients: dict[str, NodeControlClient] = {}
        estado_local = self.no_aplicacao.obter_estado()
        perfil_local = obter_perfil_no_padrao(self.no_aplicacao.config.node_id)
        clients[self.no_aplicacao.config.node_id] = NodeControlClient(
            metadata=NodeTestMetadata(
                node_id=self.no_aplicacao.config.node_id,
                nome=(
                    perfil_local.nome_exibicao
                    if perfil_local is not None
                    else self.no_aplicacao.config.node_id
                ),
                base_url=None,
                disponivel=True,
                papel_no=estado_local.get("papel_no"),
                perfil_no=estado_local.get("perfil_no"),
                mineracao_automatica_ativa=estado_local.get(
                    "mineracao_automatica_ativa"
                ),
                capacidade_mineracao=estado_local.get("capacidade_mineracao"),
                altura_cadeia=estado_local.get("altura_cadeia"),
                hash_ponta=estado_local.get("hash_ponta"),
            ),
            no_local=self.no_aplicacao,
        )

        for perfil in listar_perfis_no_padrao():
            if perfil.node_id == self.no_aplicacao.config.node_id:
                continue

            base_url = self._resolver_base_url(perfil.node_id, perfil.api_port)
            metadata = NodeTestMetadata(
                node_id=perfil.node_id,
                nome=perfil.nome_exibicao,
                base_url=base_url,
                disponivel=base_url is not None,
            )
            clients[perfil.node_id] = NodeControlClient(metadata=metadata)

        return clients

    def construir_runtime(
        self,
        definition: ScenarioDefinition,
        payload: dict[str, Any] | None = None,
    ) -> ScenarioRuntime:
        """Monta o runtime completo do executor antes de disparar o cenario."""

        payload = payload or {}
        no_alvo_id = str(payload.get("node_id") or self.no_aplicacao.config.node_id)
        clients = self.construir_clients()
        snapshot_inicial = capturar_snapshot_cluster(
            clients,
            self.no_aplicacao.config.node_id,
        )

        entrada_alvo = obter_entrada(snapshot_inicial, no_alvo_id)
        contexto = TestContext(
            scenario_id=definition.id,
            scenario_name=definition.nome,
            no_executor_id=self.no_aplicacao.config.node_id,
            no_alvo_id=no_alvo_id,
            nos_conhecidos=[entrada.node for entrada in snapshot_inicial.entradas],
            topo_cadeia_antes=(
                entrada_alvo.estado.get("hash_ponta")
                if entrada_alvo and entrada_alvo.estado
                else None
            ),
            altura_cadeia_antes=(
                entrada_alvo.estado.get("altura_cadeia")
                if entrada_alvo and entrada_alvo.estado
                else None
            ),
            mempool_antes=(
                entrada_alvo.estado.get("quantidade_mempool")
                if entrada_alvo and entrada_alvo.estado
                else None
            ),
            snapshot_inicial=snapshot_inicial.para_dict(),
        )

        return ScenarioRuntime(
            definition=definition,
            no_local=self.no_aplicacao,
            no_alvo_id=no_alvo_id,
            clients=clients,
            snapshot_inicial=snapshot_inicial,
            contexto=contexto,
        )


def metadata_no(node_id: str) -> NodeTestMetadata | None:
    """Retorna o metadata basico de um no conhecido sem depender do runtime."""

    perfil = obter_perfil_no_padrao(node_id)
    if perfil is None:
        return None

    return NodeTestMetadata(
        node_id=perfil.node_id,
        nome=perfil.nome_exibicao,
        base_url=None,
        disponivel=False,
    )
