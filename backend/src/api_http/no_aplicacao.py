"""Serviço de aplicação usado pela API HTTP de cada nó."""

from __future__ import annotations

from threading import RLock, Thread

from src.core.config import CoreConfig
from src.core.models.event import SupplyChainEvent
from src.core.serialization.json_codec import bloco_para_dict, evento_para_dict
from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from src.rede import NoConsumidor, NoProdutor
from src.rede.monitor_rede import MonitorRede


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
        self.trava = RLock()
        self.blockchain = Blockchain(config=self.config)
        self.mempool = Mempool()
        self.monitor_rede = MonitorRede(
            node_id_local=self.config.node_id,
            papel_local=self.obter_papel_no(),
        )
        self.produtor = NoProdutor(
            self.config.node_id,
            self.url_broker,
            self.blockchain,
            self.mempool,
            trava=self.trava,
            monitor_rede=self.monitor_rede,
        )
        self.consumidor = NoConsumidor(
            self.config.node_id,
            self.url_broker,
            self.blockchain,
            self.mempool,
            trava=self.trava,
            monitor_rede=self.monitor_rede,
            aceitar_evento=self.adicionar_evento_recebido_da_rede,
        )
        self._thread_consumidor: Thread | None = None
        self._thread_mineracao: Thread | None = None
        self._encerrado = False

    def obter_papel_no(self) -> str:
        """Resume o papel operacional do nó para API e monitoramento."""

        if self.modo_observador:
            return "observador"
        if not self.iniciar_mineracao_automatica:
            return "controle"
        return "minerador"

    def iniciar(self) -> None:
        """Sobe consumidor e, se for o caso, o ciclo automático de mineração."""

        if self._thread_consumidor is None:
            self._thread_consumidor = Thread(
                target=self.consumidor.iniciar_escuta,
                daemon=True,
                name=f"consumidor-{self.config.node_id}",
            )
            self._thread_consumidor.start()

        if (
            not self.modo_observador
            and self.iniciar_mineracao_automatica
            and self._thread_mineracao is None
        ):
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

    def _atualizar_monitor_local(self, ultimo_evento: str) -> None:
        """Mantém o resumo local do nó atualizado no monitor de rede."""

        with self.trava:
            ultimo_bloco = self.blockchain.obter_ultimo_bloco()
            self.monitor_rede.atualizar_no(
                self.config.node_id,
                papel=self.obter_papel_no(),
                status="online",
                altura_cadeia=len(self.blockchain.chain),
                hash_ponta=ultimo_bloco.block_hash,
                tamanho_mempool=self.mempool.quantidade_pendente(),
                ultimo_evento=ultimo_evento,
            )

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
        if evento.event_id in contexto_eventos:
            return "evento_duplicado"

        if not self.blockchain.validator.validar_evento_de_dominio(
            evento,
            contexto_eventos,
            contexto_consumidos,
        ):
            return "evento_invalido_no_contexto_atual"

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
            self.monitor_rede.registrar_atividade(
                "evento_rejeitado",
                "Payload de evento inválido recebido pela API.",
                "warning",
                self.config.node_id,
            )
            return {"status": "evento_rejeitado", "motivo": "payload_invalido"}

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
                self.monitor_rede.registrar_atividade(
                    "evento_rejeitado",
                    f"Evento {evento.event_id} rejeitado ({motivo}).",
                    "warning",
                    self.config.node_id,
                    event_id_relacionado=evento.event_id,
                )
                return {"status": "evento_rejeitado", "motivo": motivo}

            if not self.mempool.adicionar_evento(evento):
                self.monitor_rede.registrar_atividade(
                    "evento_rejeitado",
                    f"Evento {evento.event_id} não entrou na mempool.",
                    "warning",
                    self.config.node_id,
                    event_id_relacionado=evento.event_id,
                )
                return {
                    "status": "evento_rejeitado",
                    "motivo": "falha_ao_adicionar_na_mempool",
                }

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

        return {
            "status": "evento_adicionado",
            "event_id": evento.event_id,
            "node_id": self.config.node_id,
        }

    def adicionar_evento_recebido_da_rede(self, evento: SupplyChainEvent) -> bool:
        """Caminho usado pelo consumidor Kafka para validar evento remoto."""

        resultado = self.adicionar_evento(
            evento,
            publicar_na_rede=False,
            origem="rede",
        )
        return resultado["status"] == "evento_adicionado"

    def minerar_uma_vez(self) -> dict[str, object]:
        """Executa uma rodada manual de mineração."""

        if self.modo_observador:
            return {"status": "mineracao_indisponivel", "motivo": "no_observador"}

        bloco = self.produtor.minerar_uma_vez()
        self._atualizar_monitor_local("mineracao_manual")
        if bloco is None:
            return {"status": "sem_eventos_pendentes"}

        return {"status": "bloco_minerado", "bloco": bloco_para_dict(bloco)}

    def obter_estado(self) -> dict[str, object]:
        """Resumo curto do estado atual do nó."""

        with self.trava:
            ultimo_bloco = self.blockchain.obter_ultimo_bloco()
            estado = {
                "node_id": self.config.node_id,
                "papel_no": self.obter_papel_no(),
                "difficulty": self.config.difficulty,
                "altura_cadeia": len(self.blockchain.chain),
                "hash_ponta": ultimo_bloco.block_hash,
                "quantidade_mempool": self.mempool.quantidade_pendente(),
                "forks_conhecidos": len(self.blockchain.cadeias_candidatas),
            }

        self._atualizar_monitor_local("consulta_estado")
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

        ultimo_confirmado = (
            eventos_confirmados[-1]["evento"] if eventos_confirmados else None
        )
        ultimo_pendente = eventos_pendentes[-1] if eventos_pendentes else None
        evento_atual = ultimo_pendente or ultimo_confirmado

        evento_criador_id = None
        if ultimo_pendente is not None:
            evento_criador_id = ultimo_pendente["event_id"]
        elif ultimo_confirmado is not None:
            evento_criador_id = ultimo_confirmado["event_id"]

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
