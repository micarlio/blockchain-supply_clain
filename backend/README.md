# Blockchain Distribuída para Supply Chain

Projeto acadêmico de blockchain distribuída com `Proof of Work`, voltado para rastrear a criação e a composição de itens em uma cadeia de suprimentos.

O repositório reúne:

- core local da blockchain
- comunicação entre nós com Kafka
- API HTTP por nó
- scripts de demonstração

## Estrutura

- `src/core/`: núcleo da blockchain, validação, mineração, mempool, consenso e serialização
- `src/rede/`: integração com Kafka e monitor local de rede
- `src/api_http/`: camada HTTP de cada nó
- `scripts/`: inicialização dos nós, geração de eventos e simulação de gasto duplo
- `../infra/`: infraestrutura compartilhada do projeto
- `../docs/`: documentação geral da entrega
- `docs/`: documentação técnica específica do backend

## Como rodar o backend

Use os comandos Python desta página a partir da pasta `backend/`.

Instalação:

```bash
pip install -e .
```

Subir o Kafka:

```bash
cd ..
docker compose up -d kafka init-kafka
cd backend
```

Subir os três nós:

```bash
python -m scripts.iniciar_no_kafka node-alpha --porta-api 8001
python -m scripts.iniciar_no_kafka node-beta --porta-api 8002
python -m scripts.iniciar_no_kafka node-gamma --observador --porta-api 8003
```

Verificação rápida:

```bash
curl http://127.0.0.1:8001/estado
curl http://127.0.0.1:8002/estado
curl http://127.0.0.1:8003/estado
```

## Como subir tudo de uma vez com Docker Compose

Se a ideia for subir o backend completo com um comando so, use o compose na raiz do projeto:

```bash
cd ..
docker compose up --build -d
```

Isso sobe:

- Kafka
- criacao automatica dos topicos
- `node-alpha` como minerador automatico
- `node-beta` como no de controle manual
- `node-gamma`
- `node-evil` como minerador malicioso com hash power simulado maior

Para acompanhar o estado:

```bash
cd ..
docker compose ps
docker compose logs -f node-alpha
docker compose logs -f node-beta
docker compose logs -f node-gamma
```

Para derrubar tudo:

```bash
cd ..
docker compose down -v
```

Gerar eventos com seed:

```bash
python -m scripts.gerar_eventos --url-api http://localhost:8001 --seed 42 --quantidade 20 --intervalo 0.5
```

Simular o cenário de gasto duplo:

```bash
python -m scripts.simular_ataque_gasto_duplo --alpha http://localhost:8001 --beta http://localhost:8002 --gamma http://localhost:8003
```

Simular o fluxo ponta a ponta da banca:

```bash
python -u -m scripts.simular_fluxo_completo
```

## Como rodar o frontend

Volte para a raiz do repositório e entre na pasta `frontend/`:

```bash
cd ../frontend
npm install
npm run dev
```

O painel abre normalmente em `http://localhost:5173` e consulta, por padrão:

- `http://127.0.0.1:8001`
- `http://127.0.0.1:8002`
- `http://127.0.0.1:8003`
- `http://127.0.0.1:8004`

## PoW global e capacidade por no

- a dificuldade do `Proof of Work` continua global para toda a rede
- todos os nos mineram e validam com a mesma dificuldade
- a diferenca do `node-evil` fica apenas na capacidade de mineracao simulada por ciclo, para representar maior hash power sem mudar a validade do bloco

Se quiser trocar os endereços, use:

- `VITE_NODE_ALPHA_URL`
- `VITE_NODE_BETA_URL`
- `VITE_NODE_GAMMA_URL`

## Ordem recomendada para demonstracao

1. Subir o backend completo com `docker compose up --build -d`.
2. Conferir `docker compose ps`.
3. Abrir o frontend.
4. Cadastrar matéria-prima.
5. Minerar um bloco.
6. Fabricar produto simples e depois produto composto.
7. Consultar a rastreabilidade do item final.
8. Rodar os cenários de teste de rejeição.

## Endpoints principais

- `POST /eventos`
- `GET /estado`
- `GET /cadeia`
- `GET /mempool`
- `GET /rastreabilidade/{identificador}`
- `GET /rede`
- `GET /demonstracao`
- `POST /demonstracao/minerar`

## Documentação

- [../docs/guia_de_execucao.md](../docs/guia_de_execucao.md)
- [../docs/roteiro_apresentacao.md](../docs/roteiro_apresentacao.md)
- [../docs/modelagem_de_dados.md](../docs/modelagem_de_dados.md)
- [docs/analise_ataque_gasto_duplo.md](docs/analise_ataque_gasto_duplo.md)
- [docs/simulacao_ponta_a_ponta.md](docs/simulacao_ponta_a_ponta.md)
- [docs/core_blockchain_execution_plan.md](docs/core_blockchain_execution_plan.md)
- [../frontend/README.md](../frontend/README.md)
