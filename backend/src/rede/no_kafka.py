"""Adaptadores de rede via Kafka para eventos e blocos."""

from __future__ import annotations

import json
import time
from contextlib import nullcontext
from threading import RLock
from typing import Callable

from confluent_kafka import Consumer, Producer

from src.core.services.blockchain import (
    STATUS_BLOCO_ADICIONADO,
    STATUS_BLOCO_FORK,
    STATUS_BLOCO_REJEITADO,
    STATUS_CADEIA_REORGANIZADA,
    STATUS_PAYLOAD_INVALIDO,
)
from src.core.services.miner import Miner
from src.core.serialization.json_codec import (
    bloco_para_json,
    evento_de_json,
    evento_para_json,
)
from src.rede.monitor_rede import MonitorRede

TOPICO_BLOCOS = "cadeia-suprimentos-blocos"
TOPICO_EVENTOS = "cadeia-suprimentos-eventos"


def _cabecalhos_com_origem(node_id: str) -> list[tuple[str, str]]:
    """Coloca o id do nó nos cabeçalhos da mensagem."""

    return [("origem_no", node_id)]


def _obter_origem_no(mensagem) -> str | None:
    """Lê o nó remetente a partir dos cabeçalhos do Kafka."""

    cabecalhos = mensagem.headers() or []
    for chave, valor in cabecalhos:
        if chave != "origem_no":
            continue
        if isinstance(valor, bytes):
            return valor.decode("utf-8")
        if isinstance(valor, str):
            return valor

    return None


def notificar_entrega(erro, mensagem):
    """Mostra um log simples depois do envio ao broker."""

    if erro:
        print(f"[Kafka] Falha ao entregar mensagem: {erro}")
    else:
        print(f"[Kafka] Mensagem entregue no tópico '{mensagem.topic()}'.")


class NoProdutor:
    """Camada que minera blocos e publica eventos/blocos na rede."""

    def __init__(
        self,
        node_id: str,
        url_broker: str,
        blockchain,
        mempool,
        *,
        trava: RLock | None = None,
        monitor_rede: MonitorRede | None = None,
    ):
        self.node_id = node_id
        self.blockchain = blockchain
        self.mempool = mempool
        self.produtor = Producer({"bootstrap.servers": url_broker})
        self.topico_blocos = TOPICO_BLOCOS
        self.topico_eventos = TOPICO_EVENTOS
        self.minerador = Miner(config=self.blockchain.config)
        self.trava = trava
        self.monitor_rede = monitor_rede
        self._encerrado = False

    def iniciar_ciclo_mineracao(self):
        """Loop simples de mineração em background."""

        while True:
            self.minerar_uma_vez()
            time.sleep(2)

    def _publicar_payload_json(self, topico: str, payload_json: str) -> None:
        """Enfileira a mensagem no Kafka sem bloquear a thread chamadora."""

        self.produtor.produce(
            topic=topico,
            value=payload_json.encode("utf-8"),
            headers=_cabecalhos_com_origem(self.node_id),
            callback=notificar_entrega,
        )
        self.produtor.poll(0)

    def minerar_uma_vez(self):
        """Executa uma rodada de mineração e publica o bloco achado."""

        contexto = self.trava if self.trava is not None else nullcontext()
        with contexto:
            if len(self.mempool) == 0:
                return None

            bloco = self.minerador.minerar_da_mempool(self.blockchain, self.mempool)
            if bloco is None:
                return None

        bloco.miner_id = self.node_id
        print(
            f"[Minerador] Bloco #{bloco.index} minerado por {self.node_id}. Publicando na rede..."
        )
        self.publicar_bloco(bloco)

        if self.monitor_rede is not None:
            self.monitor_rede.registrar_atividade(
                "bloco_minerado",
                f"Bloco #{bloco.index} minerado por {self.node_id}.",
                "success",
                self.node_id,
                hash_relacionado=bloco.block_hash,
            )

        return bloco

    def publicar_bloco(self, bloco) -> None:
        """Publica um bloco serializado no tópico de blocos."""

        bloco_json = bloco_para_json(bloco)
        self._publicar_payload_json(self.topico_blocos, bloco_json)

    def publicar_evento(self, evento) -> None:
        """Publica um evento serializado no tópico de eventos."""

        evento_json = evento_para_json(evento)
        self._publicar_payload_json(self.topico_eventos, evento_json)

    def encerrar(self, timeout: float = 5.0) -> None:
        """Drena mensagens pendentes antes de desligar o processo."""

        if self._encerrado:
            return

        self.produtor.flush(timeout)
        self._encerrado = True

    def start_mining_loop(self):
        """Alias de compatibilidade para `iniciar_ciclo_mineracao`."""

        self.iniciar_ciclo_mineracao()

    def mine_once(self):
        """Alias de compatibilidade para `minerar_uma_vez`."""

        return self.minerar_uma_vez()

    def publish_block(self, block) -> None:
        """Alias de compatibilidade para `publicar_bloco`."""

        self.publicar_bloco(block)

    def publish_event(self, event) -> None:
        """Alias de compatibilidade para `publicar_evento`."""

        self.publicar_evento(event)

    def close(self, timeout: float = 5.0) -> None:
        """Alias de compatibilidade para `encerrar`."""

        self.encerrar(timeout)


class NoConsumidor:
    """Escuta o Kafka e repassa eventos/blocos para o núcleo local."""

    def __init__(
        self,
        node_id: str,
        url_broker: str,
        blockchain,
        mempool,
        *,
        trava: RLock | None = None,
        monitor_rede: MonitorRede | None = None,
        aceitar_evento: Callable | None = None,
    ):
        self.node_id = node_id
        self.blockchain = blockchain
        self.mempool = mempool
        self.trava = trava
        self.monitor_rede = monitor_rede
        self.aceitar_evento = aceitar_evento
        self.consumidor = Consumer(
            {
                "bootstrap.servers": url_broker,
                "group.id": f"grupo-no-{self.node_id}",
                "auto.offset.reset": "latest",
            }
        )
        self.consumidor.subscribe([TOPICO_BLOCOS, TOPICO_EVENTOS])

    def iniciar_escuta(self):
        """Loop principal de consumo do Kafka."""

        try:
            while True:
                mensagem = self.consumidor.poll(1.0)

                if mensagem is None or mensagem.error():
                    continue

                topico = mensagem.topic()
                payload = mensagem.value().decode("utf-8")
                origem_no = _obter_origem_no(mensagem)

                try:
                    dados = json.loads(payload)
                except json.JSONDecodeError:
                    print(
                        f"[Alerta JSON] Recebi algo no tópico '{topico}' mas não era JSON válido."
                    )
                    print(f"Conteúdo recebido: {payload[:100]}...")
                    continue

                if topico == TOPICO_BLOCOS:
                    self._processar_bloco_recebido(dados, origem_no)
                    continue

                if topico == TOPICO_EVENTOS:
                    self._processar_evento_recebido(payload, dados, origem_no)

        except KeyboardInterrupt:
            pass
        finally:
            self.consumidor.close()

    def _processar_bloco_recebido(
        self,
        dados: dict[str, object],
        origem_no: str | None,
    ) -> None:
        """Trata um bloco recebido da rede."""

        remetente = origem_no or dados.get("miner_id")
        if remetente == self.node_id:
            print(f"[Rede] Bloco próprio descartado pelo nó {self.node_id}.")
            if self.monitor_rede is not None:
                self.monitor_rede.registrar_atividade(
                    "bloco_proprio_descartado",
                    f"Bloco próprio descartado pelo nó {self.node_id}.",
                    "info",
                    self.node_id,
                    hash_relacionado=dados.get("block_hash"),
                )
            return

        print(f"[Rede] Recebido bloco de '{remetente}'. Repassando ao núcleo.")
        contexto = self.trava if self.trava is not None else nullcontext()
        with contexto:
            resultado = self.blockchain.processar_bloco_recebido(dados)
            if resultado in (STATUS_BLOCO_ADICIONADO, STATUS_CADEIA_REORGANIZADA):
                eventos_confirmados = dados.get("events", [])
                ids_eventos = []
                for item in eventos_confirmados:
                    if isinstance(item, dict):
                        event_id = item.get("event_id")
                        if isinstance(event_id, str):
                            ids_eventos.append(event_id)

                if ids_eventos:
                    self.mempool.remover_eventos(ids_eventos)
                    print(
                        f"[Mempool] Eventos confirmados removidos da fila: {ids_eventos}"
                    )

        print(f"[Núcleo] Resultado do bloco de '{remetente}': {resultado}")

        if self.monitor_rede is not None and isinstance(remetente, str):
            self.monitor_rede.atualizar_no(
                remetente, status="online", ultimo_evento="bloco_recebido"
            )
            tipo_atividade = "bloco_recebido"
            severidade = "info"

            if resultado == STATUS_BLOCO_FORK:
                tipo_atividade = "fork_detectado"
                severidade = "warning"
            elif resultado == STATUS_CADEIA_REORGANIZADA:
                tipo_atividade = "cadeia_reorganizada"
                severidade = "success"
            elif resultado in (STATUS_BLOCO_REJEITADO, STATUS_PAYLOAD_INVALIDO):
                tipo_atividade = "bloco_rejeitado"
                severidade = "warning"

            self.monitor_rede.registrar_atividade(
                tipo_atividade,
                f"Bloco vindo de {remetente} resultou em {resultado}.",
                severidade,
                self.node_id,
                hash_relacionado=dados.get("block_hash"),
            )

    def _processar_evento_recebido(
        self,
        payload: str,
        dados: dict[str, object],
        origem_no: str | None,
    ) -> None:
        """Trata um evento recebido da rede."""

        remetente = origem_no or dados.get("actor_id")
        if remetente == self.node_id:
            print(f"[Rede] Evento próprio descartado pelo nó {self.node_id}.")
            if self.monitor_rede is not None:
                self.monitor_rede.registrar_atividade(
                    "evento_proprio_descartado",
                    f"Evento próprio descartado pelo nó {self.node_id}.",
                    "info",
                    self.node_id,
                    event_id_relacionado=dados.get("event_id"),
                )
            return

        evento = evento_de_json(payload)
        if evento is None:
            return

        contexto = self.trava if self.trava is not None else nullcontext()
        with contexto:
            if self.aceitar_evento is not None:
                sucesso = bool(self.aceitar_evento(evento))
            else:
                sucesso = self.mempool.adicionar_evento(evento)

        print(f"[Mempool] Evento {evento.event_id} entrou na fila? {sucesso}")

        if self.monitor_rede is not None:
            self.monitor_rede.registrar_atividade(
                "evento_recebido",
                f"Evento {evento.event_id} recebido da rede.",
                "info" if sucesso else "warning",
                self.node_id,
                event_id_relacionado=evento.event_id,
            )
            if isinstance(remetente, str):
                self.monitor_rede.atualizar_no(
                    remetente, status="online", ultimo_evento="evento_recebido"
                )

    def start_listening(self):
        """Alias de compatibilidade para `iniciar_escuta`."""

        self.iniciar_escuta()


NodeProducer = NoProdutor
NodeConsumer = NoConsumidor
