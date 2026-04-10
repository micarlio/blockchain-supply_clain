"""Serviço de aplicação usado pela API HTTP de cada nó."""

from __future__ import annotations

from datetime import datetime, timezone
import os
from threading import RLock, Thread
from typing import Any
from uuid import uuid4

import httpx

from src.core.config import (
    CoreConfig,
    PAPEL_NO_CONTROLE,
    PAPEL_NO_MINERADOR,
    PAPEL_NO_OBSERVADOR,
    listar_perfis_no_padrao,
    obter_perfil_no_padrao,
)
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import (
    bloco_de_dict,
    bloco_para_dict,
    evento_para_dict,
)
from src.core.services.blockchain import Blockchain
from src.core.services.logs_memoria import ColetorLogsMemoria
from src.core.services.mempool import Mempool
from src.rede import NoConsumidor, NoProdutor
from src.rede.no_kafka import TIPO_MENSAGEM_CONFIGURACAO_REDE
from src.rede.monitor_rede import AtividadeRede, MonitorRede
from src.testes import TestScenarioExecutor


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


HTTP_TIMEOUT_CONFIG_REDE = httpx.Timeout(2.5, connect=0.5)
HTTP_TIMEOUT_SINCRONIZACAO_CADEIA = httpx.Timeout(4.0, connect=0.8)


class NoAplicacaoBlockchain:
    """Orquestra core, Kafka e API HTTP em um mesmo nó local."""

    def __init__(
        self,
        *,
        config: CoreConfig,
        url_broker: str = "localhost:9092",
        modo_observador: bool = False,
        iniciar_mineracao_automatica: bool = True,
    ) -> None:
        self.config = config
        self.url_broker = url_broker
        self.modo_observador = modo_observador
        self.iniciar_mineracao_automatica = iniciar_mineracao_automatica
        self.config.observer_mode = self.modo_observador
        self.config.auto_mining_enabled = self.iniciar_mineracao_automatica
        if self.modo_observador:
            self.config.node_role = PAPEL_NO_OBSERVADOR
        elif (
            not self.iniciar_mineracao_automatica
            and self.config.node_role == PAPEL_NO_MINERADOR
        ):
            self.config.node_role = PAPEL_NO_CONTROLE
        self._configuracao_inicial = {
            "difficulty": self.config.difficulty,
            "max_events_per_block": self.config.max_events_per_block,
            "node_role": self.config.node_role,
            "node_profile": self.config.node_profile,
            "auto_mining_enabled": self.config.auto_mining_enabled,
            "observer_mode": self.config.observer_mode,
            "mining_profile": self.config.mining_profile,
            "mining_cycle_interval_seconds": self.config.mining_cycle_interval_seconds,
            "nonce_attempts_per_cycle": self.config.nonce_attempts_per_cycle,
        }
        self.coletor_logs = ColetorLogsMemoria(self.config.node_id)
        self.trava = RLock()
        self.blockchain = Blockchain(
            config=self.config,
            ao_processar_bloco=self._ao_processar_bloco_blockchain,
        )
        self.mempool = Mempool()
        self.monitor_rede = MonitorRede(
            node_id_local=self.config.node_id,
            papel_local=self.obter_papel_no(),
            ao_registrar_atividade=self._registrar_atividade_em_logs,
        )
        self.produtor = NoProdutor(
            self.config.node_id,
            self.url_broker,
            self.blockchain,
            self.mempool,
            trava=self.trava,
            monitor_rede=self.monitor_rede,
            coletor_logs=self.coletor_logs,
        )
        self.consumidor = NoConsumidor(
            self.config.node_id,
            self.url_broker,
            self.blockchain,
            self.mempool,
            trava=self.trava,
            monitor_rede=self.monitor_rede,
            aceitar_evento=self.adicionar_evento_recebido_da_rede,
            aceitar_configuracao_rede=self.aplicar_configuracao_rede_recebida,
            sincronizar_cadeia_remota=self.sincronizar_cadeia_com_no_remoto,
            coletor_logs=self.coletor_logs,
        )
        self._thread_consumidor: Thread | None = None
        self._thread_mineracao: Thread | None = None
        self._encerrado = False
        self.executor_testes = TestScenarioExecutor(self)

    def registrar_log(
        self,
        *,
        level: str,
        category: str,
        message: str,
        event_type: str | None = None,
        endpoint: str | None = None,
        method: str | None = None,
        request_id: str | None = None,
        status_code: int | None = None,
        duration_ms: int | None = None,
        request_payload: Any = None,
        response_payload: Any = None,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Atalho central para registrar logs estruturados do nó."""

        return self.coletor_logs.registrar(
            level=level,
            category=category,
            message=message,
            event_type=event_type,
            endpoint=endpoint,
            method=method,
            request_id=request_id,
            status_code=status_code,
            duration_ms=duration_ms,
            request_payload=request_payload,
            response_payload=response_payload,
            context=context,
        )

    def _registrar_atividade_em_logs(self, atividade: AtividadeRede) -> None:
        """Converte atividades do monitor em logs estruturados quando relevante."""

        mapa_categorias = {
            "bloco_minerado": "mineracao",
            "bloco_recebido": "rede_kafka",
            "evento_recebido": "rede_kafka",
            "configuracao_rede_recebida": "rede_kafka",
            "cadeia_ressincronizada": "rede_kafka",
            "bloco_proprio_descartado": "rede_kafka",
            "evento_proprio_descartado": "rede_kafka",
            "fork_detectado": "consenso",
            "cadeia_reorganizada": "consenso",
            "bloco_rejeitado": "validacao",
            "configuracao_no_atualizada": "api",
            "memoria_limpa": "api",
            "attack_51_simulado": "testes",
        }
        categoria = mapa_categorias.get(atividade.tipo)
        if categoria is None and atividade.tipo.startswith("attack_"):
            categoria = "testes"
        if categoria is None:
            return

        mapa_niveis = {
            "success": "INFO",
            "info": "INFO",
            "warning": "WARN",
            "error": "ERROR",
        }
        self.registrar_log(
            level=mapa_niveis.get(atividade.severidade, "INFO"),
            category=categoria,
            message=atividade.descricao,
            event_type=atividade.tipo,
            context={
                "hash_relacionado": atividade.hash_relacionado,
                "event_id_relacionado": atividade.event_id_relacionado,
            },
        )

    def _ao_processar_bloco_blockchain(self, dados: dict[str, Any]) -> None:
        """Traduz o resultado do core em logs de consenso/validação."""

        resultado = str(dados.get("resultado") or "desconhecido")
        if resultado == "bloco_adicionado_cadeia_ativa":
            level = "INFO"
            categoria = "consenso"
            mensagem = f"Bloco #{dados.get('block_index')} anexado a cadeia ativa."
        elif resultado == "bloco_registrado_em_fork":
            level = "WARN"
            categoria = "consenso"
            mensagem = f"Bloco #{dados.get('block_index')} abriu ou estendeu um fork."
        elif resultado == "cadeia_ativa_reorganizada":
            level = "WARN"
            categoria = "consenso"
            mensagem = f"Reorganizacao detectada ao processar o bloco #{dados.get('block_index')}."
        elif resultado == "payload_invalido":
            level = "ERROR"
            categoria = "validacao"
            mensagem = "Payload de bloco invalido recebido para processamento."
        elif resultado == "bloco_ignorado_proprio_no":
            level = "DEBUG"
            categoria = "rede_kafka"
            mensagem = "Bloco proprio ignorado pelo no local."
        else:
            level = "WARN"
            categoria = "validacao"
            mensagem = f"Bloco rejeitado durante o processamento ({resultado})."

        self.registrar_log(
            level=level,
            category=categoria,
            message=mensagem,
            event_type=resultado,
            context={
                "block_index": dados.get("block_index"),
                "block_hash": dados.get("block_hash"),
                "previous_hash": dados.get("previous_hash"),
                "difficulty": dados.get("difficulty"),
                "miner_id": dados.get("miner_id"),
            },
        )

    def _aplicar_papel_no(self, papel_no: str) -> None:
        """Atualiza o modo operacional do nó em memória durante a execução."""

        if papel_no not in {
            PAPEL_NO_MINERADOR,
            PAPEL_NO_CONTROLE,
            PAPEL_NO_OBSERVADOR,
        }:
            raise ValueError("papel_no_invalido")

        self.config.node_role = papel_no
        self.modo_observador = papel_no == PAPEL_NO_OBSERVADOR
        self.iniciar_mineracao_automatica = papel_no == PAPEL_NO_MINERADOR
        self.config.observer_mode = self.modo_observador
        self.config.auto_mining_enabled = self.iniciar_mineracao_automatica

        self.monitor_rede.definir_papel_local(self.obter_papel_no())

    def _registrar_mudanca_configuracao(self, descricao: str) -> None:
        """Atualiza o monitor e reinicia o estado incremental da mineração."""

        self.produtor.reset_automatic_mining_state()
        self.monitor_rede.registrar_atividade(
            "configuracao_no_atualizada",
            descricao,
            "info",
            self.config.node_id,
        )
        self._atualizar_monitor_local("configuracao_no_atualizada")

    def _restaurar_configuracao_inicial(self) -> None:
        """Restaura a configuracao runtime original do processo atual."""

        configuracao = self._configuracao_inicial
        self.config.difficulty = int(configuracao["difficulty"])
        self.config.max_events_per_block = int(configuracao["max_events_per_block"])
        self.config.node_role = str(configuracao["node_role"])
        self.config.node_profile = str(configuracao["node_profile"])
        self.config.auto_mining_enabled = bool(configuracao["auto_mining_enabled"])
        self.config.observer_mode = bool(configuracao["observer_mode"])
        self.config.mining_profile = str(configuracao["mining_profile"])
        self.config.mining_cycle_interval_seconds = float(
            configuracao["mining_cycle_interval_seconds"]
        )
        self.config.nonce_attempts_per_cycle = int(
            configuracao["nonce_attempts_per_cycle"]
        )
        self.config.atualizacoes_dificuldade_global = []
        self.config.dificuldade_global_inicial = int(configuracao["difficulty"])
        self.modo_observador = self.config.observer_mode
        self.iniciar_mineracao_automatica = self.config.auto_mining_enabled

    def _montar_payload_dificuldade_global(self, dificuldade: int) -> dict[str, object]:
        """Cria um payload distribuivel para a mudanca global de PoW."""

        ultimo_bloco = self.blockchain.obter_ultimo_bloco()
        return {
            "tipo_mensagem": TIPO_MENSAGEM_CONFIGURACAO_REDE,
            "update_id": f"pow-{self.config.node_id}-{uuid4().hex}",
            "dificuldade_global": dificuldade,
            "bloco_ancora_hash": ultimo_bloco.block_hash,
            "node_id_origem": self.config.node_id,
            "timestamp": _timestamp_utc_atual(),
        }

    def _resolver_urls_no(self, node_id: str, api_port: int | None = None) -> list[str]:
        """Lista endpoints candidatos conhecidos para falar com outro nó."""

        chave_env = node_id.replace("-", "_").upper()
        candidatos: list[str] = []
        for no in self.monitor_rede.listar_nos():
            if no.get("node_id") != node_id:
                continue
            api_url = no.get("api_url")
            if isinstance(api_url, str) and api_url:
                candidatos.append(api_url.rstrip("/"))

        valor_env = os.getenv(f"{chave_env}_API_URL")
        if valor_env:
            candidatos.append(valor_env.rstrip("/"))

        perfil = obter_perfil_no_padrao(node_id)
        porta_resolvida = api_port or (perfil.api_port if perfil is not None else None)
        if porta_resolvida is not None:
            candidatos.extend(
                [
                    f"http://{node_id}:{porta_resolvida}",
                    f"http://127.0.0.1:{porta_resolvida}",
                    f"http://localhost:{porta_resolvida}",
                ]
            )

        perfil_local = obter_perfil_no_padrao(self.config.node_id)
        if node_id == self.config.node_id and perfil_local is not None:
            candidatos.append(f"http://127.0.0.1:{perfil_local.api_port}")

        urls_sem_duplicidade: list[str] = []
        vistos: set[str] = set()
        for candidato in candidatos:
            if candidato in vistos:
                continue
            vistos.add(candidato)
            urls_sem_duplicidade.append(candidato)

        return urls_sem_duplicidade

    def _listar_destinos_remotos(self) -> list[tuple[str, list[str]]]:
        """Resolve os nós remotos conhecidos por perfis e observação da rede."""

        ids_nos = {perfil.node_id for perfil in listar_perfis_no_padrao()}
        ids_nos.update(
            str(no.get("node_id"))
            for no in self.monitor_rede.listar_nos()
            if isinstance(no.get("node_id"), str)
        )
        ids_nos.discard(self.config.node_id)

        destinos: list[tuple[str, list[str]]] = []
        for node_id in sorted(ids_nos):
            urls = self._resolver_urls_no(node_id)
            if urls:
                destinos.append((node_id, urls))

        return destinos

    def _aplicar_dificuldade_global_local(
        self,
        dificuldade: int,
        *,
        propagar_rede: bool,
    ) -> dict[str, object]:
        """Aplica a dificuldade apenas no no atual, com ou sem fan-out Kafka."""

        with self.trava:
            self.blockchain.obter_dificuldade_global_ativa()
            if dificuldade == self.config.global_difficulty:
                return {
                    "status": "dificuldade_global_inalterada",
                    "estado": self.obter_estado(),
                }

            payload_atualizacao = self._montar_payload_dificuldade_global(dificuldade)
            if propagar_rede:
                self.produtor.publicar_configuracao_rede(payload_atualizacao)
            self._aplicar_payload_dificuldade_global(payload_atualizacao, origem="api")

        return {
            "status": (
                "dificuldade_global_atualizada"
                if propagar_rede
                else "dificuldade_global_aplicada_localmente"
            ),
            "estado": self.obter_estado(),
        }

    def _sincronizar_dificuldade_global_nos_conhecidos(
        self,
        dificuldade: int,
    ) -> dict[str, object]:
        """Aplica a mesma dificuldade nos nos conhecidos via HTTP direto."""

        dificuldade_anterior = self.config.global_difficulty
        atualizados: list[tuple[str, str]] = []
        falhas: list[dict[str, str]] = []

        for node_id, urls in self._listar_destinos_remotos():
            sucesso = False
            ultimo_erro = "sem_endpoint_valido"
            for base_url in urls:
                try:
                    resposta = httpx.patch(
                        f"{base_url}/configuracao/rede",
                        json={
                            "dificuldade_global": dificuldade,
                            "propagar_rede": False,
                        },
                        timeout=HTTP_TIMEOUT_CONFIG_REDE,
                    )
                    if resposta.status_code >= 400:
                        ultimo_erro = f"http_{resposta.status_code}"
                        continue

                    resposta_estado = httpx.get(
                        f"{base_url}/estado",
                        timeout=HTTP_TIMEOUT_CONFIG_REDE,
                    )
                    if resposta_estado.status_code >= 400:
                        ultimo_erro = f"http_{resposta_estado.status_code}"
                        continue
                    payload_estado = resposta_estado.json()
                    if (
                        not isinstance(payload_estado, dict)
                        or payload_estado.get("dificuldade_global") != dificuldade
                    ):
                        ultimo_erro = "estado_nao_reflete_dificuldade_global"
                        continue

                    self.monitor_rede.atualizar_no(
                        node_id,
                        api_url=base_url,
                        status="online",
                        altura_cadeia=payload_estado.get("altura_cadeia"),
                        hash_ponta=payload_estado.get("hash_ponta"),
                        tamanho_mempool=payload_estado.get("quantidade_mempool"),
                        ultimo_evento="configuracao_rede_sincronizada",
                    )
                    atualizados.append((node_id, base_url))
                    sucesso = True
                    break
                except httpx.HTTPError as erro:
                    ultimo_erro = str(erro)

            if not sucesso:
                falhas.append({"node_id": node_id, "erro": ultimo_erro})

        if falhas:
            for node_id, base_url in atualizados:
                try:
                    httpx.patch(
                        f"{base_url}/configuracao/rede",
                        json={
                            "dificuldade_global": dificuldade_anterior,
                            "propagar_rede": False,
                        },
                        timeout=HTTP_TIMEOUT_CONFIG_REDE,
                    )
                except httpx.HTTPError:
                    pass

            raise RuntimeError(
                "falha_sincronizacao_dificuldade_global:"
                + ",".join(item["node_id"] for item in falhas)
            )

        return {
            "nos_atualizados": [node_id for node_id, _ in atualizados],
        }

    def _desserializar_cadeia_remota(
        self,
        payload_cadeia: list[object],
    ) -> list[object] | None:
        """Reconstrói uma cadeia vinda da API remota em objetos do core."""

        if not isinstance(payload_cadeia, list):
            return None

        cadeia = []
        for item in payload_cadeia:
            if not isinstance(item, dict):
                return None
            bloco = bloco_de_dict(item)
            if bloco is None:
                return None
            cadeia.append(bloco)

        return cadeia

    def _revalidar_mempool_no_contexto_atual(self) -> dict[str, int]:
        """Remove pendencias que ja nao fazem sentido apos uma resincronizacao."""

        eventos_pendentes = self.mempool.obter_eventos_pendentes(
            self.mempool.quantidade_pendente()
        )
        self.mempool.limpar()

        contexto_cadeia = self.blockchain.validator.construir_contexto_cadeia(
            self.blockchain.chain
        )
        if contexto_cadeia is None:
            return {"mantidos": 0, "descartados": len(eventos_pendentes)}

        contexto_eventos, contexto_consumidos = contexto_cadeia
        mantidos = 0
        descartados = 0

        for evento in eventos_pendentes:
            motivo = self.blockchain.validator.diagnosticar_rejeicao_evento_de_dominio(
                evento,
                contexto_eventos,
                contexto_consumidos,
            )
            if motivo is not None:
                descartados += 1
                continue

            if not self.mempool.adicionar_evento(evento):
                descartados += 1
                continue

            contexto_atualizado = self.blockchain.validator.aplicar_evento_ao_contexto(
                evento,
                contexto_eventos,
                contexto_consumidos,
            )
            if contexto_atualizado is None:
                self.mempool.remover_eventos([evento.event_id])
                descartados += 1
                continue

            contexto_eventos, contexto_consumidos = contexto_atualizado
            mantidos += 1

        return {"mantidos": mantidos, "descartados": descartados}

    def sincronizar_cadeia_com_no_remoto(self, node_id: str) -> bool:
        """Busca a cadeia ativa remota para recuperar nós atrasados ou resetados."""

        for base_url in self._resolver_urls_no(node_id):
            try:
                resposta_cadeia = httpx.get(
                    f"{base_url}/cadeia",
                    timeout=HTTP_TIMEOUT_SINCRONIZACAO_CADEIA,
                )
                resposta_estado = httpx.get(
                    f"{base_url}/estado",
                    timeout=HTTP_TIMEOUT_SINCRONIZACAO_CADEIA,
                )
                if (
                    resposta_cadeia.status_code >= 400
                    or resposta_estado.status_code >= 400
                ):
                    continue

                payload_cadeia = resposta_cadeia.json()
                payload_estado = resposta_estado.json()
                if not isinstance(payload_cadeia, dict) or not isinstance(
                    payload_estado, dict
                ):
                    continue

                cadeia_ativa = self._desserializar_cadeia_remota(
                    payload_cadeia.get("cadeia_ativa", [])
                )
                if cadeia_ativa is None or not self.blockchain.validar_cadeia(
                    cadeia_ativa
                ):
                    continue

                cadeias_candidatas = payload_cadeia.get("cadeias_candidatas", [])
                cadeias_candidatas_validas = []
                if isinstance(cadeias_candidatas, list):
                    for cadeia_payload in cadeias_candidatas:
                        cadeia_candidata = self._desserializar_cadeia_remota(
                            cadeia_payload
                        )
                        if (
                            cadeia_candidata is not None
                            and self.blockchain.validar_cadeia(cadeia_candidata)
                        ):
                            cadeias_candidatas_validas.append(cadeia_candidata)

                with self.trava:
                    alterou_cadeia_ativa = False
                    if cadeia_ativa != self.blockchain.chain:
                        if self.blockchain.substituir_cadeia(cadeia_ativa):
                            alterou_cadeia_ativa = True
                        elif (
                            self.blockchain.chain
                            == [self.blockchain.criar_bloco_genesis()]
                            and len(cadeia_ativa) > 1
                        ):
                            self.blockchain.chain = cadeia_ativa
                            self.blockchain.obter_dificuldade_global_ativa()
                            alterou_cadeia_ativa = True

                    for cadeia_candidata in cadeias_candidatas_validas:
                        if cadeia_candidata == self.blockchain.chain:
                            continue
                        self.blockchain._registrar_cadeia_candidata(cadeia_candidata)

                    resultado_mempool = self._revalidar_mempool_no_contexto_atual()

                    self.monitor_rede.atualizar_no(
                        node_id,
                        api_url=base_url,
                        status="online",
                        altura_cadeia=payload_estado.get("altura_cadeia"),
                        hash_ponta=payload_estado.get("hash_ponta"),
                        tamanho_mempool=payload_estado.get("quantidade_mempool"),
                        ultimo_evento="cadeia_ressincronizada",
                    )
                    self.monitor_rede.registrar_atividade(
                        "cadeia_ressincronizada",
                        (
                            f"Cadeia resincronizada a partir de {node_id}. "
                            f"mempool mantidos={resultado_mempool['mantidos']} descartados={resultado_mempool['descartados']}"
                        ),
                        "success" if alterou_cadeia_ativa else "info",
                        self.config.node_id,
                        hash_relacionado=self.blockchain.obter_ultimo_bloco().block_hash,
                    )
                    self._atualizar_monitor_local("cadeia_ressincronizada")

                return True
            except (httpx.HTTPError, ValueError):
                continue

        return False

    def _aplicar_payload_dificuldade_global(
        self,
        payload: dict[str, object],
        *,
        origem: str,
    ) -> bool:
        """Aplica uma mudanca global de dificuldade de forma idempotente."""

        dificuldade = payload.get("dificuldade_global")
        update_id = payload.get("update_id")
        bloco_ancora_hash = payload.get("bloco_ancora_hash")
        node_id_origem = payload.get("node_id_origem")
        timestamp = payload.get("timestamp")

        if not isinstance(dificuldade, int) or isinstance(dificuldade, bool):
            raise ValueError("dificuldade_global_invalida")

        registrado = self.config.registrar_dificuldade_global(
            dificuldade,
            bloco_ancora_hash=bloco_ancora_hash,
            update_id=update_id,
            node_id_origem=node_id_origem,
            timestamp=timestamp,
        )
        if not registrado:
            return False

        self.config.sincronizar_dificuldade_global_ativa(self.blockchain.chain)
        self.blockchain.descartar_cadeias_candidatas()
        self._registrar_mudanca_configuracao(
            (
                f"Dificuldade global ajustada para {dificuldade} via {origem}, "
                f"ancorada em {str(bloco_ancora_hash)[:12]}."
            )
        )
        return True

    def obter_papel_no(self) -> str:
        """Resume o papel operacional do nó para API e monitoramento."""

        if self.modo_observador:
            return PAPEL_NO_OBSERVADOR
        if (
            not self.iniciar_mineracao_automatica
            and self.config.node_role == PAPEL_NO_MINERADOR
        ):
            return PAPEL_NO_CONTROLE
        return self.config.node_role

    def iniciar(self) -> None:
        """Sobe consumidor e a thread de mineração configurável em tempo real."""

        if self._thread_consumidor is None:
            self._thread_consumidor = Thread(
                target=self.consumidor.iniciar_escuta,
                daemon=True,
                name=f"consumidor-{self.config.node_id}",
            )
            self._thread_consumidor.start()

        if self._thread_mineracao is None:
            self._thread_mineracao = Thread(
                target=self.produtor.iniciar_ciclo_mineracao,
                daemon=True,
                name=f"mineracao-{self.config.node_id}",
            )
            self._thread_mineracao.start()

        self._atualizar_monitor_local("inicializacao_no")

    def encerrar(self) -> None:
        """Libera recursos locais que precisam de finalizacao explicita."""

        if self._encerrado:
            return

        self.produtor.encerrar()
        self._encerrado = True

    def _sincronizar_monitor_local(self, ultimo_evento: str | None = None) -> None:
        """Mantém o resumo local do nó atualizado sem criar atividade artificial."""

        with self.trava:
            ultimo_bloco = self.blockchain.obter_ultimo_bloco()
            urls_locais = self._resolver_urls_no(self.config.node_id)
            self.monitor_rede.atualizar_no(
                self.config.node_id,
                papel=self.obter_papel_no(),
                api_url=urls_locais[0] if urls_locais else None,
                status="online",
                altura_cadeia=len(self.blockchain.chain),
                hash_ponta=ultimo_bloco.block_hash,
                tamanho_mempool=self.mempool.quantidade_pendente(),
                ultimo_evento=ultimo_evento,
            )

    def _atualizar_monitor_local(self, ultimo_evento: str) -> None:
        """Mantém o resumo local do nó atualizado com evento operacional explícito."""

        self._sincronizar_monitor_local(ultimo_evento)

    def _construir_contexto_com_mempool(
        self,
    ) -> tuple[dict[str, SupplyChainEvent], set[str]] | None:
        """Junta cadeia confirmada com a mempool atual para validar um evento novo."""

        contexto_cadeia = self.blockchain.validator.construir_contexto_cadeia(
            self.blockchain.chain
        )
        if contexto_cadeia is None:
            return None

        contexto_eventos, contexto_consumidos = contexto_cadeia
        eventos_pendentes = self.mempool.obter_eventos_pendentes(
            self.mempool.quantidade_pendente()
        )
        if not eventos_pendentes:
            return contexto_eventos, contexto_consumidos

        return self.blockchain.validator.construir_contexto_eventos(
            eventos_pendentes,
            contexto_eventos,
            contexto_consumidos,
        )

    def _motivo_rejeicao_evento(self, evento: SupplyChainEvent) -> str | None:
        """Retorna um motivo simples quando o evento não pode entrar no contexto atual."""

        if not evento.validar_basico():
            return "estrutura_invalida"

        contexto = self._construir_contexto_com_mempool()
        if contexto is None:
            return "contexto_mempool_invalido"

        contexto_eventos, contexto_consumidos = contexto
        motivo = self.blockchain.validator.diagnosticar_rejeicao_evento_de_dominio(
            evento,
            contexto_eventos,
            contexto_consumidos,
        )
        if motivo is not None:
            return motivo

        return None

    def adicionar_evento_por_payload(
        self,
        payload: dict[str, object],
        *,
        publicar_na_rede: bool = True,
        origem: str = "api",
    ) -> dict[str, object]:
        """Recebe o JSON do evento, valida e tenta colocá-lo na mempool."""

        evento = SupplyChainEvent.de_dict(payload)
        if evento is None:
            resultado = {"status": "evento_rejeitado", "motivo": "payload_invalido"}
            self.monitor_rede.registrar_atividade(
                "evento_rejeitado",
                "Payload de evento inválido recebido pela API.",
                "warning",
                self.config.node_id,
            )
            self.registrar_log(
                level="WARN",
                category="validacao",
                message="Payload de evento invalido recebido.",
                event_type="payload_invalido",
                request_payload=payload,
                response_payload=resultado,
                context={"origem": origem},
            )
            return resultado

        return self.adicionar_evento(
            evento,
            publicar_na_rede=publicar_na_rede,
            origem=origem,
        )

    def adicionar_evento(
        self,
        evento: SupplyChainEvent,
        *,
        publicar_na_rede: bool,
        origem: str,
    ) -> dict[str, object]:
        """Valida e adiciona um evento ao contexto atual do nó."""

        with self.trava:
            motivo = self._motivo_rejeicao_evento(evento)
            if motivo is not None:
                resultado = {"status": "evento_rejeitado", "motivo": motivo}
                self.monitor_rede.registrar_atividade(
                    "evento_rejeitado",
                    f"Evento {evento.event_id} rejeitado ({motivo}).",
                    "warning",
                    self.config.node_id,
                    event_id_relacionado=evento.event_id,
                )
                self.registrar_log(
                    level="WARN",
                    category="validacao",
                    message=f"Evento {evento.event_id} rejeitado ({motivo}).",
                    event_type="evento_rejeitado",
                    request_payload=evento.para_dict(),
                    response_payload=resultado,
                    context={
                        "event_id": evento.event_id,
                        "product_id": evento.product_id,
                        "origem": origem,
                    },
                )
                return resultado

            if not self.mempool.adicionar_evento(evento):
                resultado = {
                    "status": "evento_rejeitado",
                    "motivo": "falha_ao_adicionar_na_mempool",
                }
                self.monitor_rede.registrar_atividade(
                    "evento_rejeitado",
                    f"Evento {evento.event_id} não entrou na mempool.",
                    "warning",
                    self.config.node_id,
                    event_id_relacionado=evento.event_id,
                )
                self.registrar_log(
                    level="WARN",
                    category="validacao",
                    message=f"Evento {evento.event_id} nao entrou na mempool.",
                    event_type="evento_rejeitado",
                    request_payload=evento.para_dict(),
                    response_payload=resultado,
                    context={
                        "event_id": evento.event_id,
                        "product_id": evento.product_id,
                        "origem": origem,
                    },
                )
                return resultado

            self.monitor_rede.registrar_atividade(
                "evento_adicionado",
                f"Evento {evento.event_id} adicionado via {origem}.",
                "info",
                self.config.node_id,
                event_id_relacionado=evento.event_id,
            )
            self._atualizar_monitor_local("evento_adicionado")

        if publicar_na_rede:
            self.produtor.publicar_evento(evento)

        resultado = {
            "status": "evento_adicionado",
            "event_id": evento.event_id,
            "node_id": self.config.node_id,
        }
        self.registrar_log(
            level="INFO",
            category="validacao",
            message=f"Evento {evento.event_id} validado e adicionado a mempool.",
            event_type="evento_validado",
            request_payload=evento.para_dict(),
            response_payload=resultado,
            context={
                "event_id": evento.event_id,
                "product_id": evento.product_id,
                "origem": origem,
                "publicar_na_rede": publicar_na_rede,
            },
        )
        return resultado

    def adicionar_evento_recebido_da_rede(self, evento: SupplyChainEvent) -> bool:
        """Caminho usado pelo consumidor Kafka para validar evento remoto."""

        resultado = self.adicionar_evento(
            evento,
            publicar_na_rede=False,
            origem="rede",
        )
        return resultado["status"] == "evento_adicionado"

    def aplicar_configuracao_rede_recebida(self, payload: dict[str, object]) -> bool:
        """Aplica uma configuracao global recebida pela camada de rede."""

        with self.trava:
            try:
                return self._aplicar_payload_dificuldade_global(payload, origem="rede")
            except ValueError:
                return False

    def minerar_uma_vez(self) -> dict[str, object]:
        """Executa uma rodada manual de mineração."""

        if self.modo_observador:
            resultado = {"status": "mineracao_indisponivel", "motivo": "no_observador"}
            self.registrar_log(
                level="WARN",
                category="mineracao",
                message="Mineracao manual indisponivel em no observador.",
                event_type="mineracao_indisponivel",
                response_payload=resultado,
            )
            return resultado

        bloco = self.produtor.minerar_uma_vez()
        self._atualizar_monitor_local("mineracao_manual")
        if bloco is None:
            resultado = {"status": "sem_eventos_pendentes"}
            self.registrar_log(
                level="INFO",
                category="mineracao",
                message="Mineracao manual executada sem eventos pendentes.",
                event_type="sem_eventos_pendentes",
                response_payload=resultado,
            )
            return resultado

        resultado = {"status": "bloco_minerado", "bloco": bloco_para_dict(bloco)}
        self.registrar_log(
            level="INFO",
            category="mineracao",
            message=f"Mineracao manual concluiu o bloco #{bloco.index}.",
            event_type="mineracao_manual_concluida",
            response_payload=resultado,
            context={
                "block_index": bloco.index,
                "block_hash": bloco.block_hash,
            },
        )
        return resultado

    def atualizar_configuracao_no(
        self, payload: dict[str, object]
    ) -> dict[str, object]:
        """Permite alterar papel e hash power do nó em memória via API."""

        papel_no = payload.get("papel_no")
        intervalo = payload.get("intervalo_ciclo_segundos")
        tentativas = payload.get("tentativas_nonce_por_ciclo")
        perfil_mineracao = payload.get("perfil_mineracao")

        if papel_no not in {
            PAPEL_NO_MINERADOR,
            PAPEL_NO_CONTROLE,
            PAPEL_NO_OBSERVADOR,
        }:
            raise ValueError("papel_no_invalido")

        intervalo_normalizado: float | None = None
        if intervalo is not None:
            if not isinstance(intervalo, (int, float)) or isinstance(intervalo, bool):
                raise ValueError("intervalo_ciclo_invalido")
            intervalo_normalizado = float(intervalo)
            if intervalo_normalizado <= 0:
                raise ValueError("intervalo_ciclo_invalido")

        tentativas_normalizadas: int | None = None
        if tentativas is not None:
            if not isinstance(tentativas, int) or isinstance(tentativas, bool):
                raise ValueError("tentativas_nonce_invalidas")
            if tentativas < 0:
                raise ValueError("tentativas_nonce_invalidas")
            tentativas_normalizadas = tentativas

        perfil_mineracao_normalizado: str | None = None
        if perfil_mineracao is not None:
            if not isinstance(perfil_mineracao, str) or not perfil_mineracao:
                raise ValueError("perfil_mineracao_invalido")
            perfil_mineracao_normalizado = perfil_mineracao

        with self.trava:
            self._aplicar_papel_no(papel_no)
            self.config.aplicar_capacidade_mineracao(
                intervalo_ciclo_segundos=intervalo_normalizado,
                tentativas_nonce_por_ciclo=tentativas_normalizadas,
                mining_profile=(
                    perfil_mineracao_normalizado
                    if perfil_mineracao_normalizado is not None
                    else "customizado"
                ),
            )
            self._registrar_mudanca_configuracao(
                f"Configuração local atualizada: papel={self.obter_papel_no()}, intervalo={self.config.mining_cycle_interval_seconds}s, tentativas={self.config.nonce_attempts_per_cycle}."
            )

        return {
            "status": "configuracao_no_atualizada",
            "estado": self.obter_estado(),
        }

    def atualizar_dificuldade_global(
        self, payload: dict[str, object]
    ) -> dict[str, object]:
        """Atualiza a dificuldade global do cluster de forma mais previsivel."""

        dificuldade = payload.get("dificuldade_global")
        propagar_rede = payload.get("propagar_rede", True)
        if not isinstance(dificuldade, int) or isinstance(dificuldade, bool):
            raise ValueError("dificuldade_global_invalida")
        if not isinstance(propagar_rede, bool):
            raise ValueError("propagar_rede_invalido")

        if not propagar_rede:
            return self._aplicar_dificuldade_global_local(
                dificuldade,
                propagar_rede=False,
            )

        with self.trava:
            self.blockchain.obter_dificuldade_global_ativa()
            dificuldade_local_ja_alinhada = dificuldade == self.config.global_difficulty

        sincronizacao = self._sincronizar_dificuldade_global_nos_conhecidos(dificuldade)
        resultado_local = (
            self._aplicar_dificuldade_global_local(
                dificuldade,
                propagar_rede=False,
            )
            if not dificuldade_local_ja_alinhada
            else {
                "status": "dificuldade_global_inalterada",
                "estado": self.obter_estado(),
            }
        )
        resultado_local["status"] = (
            "dificuldade_global_atualizada"
            if sincronizacao["nos_atualizados"] or not dificuldade_local_ja_alinhada
            else "dificuldade_global_inalterada"
        )
        resultado_local["sincronizacao"] = sincronizacao
        return resultado_local

    def limpar_memoria(self) -> dict[str, object]:
        """Limpa o estado em memoria do nó como em um reinício limpo."""

        with self.trava:
            self.coletor_logs.limpar()
            self._restaurar_configuracao_inicial()
            self.blockchain.reiniciar_estado()
            self.mempool.limpar()
            self.produtor.reset_automatic_mining_state()
            self.monitor_rede.reiniciar(
                self.obter_papel_no(), ultimo_evento="memoria_limpa"
            )
            self.monitor_rede.registrar_atividade(
                "memoria_limpa",
                "Estado em memória reiniciado via API.",
                "info",
                self.config.node_id,
            )

        return {
            "status": "memoria_limpa",
            "estado": self.obter_estado(),
        }

    def obter_logs(self, limite: int = 200) -> dict[str, object]:
        """Exibe os logs estruturados mantidos em memoria pelo nó."""

        return {
            "node_id": self.config.node_id,
            "transport": "polling",
            "updated_at": _timestamp_utc_atual(),
            "entries": self.coletor_logs.listar(limite),
        }

    def obter_estado(self) -> dict[str, object]:
        """Resumo curto do estado atual do nó."""

        with self.trava:
            self.blockchain.obter_dificuldade_global_ativa()
            ultimo_bloco = self.blockchain.obter_ultimo_bloco()
            estado = {
                "node_id": self.config.node_id,
                "papel_no": self.obter_papel_no(),
                "perfil_no": self.config.node_profile,
                "mineracao_automatica_ativa": (
                    self.iniciar_mineracao_automatica and not self.modo_observador
                ),
                "modo_observador": self.modo_observador,
                "difficulty": self.config.difficulty,
                "dificuldade_global": self.config.global_difficulty,
                "capacidade_mineracao": self.config.capacidade_mineracao(),
                "altura_cadeia": len(self.blockchain.chain),
                "hash_ponta": ultimo_bloco.block_hash,
                "quantidade_mempool": self.mempool.quantidade_pendente(),
                "forks_conhecidos": len(self.blockchain.cadeias_candidatas),
            }

        self._sincronizar_monitor_local()
        return estado

    def obter_cadeia(self) -> dict[str, object]:
        """Serializa a cadeia ativa e as cadeias candidatas para consulta externa."""

        with self.trava:
            cadeia_ativa = [bloco.para_dict() for bloco in self.blockchain.chain]
            cadeias_candidatas = [
                [bloco.para_dict() for bloco in cadeia]
                for cadeia in self.blockchain.cadeias_candidatas
            ]
            trabalho_ativo = self.blockchain.obter_trabalho_acumulado(
                self.blockchain.chain
            )

        return {
            "node_id": self.config.node_id,
            "cadeia_ativa": cadeia_ativa,
            "cadeias_candidatas": cadeias_candidatas,
            "trabalho_acumulado_ativo": trabalho_ativo,
        }

    def obter_mempool(self) -> dict[str, object]:
        """Lista os eventos ainda pendentes no nó local."""

        with self.trava:
            eventos = self.mempool.obter_eventos_pendentes(
                self.mempool.quantidade_pendente()
            )

        return {
            "node_id": self.config.node_id,
            "quantidade": len(eventos),
            "eventos": [evento_para_dict(evento) for evento in eventos],
        }

    def _evento_corresponde_ao_identificador(
        self,
        evento: SupplyChainEvent,
        identificador: str,
    ) -> bool:
        """Decide se o evento cria o item consultado."""

        lot_id = (
            evento.metadata.get("lot_id") if isinstance(evento.metadata, dict) else None
        )
        return (
            evento.event_id == identificador
            or evento.product_id == identificador
            or lot_id == identificador
        )

    def _resolver_evento_criador_rastreabilidade(
        self,
        eventos_confirmados: list[dict[str, object]],
        eventos_pendentes: list[dict[str, object]],
    ) -> dict[str, object] | None:
        """Resolve o evento criador da árvore ou falha quando a consulta for ambígua."""

        correspondencias = [
            *[
                {
                    "status": "confirmado",
                    "evento": item["evento"],
                }
                for item in eventos_confirmados
            ],
            *[
                {
                    "status": "pendente",
                    "evento": item,
                }
                for item in eventos_pendentes
            ],
        ]

        if not correspondencias:
            return None

        if len(correspondencias) > 1:
            raise ValueError(
                "Consulta ambígua: mais de um evento corresponde a este identificador. Consulte por event_id para desambiguar."
            )

        return correspondencias[0]

    def _construir_no_origem(
        self,
        event_id: str,
        eventos_confirmados_por_id: dict[str, dict[str, object]],
        eventos_pendentes_por_id: dict[str, SupplyChainEvent],
        visitados: set[str] | None = None,
    ) -> dict[str, object] | None:
        """Reconstrói a árvore de composição a partir do evento criador."""

        visitados = visitados or set()
        if event_id in visitados:
            return None

        visitados.add(event_id)

        try:
            if event_id in eventos_confirmados_por_id:
                dados_confirmados = eventos_confirmados_por_id[event_id]
                evento = dados_confirmados["evento_objeto"]
                no_origem = {
                    "status": "confirmado",
                    "evento": evento.para_dict(),
                    "block_index": dados_confirmados["block_index"],
                    "block_hash": dados_confirmados["block_hash"],
                    "miner_id": dados_confirmados["miner_id"],
                    "insumos": [],
                }
            else:
                evento = eventos_pendentes_por_id.get(event_id)
                if evento is None:
                    return None

                no_origem = {
                    "status": "pendente",
                    "evento": evento.para_dict(),
                    "block_index": None,
                    "block_hash": None,
                    "miner_id": None,
                    "insumos": [],
                }

            for input_id in evento.input_ids:
                no_filho = self._construir_no_origem(
                    input_id,
                    eventos_confirmados_por_id,
                    eventos_pendentes_por_id,
                    visitados,
                )
                if no_filho is not None:
                    no_origem["insumos"].append(no_filho)

            return no_origem
        finally:
            visitados.remove(event_id)

    def obter_rastreabilidade(self, identificador: str) -> dict[str, object]:
        """Monta o histórico e a árvore de composição de um item rastreável."""

        with self.trava:
            eventos_confirmados: list[dict[str, object]] = []
            eventos_confirmados_por_id: dict[str, dict[str, object]] = {}
            for bloco in self.blockchain.chain[1:]:
                for evento in bloco.events:
                    registro = {
                        "evento": evento.para_dict(),
                        "evento_objeto": evento,
                        "block_index": bloco.index,
                        "block_hash": bloco.block_hash,
                        "miner_id": bloco.miner_id,
                    }
                    eventos_confirmados_por_id[evento.event_id] = registro

                    if self._evento_corresponde_ao_identificador(evento, identificador):
                        eventos_confirmados.append(
                            {
                                "evento": evento.para_dict(),
                                "block_index": bloco.index,
                                "block_hash": bloco.block_hash,
                                "miner_id": bloco.miner_id,
                            }
                        )

            eventos_pendentes = []
            eventos_pendentes_por_id: dict[str, SupplyChainEvent] = {}
            for evento in self.mempool.obter_eventos_pendentes(
                self.mempool.quantidade_pendente()
            ):
                eventos_pendentes_por_id[evento.event_id] = evento
                if self._evento_corresponde_ao_identificador(evento, identificador):
                    eventos_pendentes.append(evento.para_dict())

        evento_criador = self._resolver_evento_criador_rastreabilidade(
            eventos_confirmados,
            eventos_pendentes,
        )

        ultimo_confirmado = (
            evento_criador["evento"]
            if evento_criador is not None and evento_criador["status"] == "confirmado"
            else None
        )
        ultimo_pendente = (
            evento_criador["evento"]
            if evento_criador is not None and evento_criador["status"] == "pendente"
            else None
        )
        evento_atual = ultimo_pendente or ultimo_confirmado

        evento_criador_id = None
        if evento_atual is not None:
            evento_criador_id = evento_atual["event_id"]

        arvore_origem = None
        if evento_criador_id is not None:
            arvore_origem = self._construir_no_origem(
                evento_criador_id,
                eventos_confirmados_por_id,
                eventos_pendentes_por_id,
            )

        estado_atual = {
            "status": "nao_encontrado"
            if evento_atual is None
            else "pendente"
            if ultimo_pendente
            else "confirmado",
            "ultimo_evento": evento_atual,
            "quantidade_confirmada": len(eventos_confirmados),
            "quantidade_pendente": len(eventos_pendentes),
        }

        return {
            "node_id": self.config.node_id,
            "identificador": identificador,
            "eventos_confirmados": eventos_confirmados,
            "eventos_pendentes": eventos_pendentes,
            "estado_atual": estado_atual,
            "arvore_origem": arvore_origem,
        }

    def obter_rede(self) -> dict[str, object]:
        """Devolve a visão local da rede conhecida pelo nó."""

        with self.trava:
            ultimo_bloco = self.blockchain.obter_ultimo_bloco()
            resumo = self.monitor_rede.obter_resumo_rede_local(
                altura_cadeia=len(self.blockchain.chain),
                hash_ponta=ultimo_bloco.block_hash,
                tamanho_mempool=self.mempool.quantidade_pendente(),
                forks_conhecidos=len(self.blockchain.cadeias_candidatas),
            )

        return resumo

    def obter_demonstracao(self) -> dict[str, object]:
        """Entrega um resumo curto para a demonstração do projeto."""

        with self.trava:
            estado = self.obter_estado()
            demonstracao = self.monitor_rede.obter_resumo_demonstracao()
            atividades = self.monitor_rede.listar_atividades(limite=20)

        return {
            "node_id": self.config.node_id,
            "estado_no": estado,
            "demonstracao": demonstracao,
            "atividades": atividades,
        }

    def listar_cenarios_teste(self) -> list[dict[str, object]]:
        """Lista os cenarios oficiais expostos pelo backend."""

        return self.executor_testes.listar_cenarios()

    def detalhar_cenario_teste(self, scenario_id: str) -> dict[str, object] | None:
        """Retorna a definicao completa de um cenario especifico."""

        return self.executor_testes.obter_cenario(scenario_id)

    def executar_cenario_teste(
        self,
        scenario_id: str,
        payload: dict[str, object] | None = None,
    ) -> dict[str, object] | None:
        """Executa um cenario registrado e devolve o resultado padronizado."""

        return self.executor_testes.executar_cenario(scenario_id, payload)
