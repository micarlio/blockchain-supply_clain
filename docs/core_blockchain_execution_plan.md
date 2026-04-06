### Projeto: Blockchain distribuida para rastreabilidade (*Supply Chain*)

## 1. Objetivo

Aqui eu organizo o escopo do modulo **core da blockchain**.  
A ideia é deixar claro o que precisa existir, o que pode ficar para depois e qual caminho faz mais sentido seguir na implementacao.

Em resumo, ele serve para responder:

- o que faz parte da frente do core
- o que nao faz parte desta versao
- quais modulos precisam existir
- como organizar o projeto
- em que ordem implementar

---

## 2. Escopo da frente (Core da Blockchain)

### O que entra

O core precisa ser um modulo local, independente da rede, capaz de:

- representar eventos do dominio
- representar blocos
- manter a cadeia local
- manter uma mempool de eventos pendentes
- minerar blocos com `Proof of Work`
- validar eventos, blocos e cadeias
- serializar e desserializar dados em JSON
- receber bloco externo para validacao
- reconhecer fork
- escolher a melhor cadeia
- sustentar uma demonstracao local com mais de um no

### O que nao entra

Alguns pontos ficam fora do core:

- Kafka
- topico, `publish`, `subscribe`
- API HTTP
- interface grafica
- banco de dados
- persistencia robusta
- SPV
- Merkle tree real
- ajuste dinamico de dificuldade
- validacao semantica profunda do dominio
- assinatura digital
- carteira ou identidade de usuario

### Limite de escopo

Se alguma ideia nao for necessaria para:

- criar bloco
- minerar bloco
- validar bloco
- validar cadeia
- suportar fork
- integrar por JSON

entao ela nao deve entrar neste momento no core.

---

## 3. Decisoes ja assumidas inicialmente

1. o bloco tera separacao logica entre **header** e **body**, mesmo que o JSON final seja plano
2. `data_hash` sera calculado como `SHA256(serialized(events))`
3. `block_hash` sera calculado a partir do cabecalho serializado
4. a serializacao usada no hash precisa ser deterministica, com chaves ordenadas
5. o bloco genesis sera fixo e igual para todos os nos
6. a dificuldade sera configuravel, mas fixa por execucao na V1
7. o consenso da V1 vai usar cadeia valida mais longa como aproximacao de maior trabalho acumulado
8. a mempool sera em memoria
9. a validacao do evento sera estrutural, nao semantica
10. forks simples precisam ser aceitos
11. reorganizacao simples de cadeia precisa ser suportada
12. o core precisa estar pronto para receber blocos externos em JSON

---

## 4. Relacao com as outras frentes

### O que vem da modelagem

Do ponto de vista do core, a dependencia real da modelagem e pequena.  
O que precisa vir dessa frente e:

- lista final de `event_type`
- definicao final do `metadata`
- cenario de ataque adaptado ao dominio

Enquanto isso nao estiver fechado, o core pode trabalhar com um contrato minimo de evento.

### O que o core entrega para a comunicacao

Para a parte de comunicacao, o core precisa disponibilizar:

- formato JSON de `SupplyChainEvent`
- formato JSON de `Block`
- serializacao
- desserializacao
- validacao de bloco recebido
- tentativa de anexar ou descartar bloco externo

### O que fica fora do core

Nao faz parte desta frente:

- ignorar mensagens proprias na camada de rede
- publicar bloco minerado
- ouvir topico ou canal
- sincronizar cadeia pela rede

Isso tudo pode usar o core, mas nao precisa estar implementado dentro dele.

---

## 5. Estrutura do modulo

O modulo pode ser mantido simples.  
O importante aqui nao e inventar muita camada, e sim deixar cada parte com uma responsabilidade clara.

### `SupplyChainEvent`

Representa o evento minimo do dominio.

Responsabilidades:

- guardar os dados do evento
- validar a estrutura minima
- converter para `dict`
- reconstruir a partir de `dict`

### `Block`

Representa um bloco mineravel.

Responsabilidades:

- guardar header e body
- calcular `data_hash`
- calcular `block_hash`
- validar `Proof of Work`
- serializar e desserializar

### `Mempool`

Guarda eventos pendentes.

Responsabilidades:

- adicionar evento sem duplicata
- selecionar eventos em ordem FIFO
- remover eventos confirmados
- reinserir eventos quando necessario

### `Miner`

Responsavel pela mineracao.

Responsabilidades:

- pegar eventos da mempool
- montar bloco candidato
- testar `nonce`
- devolver bloco valido

### `Blockchain`

Representa a cadeia local.

Responsabilidades:

- criar genesis
- manter cadeia ativa
- validar bloco
- validar cadeia
- adicionar bloco valido
- detectar fork
- trocar para cadeia melhor

### `Validator`

Pode existir separado ou embutido em `Blockchain`.

Responsabilidades:

- validar evento
- validar bloco
- validar cadeia

### `Consensus`

Pode ficar separado ou dentro de `Blockchain`.

Responsabilidades:

- comparar cadeias
- aplicar a regra da V1
- deixar caminho aberto para calculo real de trabalho acumulado no futuro

---

## 6. Contrato minimo de dados

### Evento

Campos minimos esperados:

- `event_id`
- `event_type`
- `product_id`
- `product_name`
- `actor_id`
- `actor_role`
- `timestamp`
- `input_ids`
- `metadata`

Validacao minima:

- `event_id` presente
- `event_type` presente
- `timestamp` presente
- `input_ids` em formato de lista
- estrutura serializavel em JSON

### Bloco

Campos minimos esperados:

- `index`
- `timestamp`
- `previous_hash`
- `difficulty`
- `nonce`
- `event_count`
- `data_hash`
- `events`
- `block_hash`
- `miner_id` opcional

Validacao minima:

- `event_count == len(events)`
- `data_hash` recalculado bate
- `block_hash` recalculado bate
- `previous_hash` bate com o esperado
- `block_hash` respeita a dificuldade

---

## 7. Interface esperada do core

Nao precisa ser exatamente esta assinatura em toda linguagem, mas conceitualmente o core precisa expor algo nessa linha.

### Eventos

- `create_event(data) -> SupplyChainEvent`
- `validate_event(event) -> bool`
- `event_to_dict(event) -> dict`
- `event_from_dict(data) -> SupplyChainEvent | None`
- `event_to_json(event) -> str`
- `event_from_json(payload) -> SupplyChainEvent | None`

### Mempool

- `add_event(event) -> bool`
- `get_pending_events(limit) -> list[SupplyChainEvent]`
- `remove_events(event_ids) -> None`

### Mineracao

- `create_candidate_block(blockchain, events) -> Block | None`
- `mine_block(block) -> Block | None`
- `mine_from_mempool(blockchain, mempool) -> Block | None`

### Blockchain

- `create_genesis_block() -> Block`
- `get_last_block() -> Block`
- `add_block(block) -> bool`
- `is_valid_block(block, previous_block) -> bool`
- `is_valid_chain(chain) -> bool`
- `replace_chain(candidate_chain) -> bool`
- `handle_incoming_block(block_dict) -> str`

### Serializacao

- `block_to_dict(block) -> dict`
- `block_from_dict(data) -> Block | None`
- `block_to_json(block) -> str`
- `block_from_json(payload) -> Block | None`

---

## 8. Estrutura do projeto

Como a ideia do core e ser simples e facil de testar, a estrutura abaixo ja resolve bem:

```text
project-root/
  README.md
  docs/
    core_blockchain_spec.md
    core_blockchain_execution_plan.md
    integration_contract.md
  src/
    core/
      __init__.py
      config.py
      models/
        __init__.py
        event.py
        block.py
      services/
        __init__.py
        hasher.py
        validator.py
        mempool.py
        miner.py
        blockchain.py
        consensus.py
      serialization/
        __init__.py
        json_codec.py
      demo/
        __init__.py
        local_node.py
        simulate_fork.py
  tests/
    unit/
      test_event.py
      test_block.py
      test_hasher.py
      test_mempool.py
      test_miner.py
      test_blockchain.py
      test_consensus.py
    integration/
      test_mining_flow.py
      test_incoming_block_flow.py
      test_fork_resolution.py
```

### Por que essa estrutura funciona bem

- `models/` concentra as entidades principais
- `services/` concentra a logica do core
- `serialization/` isola o contrato de integracao
- `demo/` ajuda na apresentacao (vai evoluir ainda)
- `tests/` deixa claro o que e unitario e o que e integracao

---

## 9. Ordem de implementacao

Vale mais a pena construir o core em camadas, sem pular etapa.  
Nao faz sentido tentar resolver fork antes de bloco, hash e validacao estarem estaveis.

### Etapa 1. Fundacao

Foco:

- `SupplyChainEvent`
- `Block`
- serializacao deterministica
- funcoes de hash

Quando essa etapa pode ser considerada pronta:

- um evento pode ser criado, validado e serializado
- um bloco gera sempre o mesmo `data_hash` e o mesmo `block_hash` para o mesmo conteudo

### Etapa 2. Cadeia minima

Foco:

- `Blockchain`
- genesis deterministico
- `add_block`
- validacao basica de bloco e cadeia

Quando essa etapa pode ser considerada pronta:

- a cadeia nasce com genesis
- um bloco valido pode ser anexado localmente
- uma cadeia adulterada e rejeitada

### Etapa 3. Proof of Work

Foco:

- `Miner`
- mineracao por `nonce`
- validacao de dificuldade

Quando essa etapa pode ser considerada pronta:

- um bloco pode ser minerado com dificuldade baixa
- um bloco com hash invalido e rejeitado

### Etapa 4. Mempool

Foco:

- adicionar evento
- evitar duplicata
- selecionar lote FIFO
- remover confirmados

Quando essa etapa pode ser considerada pronta:

- eventos entram na mempool
- o minerador monta bloco a partir dela
- eventos confirmados saem da mempool

### Etapa 5. Fork e consenso

Foco:

- detectar bloco que nao encaixa na ponta atual
- guardar cadeia candidata
- comparar cadeias
- trocar para cadeia melhor

Quando essa etapa pode ser considerada pronta:

- o sistema reconhece fork
- a cadeia vencedora pode substituir a ativa

### Etapa 6. Integracao

Foco:

- `to_dict`, `from_dict`, `to_json`, `from_json`
- `handle_incoming_block`
- contrato curto para os colegas

Quando essa etapa pode ser considerada pronta:

- um bloco recebido em JSON pode ser reconstruido e validado
- a frente de comunicacao consegue usar o core sem acessar detalhe interno

### Etapa 7. Demonstracao

Foco:

- script local com dois ou mais nos
- simulacao de fork
- simulacao do conflito adaptado ao supply chain

Quando essa etapa pode ser considerada pronta:

- a apresentacao consegue mostrar mineracao, conflito e escolha de cadeia

---

## 10. Quando considerar essa frente pronta

Esta parte pode ser considerada fechada quando os pontos abaixo estiverem funcionando:

1. existe genesis deterministico
2. existe bloco com hash calculado de forma deterministica
3. existe mineracao com `Proof of Work`
4. existe validacao de bloco
5. existe validacao de cadeia
6. existe mempool funcional
7. existe suporte a fork simples
8. existe regra de escolha da melhor cadeia
9. existe serializacao JSON de evento e bloco
10. existe funcao para processar bloco externo
11. existem testes minimos do core
12. existe uma demo local executavel

---

## 11. Testes minimos da V1

Os testes que realmente precisam existir sao:

1. criar evento valido
2. rejeitar evento mal formado
3. calcular `data_hash` de forma estavel
4. calcular `block_hash` de forma estavel
5. criar genesis
6. minerar bloco com dificuldade baixa
7. validar bloco valido
8. rejeitar bloco com `previous_hash` incorreto
9. rejeitar bloco com `block_hash` adulterado
10. rejeitar cadeia adulterada
11. remover eventos confirmados da mempool
12. desserializar bloco recebido em JSON
13. detectar fork
14. adotar cadeia melhor

---

## 12. O que nao vale puxar agora

Algumas ideias fazem sentido, mas so atrapalham se entrarem cedo demais:

- Merkle tree real
- SPV completo
- assinatura digital em tudo
- persistencia completa em banco
- validacao semantica completa do supply chain
- consenso com dificuldade variavel antes da V1

Se algum desses pontos aparecer no meio do caminho, a regra e simples:

> se nao bloqueia o core funcional, fica para depois

---