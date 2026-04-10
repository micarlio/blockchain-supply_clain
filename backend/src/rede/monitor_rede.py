"""Estruturas simples para resumir a rede e a demonstracao."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import RLock
from typing import Any, Callable


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


@dataclass(slots=True)
class AtividadeRede:
    """Representa um registro simples de atividade observada pela aplicacao."""

    timestamp: str
    tipo: str
    descricao: str
    severidade: str
    node_id: str
    hash_relacionado: str | None = None
    event_id_relacionado: str | None = None

    def para_dict(self) -> dict[str, object]:
        """Serializa a atividade para a camada HTTP."""

        return {
            "timestamp": self.timestamp,
            "tipo": self.tipo,
            "descricao": self.descricao,
            "severidade": self.severidade,
            "node_id": self.node_id,
            "hash_relacionado": self.hash_relacionado,
            "event_id_relacionado": self.event_id_relacionado,
        }


class MonitorRede:
    """Guarda o resumo local dos nos conhecidos e das atividades recentes."""

    def __init__(
        self,
        node_id_local: str,
        papel_local: str,
        *,
        ao_registrar_atividade: Callable[[AtividadeRede], None] | None = None,
    ) -> None:
        self.node_id_local = node_id_local
        self.papel_local = papel_local
        self.ao_registrar_atividade = ao_registrar_atividade
        self._trava = RLock()
        self._atividades: list[AtividadeRede] = []
        self._nos_conhecidos: dict[str, dict[str, object]] = {}
        self.atualizar_no(
            node_id_local,
            papel=papel_local,
            status="online",
            ultimo_evento="inicializacao",
        )

    def registrar_atividade(
        self,
        tipo: str,
        descricao: str,
        severidade: str,
        node_id: str,
        hash_relacionado: str | None = None,
        event_id_relacionado: str | None = None,
    ) -> None:
        """Acrescenta uma atividade na trilha local da rede."""

        atividade = AtividadeRede(
            timestamp=_timestamp_utc_atual(),
            tipo=tipo,
            descricao=descricao,
            severidade=severidade,
            node_id=node_id,
            hash_relacionado=hash_relacionado,
            event_id_relacionado=event_id_relacionado,
        )

        with self._trava:
            self._atividades.append(atividade)
            self._atividades = self._atividades[-100:]

        if self.ao_registrar_atividade is not None:
            try:
                self.ao_registrar_atividade(atividade)
            except Exception:
                pass

    def definir_papel_local(self, papel_local: str) -> None:
        """Atualiza o papel local exposto pelos resumos da rede."""

        self.papel_local = papel_local
        self.atualizar_no(
            self.node_id_local,
            papel=papel_local,
            status="online",
            ultimo_evento="configuracao_no_atualizada",
        )

    def reiniciar(
        self, papel_local: str, *, ultimo_evento: str = "inicializacao"
    ) -> None:
        """Limpa atividades e nós conhecidos para um novo ciclo local."""

        with self._trava:
            self.papel_local = papel_local
            self._atividades = []
            self._nos_conhecidos = {}

        self.atualizar_no(
            self.node_id_local,
            papel=papel_local,
            status="online",
            ultimo_evento=ultimo_evento,
        )

    def atualizar_no(
        self,
        node_id: str,
        *,
        papel: str | None = None,
        api_url: str | None = None,
        status: str | None = None,
        altura_cadeia: int | None = None,
        hash_ponta: str | None = None,
        tamanho_mempool: int | None = None,
        ultimo_evento: str | None = None,
    ) -> None:
        """Atualiza as informacoes mais recentes de um no conhecido."""

        with self._trava:
            resumo = self._nos_conhecidos.get(
                node_id,
                {
                    "node_id": node_id,
                    "papel": "desconhecido",
                    "api_url": None,
                    "status": "desconhecido",
                    "altura_cadeia": None,
                    "hash_ponta": None,
                    "tamanho_mempool": None,
                    "ultimo_evento": None,
                    "ultimo_contato": None,
                },
            )

            if papel is not None:
                resumo["papel"] = papel
            if api_url is not None:
                resumo["api_url"] = api_url
            if status is not None:
                resumo["status"] = status
            if altura_cadeia is not None:
                resumo["altura_cadeia"] = altura_cadeia
            if hash_ponta is not None:
                resumo["hash_ponta"] = hash_ponta
            if tamanho_mempool is not None:
                resumo["tamanho_mempool"] = tamanho_mempool
            if ultimo_evento is not None:
                resumo["ultimo_evento"] = ultimo_evento

            resumo["ultimo_contato"] = _timestamp_utc_atual()
            self._nos_conhecidos[node_id] = resumo

    def listar_atividades(self, limite: int = 30) -> list[dict[str, object]]:
        """Devolve as atividades mais recentes, das mais novas para as mais antigas."""

        with self._trava:
            atividades = list(reversed(self._atividades[-limite:]))

        return [atividade.para_dict() for atividade in atividades]

    def listar_nos(self) -> list[dict[str, object]]:
        """Lista os nos conhecidos pela aplicacao local."""

        with self._trava:
            nos = sorted(
                self._nos_conhecidos.values(), key=lambda item: str(item["node_id"])
            )

        return [dict(no) for no in nos]

    def obter_resumo_demonstracao(self) -> dict[str, object]:
        """Deriva um resumo simples do estado atual da demonstracao."""

        atividades = self.listar_atividades(limite=50)
        fork_detectado = any(
            atividade["tipo"] == "fork_detectado" for atividade in atividades
        )
        reorganizacao_detectada = any(
            atividade["tipo"] == "cadeia_reorganizada" for atividade in atividades
        )

        return {
            "fork_detectado": fork_detectado,
            "reorganizacao_detectada": reorganizacao_detectada,
            "atividade_recente": atividades[0] if atividades else None,
        }

    def obter_resumo_rede_local(
        self,
        *,
        altura_cadeia: int,
        hash_ponta: str,
        tamanho_mempool: int,
        forks_conhecidos: int,
    ) -> dict[str, object]:
        """Monta a resposta agregada do endpoint `/rede`."""

        self.atualizar_no(
            self.node_id_local,
            papel=self.papel_local,
            status="online",
            altura_cadeia=altura_cadeia,
            hash_ponta=hash_ponta,
            tamanho_mempool=tamanho_mempool,
        )

        return {
            "node_id": self.node_id_local,
            "papel_local": self.papel_local,
            "estado_local": {
                "altura_cadeia": altura_cadeia,
                "hash_ponta": hash_ponta,
                "tamanho_mempool": tamanho_mempool,
                "forks_conhecidos": forks_conhecidos,
            },
            "nos_conhecidos": self.listar_nos(),
            "atividade_recente": self.listar_atividades(),
            "demonstracao": self.obter_resumo_demonstracao(),
        }
