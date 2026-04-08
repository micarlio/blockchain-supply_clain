## Contrato atual de integracao

Este documento descreve o contrato que o backend realmente expoe hoje entre:

- o core da blockchain (`src/core/`)
- a camada de aplicacao (`src/api_http/no_aplicacao.py`)
- os adaptadores Kafka (`src/rede/no_kafka.py`)
- a API HTTP consumida pelo frontend

O objetivo aqui nao e propor uma interface futura. E registrar a interface que ja esta em uso no projeto.

---

## 1. Limites entre as camadas

### Core puro

O core recebe e devolve objetos Python e `dict`s simples.

Ele e responsavel por:

- representar `SupplyChainEvent` e `Block`
- serializar e desserializar evento e bloco
- validar evento, bloco e cadeia
- minerar blocos
- manter cadeia ativa, forks candidatos e mempool
- processar bloco externo ja desserializado

### Camada de aplicacao

`NoAplicacaoBlockchain` junta:

- `Blockchain`
- `Mempool`
- `NoProdutor`
- `NoConsumidor`
- `MonitorRede`

Ela converte payloads de API e de Kafka em chamadas ao core e monta as respostas usadas pelos endpoints.

### Camada de rede

`NoProdutor` e `NoConsumidor` cuidam de:

- publicar eventos no topico `cadeia-suprimentos-eventos`
- publicar blocos no topico `cadeia-suprimentos-blocos`
- ler o cabecalho Kafka `origem_no`
- descartar mensagem propria antes de repassar ao fluxo local, quando possivel

### Camada HTTP

A API FastAPI so expoe o estado e os comandos do `NoAplicacaoBlockchain`.

---

## 2. Payloads compartilhados

### Evento JSON

O payload esperado para evento e:

```json
{
  "event_id": "EVT-100",
  "event_type": "CADASTRAR_MATERIA_PRIMA",
  "product_id": "ACO-LOTE-100",
  "product_name": "Chapa de Aco",
  "entity_kind": "raw_material",
  "actor_id": "SIDERURGICA-CNPJ",
  "actor_role": "FORNECEDOR",
  "timestamp": "2026-04-07T10:00:00Z",
  "input_ids": [],
  "metadata": {
    "lot_id": "ACO-LOTE-100"
  }
}
```

Contrato atual:

- `event_type` aceito: `CADASTRAR_MATERIA_PRIMA`, `FABRICAR_PRODUTO_SIMPLES`, `FABRICAR_PRODUTO_COMPOSTO`
- `entity_kind` aceito: `raw_material`, `simple_product`, `composite_product`
- `actor_role` aceito: `FORNECEDOR`, `FABRICANTE`, `MONTADORA`
- `metadata` precisa ser serializavel em JSON

### Bloco JSON

O payload serializado de bloco usa:

```json
{
  "index": 1,
  "timestamp": "2026-04-07T10:05:00Z",
  "previous_hash": "...",
  "difficulty": 4,
  "nonce": 12345,
  "event_count": 1,
  "data_hash": "...",
  "events": [
    {
      "event_id": "EVT-100",
      "event_type": "CADASTRAR_MATERIA_PRIMA",
      "product_id": "ACO-LOTE-100",
      "product_name": "Chapa de Aco",
      "entity_kind": "raw_material",
      "actor_id": "SIDERURGICA-CNPJ",
      "actor_role": "FORNECEDOR",
      "timestamp": "2026-04-07T10:00:00Z",
      "input_ids": [],
      "metadata": {
        "lot_id": "ACO-LOTE-100"
      }
    }
  ],
  "block_hash": "...",
  "miner_id": "node-alpha"
}
```

Observacoes do contrato atual:

- `miner_id` e opcional no payload do bloco
- o genesis nao e trafegado pela rede; ele e recriado localmente em todos os nos
- `miner_id` nao entra no calculo de `block_hash`

---

## 3. Serializacao usada entre camadas

O projeto usa `src/core/serialization/json_codec.py` como ponte oficial para evento e bloco.

Funcoes relevantes:

- `evento_para_dict`, `evento_de_dict`, `evento_para_json`, `evento_de_json`
- `bloco_para_dict`, `bloco_de_dict`, `bloco_para_json`, `bloco_de_json`

Caracteristicas importantes:

- a serializacao usada para hashing e transporte e deterministica
- o JSON e gerado com chaves ordenadas
- quando o payload JSON nao abre, o codec de bloco ou evento levanta erro de parse do `json`
- quando o JSON abre mas nao forma um contrato valido, o codec devolve `None`

---

## 4. Fluxo de blocos entre Kafka e core

### Publicacao

Quando um no minera um bloco:

1. `NoProdutor.minerar_uma_vez()` chama `Miner.minerar_da_mempool()`
2. se o bloco for anexado localmente, o produtor serializa com `bloco_para_json()`
3. o payload vai para o topico `cadeia-suprimentos-blocos`
4. o cabecalho Kafka recebe `origem_no = <node_id>`

### Consumo

Quando um no recebe um bloco do Kafka:

1. `NoConsumidor` faz `json.loads(payload)`
2. tenta identificar o remetente por `origem_no`; se nao existir, cai para `miner_id`
3. se o bloco parecer proprio, o consumidor descarta antes de repassar ao core
4. caso contrario, chama `Blockchain.processar_bloco_recebido(dados)`

### Status devolvidos por `Blockchain.processar_bloco_recebido()`

| Status | Significado |
|---|---|
| `bloco_adicionado_cadeia_ativa` | o bloco encaixou na ponta da cadeia ativa |
| `bloco_registrado_em_fork` | o bloco abriu ou estendeu uma cadeia candidata |
| `cadeia_ativa_reorganizada` | um fork passou a ter mais trabalho acumulado e virou cadeia ativa |
| `bloco_ignorado_proprio_no` | o bloco foi identificado como gerado pelo proprio no |
| `bloco_rejeitado_validacao` | o bloco nao passou nas validacoes estrutural, de contexto ou de encadeamento |
| `payload_invalido` | o payload nao conseguiu ser reconstruido como `Block` |

Efeito colateral importante no consumidor:

- quando o status e `bloco_adicionado_cadeia_ativa` ou `cadeia_ativa_reorganizada`, os `event_id`s confirmados no bloco recebido sao removidos da mempool local

---

## 5. Fluxo de eventos entre API, Kafka e core

Hoje existem dois caminhos de entrada para evento.

### Entrada via HTTP

`POST /eventos` entrega um `dict` para `NoAplicacaoBlockchain.adicionar_evento_por_payload()`.

Fluxo:

1. tenta montar `SupplyChainEvent` com `SupplyChainEvent.de_dict(payload)`
2. se falhar, responde `evento_rejeitado` com motivo `payload_invalido`
3. se montar o evento, valida contra cadeia + mempool atuais
4. se aceito, insere na mempool local
5. se `propagar_rede=true`, publica o evento no Kafka

### Entrada via Kafka

`NoConsumidor` recebe o JSON do topico `cadeia-suprimentos-eventos` e faz:

1. `evento_de_json(payload)`
2. tenta identificar remetente por `origem_no`; se nao existir, cai para `actor_id`
3. se parecer evento proprio, descarta
4. senao chama `NoAplicacaoBlockchain.adicionar_evento_recebido_da_rede(evento)`

### Status e motivos do fluxo de evento

Resposta normal de sucesso:

```json
{
  "status": "evento_adicionado",
  "event_id": "EVT-100",
  "node_id": "node-alpha"
}
```

Resposta de rejeicao pela API:

```json
{
  "status": "evento_rejeitado",
  "motivo": "evento_duplicado"
}
```

Motivos realmente usados hoje:

| Motivo | Quando aparece |
|---|---|
| `payload_invalido` | o `dict` recebido pela API nao forma um `SupplyChainEvent` valido |
| `evento_duplicado` | o `event_id` ja existe na cadeia confirmada ou na mempool atual |
| `evento_invalido_no_contexto_atual` | o evento viola as regras do dominio no contexto corrente |
| `falha_ao_adicionar_na_mempool` | a validacao passou, mas a mempool recusou a insercao |

Motivos internos que podem aparecer em chamadas programaticas de `adicionar_evento()`:

- `estrutura_invalida`
- `contexto_mempool_invalido`

Esses dois nao sao o caminho normal do endpoint HTTP, porque o endpoint ja tenta construir o evento antes.

---

## 6. Contrato HTTP efetivamente consumido pelo frontend

Os endpoints expostos por `criar_aplicacao_http()` sao:

- `GET /`
- `POST /eventos`
- `GET /estado`
- `GET /cadeia`
- `GET /mempool`
- `GET /rastreabilidade/{identificador}`
- `GET /rede`
- `GET /demonstracao`
- `POST /demonstracao/minerar`

### `GET /`

Resumo curto do no:

```json
{
  "status": "online",
  "node_id": "node-alpha",
  "papel_no": "minerador"
}
```

### `POST /eventos`

Query string:

- `propagar_rede=true|false` (default `true`)

Codigos usados hoje:

- `200` para `evento_adicionado`
- `400` para `evento_rejeitado`

### `GET /estado`

Retorna:

- `node_id`
- `papel_no`
- `difficulty`
- `altura_cadeia`
- `hash_ponta`
- `quantidade_mempool`
- `forks_conhecidos`

Observacao: `altura_cadeia` conta o genesis. Um no recem-iniciado com cadeia vazia de negocio responde `1`.

### `GET /cadeia`

Retorna:

- `node_id`
- `cadeia_ativa`
- `cadeias_candidatas`
- `trabalho_acumulado_ativo`

### `GET /mempool`

Retorna:

- `node_id`
- `quantidade`
- `eventos`

### `GET /rastreabilidade/{identificador}`

O backend tenta casar `identificador` com:

- `event_id`
- `product_id`
- `metadata.lot_id`

Ele nao busca por `product_name`. Essa busca por nome, quando existe na UX, e enriquecimento do frontend.

Retorna:

- `node_id`
- `identificador`
- `eventos_confirmados`
- `eventos_pendentes`
- `estado_atual`
- `arvore_origem`

`estado_atual.status` pode ser:

- `nao_encontrado`
- `pendente`
- `confirmado`

`arvore_origem` mistura nos confirmados e pendentes e e montada recursivamente a partir do evento criador encontrado.

### `GET /rede`

Retorna a visao local observada pelo `MonitorRede`:

- `node_id`
- `papel_local`
- `estado_local`
- `nos_conhecidos`
- `atividade_recente`
- `demonstracao`

Importante: isso e telemetria local do no, nao uma visao consensual global da rede.

### `GET /demonstracao`

Retorna:

- `node_id`
- `estado_no`
- `demonstracao`
- `atividades`

Hoje o frontend usa esse endpoint para timeline, resumo de fork e varios sinais auxiliares de interface.

### `POST /demonstracao/minerar`

Respostas possiveis:

| Status | Significado |
|---|---|
| `bloco_minerado` | um bloco foi minerado e anexado localmente |
| `sem_eventos_pendentes` | nao havia lote valido para minerar |
| `mineracao_indisponivel` | o no esta em modo observador |

Codigos HTTP usados hoje:

- `200` para `bloco_minerado`
- `200` para `sem_eventos_pendentes`
- `400` para `mineracao_indisponivel`

---

## 7. Papeis operacionais do no

`NoAplicacaoBlockchain.obter_papel_no()` expoe tres papeis:

- `minerador`
  no normal com loop automatico de mineracao
- `controle`
  no sem loop automatico, mas com mineracao manual liberada
- `observador`
  no sem loop automatico e sem mineracao manual

O frontend e os scripts usam esses valores textuais diretamente.

---

## 8. Observacoes importantes para quem integra

1. o backend publica em Kafka de forma assincrona e so faz `flush` no encerramento do produtor
2. o header Kafka `origem_no` e o primeiro sinal de origem; `actor_id` e `miner_id` entram como fallback
3. o core processa blocos recebidos um a um; nao existe protocolo de sincronizacao completa de cadeia
4. a API de rastreabilidade devolve apenas o que o no local conhece naquele momento
5. o frontend faz enriquecimentos proprios em cima da API, entao nem toda inferencia visual existe como contrato do backend

---

## 9. Resumo do contrato que importa

Se outra camada quiser integrar com o backend atual, precisa assumir isto:

- eventos entram como JSON seguindo o contrato de `SupplyChainEvent`
- blocos trafegam como JSON seguindo o contrato de `Block`
- a decisao final sobre bloco externo vem por status textual de `processar_bloco_recebido()`
- a decisao final sobre evento HTTP vem por `status` e `motivo`
- a API publica o estado local do no, nao uma verdade global sincronizada

Esse e o contrato real em producao no repositorio hoje.
