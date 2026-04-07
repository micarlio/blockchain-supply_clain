import json
import time
import logging
from confluent_kafka import Producer, Consumer, KafkaError

from src.core.services.miner import Miner
from src.core.serialization.json_codec import block_to_json, event_from_json

# Configuração global de logs. Mude level=logging.DEBUG para level=logging.INFO para ocultar logs de debug.
logging.basicConfig(level=logging.INFO, format='%(message)s')

def notificar_entrega(err, msg):
    if err:
        logging.error(f"❌ [Kafka Error] Falha ao entregar bloco ao broker: {err}")
    else:
        logging.info(f"✅ [Kafka] Bloco entregue com sucesso ao tópico '{msg.topic()}'!")

class NodeProducer:
    def __init__(self, node_id: str, broker_url: str, blockchain, mempool):
        self.node_id = node_id
        self.blockchain = blockchain
        self.mempool = mempool
        self.producer = Producer({'bootstrap.servers': broker_url})
        self.topic_blocks = 'supply-chain-blocks'
        self.miner = Miner()

    def start_mining_loop(self):
        while True:
            if len(self.mempool) > 0:
                logging.debug("[Miner] Tentando minerar bloco...")
                block = self.miner.mine_from_mempool(self.blockchain, self.mempool)
                
                if block:
                    block.miner_id = self.node_id
                    
                    try:
                        block_json = block_to_json(block)
                        logging.info(f"[Miner] Sucesso! Publicando bloco #{block.index}...")
                        
                        self.producer.produce(
                            topic=self.topic_blocks,
                            value=block_json.encode('utf-8'),
                            callback=notificar_entrega
                        )
                        self.producer.flush() 
                    except Exception as e:
                        logging.error(f"❌ [Erro Fatal] Falha ao serializar ou enviar o bloco: {e}")
                else:
                    logging.debug("[Miner] Falha! Core retornou None.")
            time.sleep(2)

class NodeConsumer:
    def __init__(self, node_id: str, broker_url: str, blockchain, mempool):
        self.node_id = node_id
        self.blockchain = blockchain
        self.mempool = mempool
        self.consumer = Consumer({
            'bootstrap.servers': broker_url,
            'group.id': f'node-group-{self.node_id}',
            'auto.offset.reset': 'latest'
        })
        self.consumer.subscribe(['supply-chain-blocks', 'supply-chain-events'])

    def start_listening(self):
        try:
            while True:
                msg = self.consumer.poll(1.0)

                if msg is None or msg.error():
                    continue

                topic = msg.topic()
                payload = msg.value().decode('utf-8')
                
                if topic == 'supply-chain-blocks':
                    logging.debug(f"👀 [Rede] Sinal detectado no tópico de blocos. Tamanho: {len(payload)} bytes")

                try:
                    data = json.loads(payload)
                except json.JSONDecodeError:
                    logging.warning(f"⚠️ [Alerta JSON] Recebi algo no tópico '{topic}' mas NÃO é um JSON válido. Descartando!")
                    logging.warning(f"Conteúdo recebido: {payload[:100]}...")
                    continue

                if topic == 'supply-chain-blocks':
                    sender = data.get('miner_id')
                    
                    if sender == self.node_id:
                        logging.debug(f"♻️ [Rede] Bloco recebido de mim mesmo. Ignorando.")
                        continue
                    
                    logging.info(f"📥 [Rede] Recebido bloco de '{sender}'. Repassando ao Core...")
                    try:
                        self.blockchain.handle_incoming_block(data)
                        logging.info(f"🏆 [Core] Bloco de '{sender}' integrado com sucesso!")
                    except Exception as e:
                        logging.error(f"❌ [Core Error] Falha ao integrar bloco externo: {e}")

                elif topic == 'supply-chain-events':
                    sender = data.get('actor_id')
                    if sender == self.node_id:
                        continue
                    
                    event = event_from_json(payload)
                    if event:
                        sucesso = self.mempool.add_event(event)
                        logging.debug(f"[Mempool] Evento adicionado? {sucesso} | Total pendente: {len(self.mempool)}")

        except KeyboardInterrupt:
            pass
        finally:
            self.consumer.close()