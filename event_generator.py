import json
import time
from datetime import datetime, timezone
import uuid
from confluent_kafka import Producer

def main():
    producer = Producer({'bootstrap.servers': 'localhost:9092'})
    topic = 'supply-chain-events'
    
    print("🚀 Iniciando gerador automático de eventos...")
    print("Pressione Ctrl+C para parar.\n")
    
    try:
        while True:
            evento = {
                "event_id": str(uuid.uuid4()),
                "event_type": "PRODUTO_CRIADO",
                "product_id": f"prod-{uuid.uuid4().hex[:6]}",
                "product_name": "Produto de Teste",
                "actor_id": "script-gerador",
                "actor_role": "fabricante",
                "timestamp": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
                "input_ids": [],
                "metadata": {"fonte": "automacao"}
            }
            
            payload = json.dumps(evento)
            producer.produce(topic, value=payload.encode('utf-8'))
            producer.poll(0) # Força o envio da mensagem
            
            print(f"✅ Evento enviado para a rede: {evento['event_id']}")
            
            # Aguarda 5 segundos antes de enviar o próximo evento
            time.sleep(5) 
            
    except KeyboardInterrupt:
        print("\n🛑 Gerador automático desligado.")
    finally:
        producer.flush()

if __name__ == '__main__':
    main()