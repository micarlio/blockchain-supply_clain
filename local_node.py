# import sys
# import threading
# import time

# from src.core.services.blockchain import Blockchain
# from src.core.services.mempool import Mempool
# from network_node import NodeProducer, NodeConsumer

# def main():
#     if len(sys.argv) < 2:
#         print("Usage: python local_node.py <node_id>")
#         sys.exit(1)

#     node_id = sys.argv[1]
#     broker_url = 'localhost:9092'

#     blockchain = Blockchain()
#     mempool = Mempool()

#     producer = NodeProducer(node_id, broker_url, blockchain, mempool)
#     consumer = NodeConsumer(node_id, broker_url, blockchain, mempool)

#     consumer_thread = threading.Thread(target=consumer.start_listening, daemon=True)
#     producer_thread = threading.Thread(target=producer.start_mining_loop, daemon=True)

#     consumer_thread.start()
#     producer_thread.start()

#     print(f"Node {node_id} started. Press Ctrl+C to stop.")

#     try:
#         while True:
#             time.sleep(1)
#     except KeyboardInterrupt:
#         pass

# if __name__ == '__main__':
#     main()

import sys
import threading
import time

from src.core.services.blockchain import Blockchain
from src.core.services.mempool import Mempool
from network_node import NodeProducer, NodeConsumer

def main():
    if len(sys.argv) < 2:
        print("Uso: python local_node.py <node_id> [--observer]")
        sys.exit(1)

    node_id = sys.argv[1]
    is_observer = "--observer" in sys.argv
    broker_url = 'localhost:9092'

    blockchain = Blockchain()
    mempool = Mempool()

    consumer = NodeConsumer(node_id, broker_url, blockchain, mempool)
    consumer_thread = threading.Thread(target=consumer.start_listening, daemon=True)
    consumer_thread.start()

    if is_observer:
        print(f"👁️ Nó {node_id} iniciado em modo OBSERVADOR (Não minera, apenas valida).")
    else:
        producer = NodeProducer(node_id, broker_url, blockchain, mempool)
        producer_thread = threading.Thread(target=producer.start_mining_loop, daemon=True)
        producer_thread.start()
        print(f"⛏️ Nó {node_id} iniciado em modo MINERADOR.")

    print("Pressione Ctrl+C para parar.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    main()