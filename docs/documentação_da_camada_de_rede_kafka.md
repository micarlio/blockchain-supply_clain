# Documentação Técnica: Lógica de Integração e Fluxo de Rede (Kafka)

## 1. Visão Geral da Arquitetura

A camada de rede foi desenhada sob o padrão arquitetural de Wrapper (Envelope). O objetivo principal desta arquitetura é garantir o Desacoplamento Absoluto: o Core da Blockchain (regras de negócio, mineração, validação de hashes) não tem qualquer conhecimento sobre a existência da rede, da internet ou do Kafka.

Toda a comunicação distribuída atua como uma "capa" em torno do Core. Ela intercepta as saídas do Core local e as injeta na rede, ao mesmo tempo que escuta a rede e injeta os dados externos de volta no Core através de interfaces bem definidas.

## 2. Infraestrutura de Mensageria

A rede utiliza o Apache Kafka (operando em modo KRaft, sem Zookeeper) como Message Broker. Toda a comunicação assíncrona é segmentada em dois tópicos principais:

- `supply-chain-events`: Tópico dedicado ao tráfego de transações individuais (eventos de criação de produtos, transferência de matéria-prima, etc.). Os nós escutam este tópico para alimentar as suas Mempools locais.

- `supply-chain-blocks`: Tópico dedicado ao tráfego de blocos fechados. Quando um nó resolve a Proof of Work, ele serializa o bloco validado e publica neste tópico para que o resto da rede o anexe à cadeia.

## 3. Componentes da Aplicação de Rede (network_node.py)

A camada de integração é dividida em dois atores principais que rodam em threads paralelas dentro de cada nó da rede.

### 3.1. O Produtor (`NodeProducer`)

Responsável por exportar o trabalho local para a rede distribuída.

- **Ciclo de Vida**: Roda num loop infinito (`start_mining_loop`), monitorizando a `mempool` local.

- **Integração com o Core**: Instancia e aciona a classe `Miner` do Core. Se o método `mine_from_mempool` retornar um bloco válido, o Produtor assume o controlo.

- **Atribuição de Autoria**: Antes de publicar, injeta o `node_id` no campo `miner_id` do bloco. Isto é crucial para o rastreio na rede.

- **Serialização e Envio**: Utiliza a interface `block_to_json` do Core para converter o objeto Python em bytes e envia-o para o tópico `supply-chain-blocks` utilizando a biblioteca `confluent-kafka`.

### 3.2. O Consumidor (`NodeConsumer`)

Atua como a porta de entrada de dados externos para o nó local.

- **Inscrição (Subscribe)**: Conecta-se ao Kafka utilizando um `group.id` exclusivo (ex: `node-group-node-alpha`), garantindo que cada nó receba uma cópia de todas as mensagens da rede (padrão *Broadcast*).

- **Camada de Segurança e Desserialização**: Captura os bytes da rede e tenta converter para um dicionário Python via `json.loads`. Mensagens corrompidas ou fora do formato JSON são descartadas silenciosamente, protegendo o Core de falhas de parsing.

- **O Filtro de Autoria (Regra de Ouro)**: * Para evitar loops infinitos onde um nó tenta reprocessar um bloco que ele próprio acabou de minerar, o Consumidor verifica o campo `miner_id` (para blocos) ou `actor_id` (para eventos).

    - Se o ID coincidir com o do próprio nó (`self.node_id`), a mensagem é ignorada na camada de rede, poupando a CPU de processamento inútil.

- **Injeção no Core**:

    - **Eventos**: São convertidos via `event_from_json` e injetados via `mempool.add_event(event)`.

    - **Blocos**: O dicionário bruto é passado para `blockchain.handle_incoming_block(data)`, delegando ao Core a responsabilidade de validar *hashes*, verificar assinaturas, identificar *forks* e anexar à cadeia.

## 4. Modos de Operação dos Nós (`local_node.py`)

Para permitir testes flexíveis e simular uma rede realista, o orquestrador dos nós suporta dois modos de execução paramétricos:

1. **Modo Minerador (Padrão)**: O nó roda tanto o `NodeProducer` quanto o `NodeConsumer`. Ele ativamente busca eventos na rede, calcula *Proof of Work* e compete para publicar blocos.

2. **Modo Observador (`--observer`)**: O nó roda apenas o `NodeConsumer`. Ele atua como um nó de auditoria ou uma carteira leve: recebe transações e blocos, valida-os localmente através do Core, atualiza o seu livro-razão (Ledger) mas não minera. Ideal para quebrar o determinismo em testes locais.

## 5. Simulação de Entrada de Dados (`event_generator.py`)

Para alimentar a rede, foi desenvolvido um script gerador que atua como um sistema externo (ex: o sistema de ERP de uma fábrica).

- **Contrato Estrito**: O gerador constrói JSONs que respeitam rigorosamente o contrato do Core da V1, incluindo `event_id`, `event_type`, `product_id`, e `timestamp` em formato ISO-8601 UTC.

- **Fluxo**: Publica diretamente no tópico `supply-chain-events`, simulando a entrada massiva de dados no ecossistema de *Supply Chain*.

## 6. Fluxo de Vida Completo de uma Transação

Para clareza, aqui está o caminho exato que um dado percorre no sistema integrado:

1. **Geração**: `event_generator.py` publica um evento em JSON no Kafka (`supply-chain-events`).

2. **Receção**: O `NodeConsumer` de todos os nós ativos captura o JSON, valida-o e converte-o.

3. **Pendente**: O evento é injetado na `Mempool` local de cada nó.

4. **Mineração**: O `NodeProducer` do Nó Alpha identifica eventos pendentes, aciona o `Miner` do Core e resolve a *Proof of Work*.

5. **Propagação de Bloco**: O Nó Alpha publica o novo bloco JSON no tópico `supply-chain-blocks`.

6. **Descarte (Alpha)**: O `NodeConsumer` do Nó Alpha recebe o bloco pela rede, vê que o `miner_id` é o seu próprio e ignora a mensagem.

7. **Consenso (Beta/Observadores)**: O `NodeConsumer` dos restantes nós recebe o bloco, passa-o para a `Blockchain` local, que o valida e anexa, atingindo o consenso distribuído.

## 7. Observabilidade (Logging)

Para efeitos de demonstração, depuração e auditoria, toda a camada de rede foi equipada com a biblioteca nativa `logging` do Python.

- Substitui os tradicionais `prints`, permitindo alterar o nível de ruído visual.

- **Nível DEBUG**: Exibe tentativas de mineração, atualizações de tamanho da mempool e deteção de bytes em bruto no Kafka.

- **Nível INFO**: Foca nos eventos cruciais de negócio: Blocos minerados com sucesso e blocos integrados com sucesso.

- **Nível ERROR/WARNING**: Captura JSONs mal formatados e falhas estruturais levantadas pelo Core na hora da validação da cadeia.