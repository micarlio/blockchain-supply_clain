# Blockchain Distribuida para Supply Chain

Projeto academico de blockchain distribuida com `Proof of Work`, voltado para rastrear a criacao, a composicao e a confirmacao de itens em uma cadeia de suprimentos.

O sistema combina:

- core local da blockchain em Python
- propagacao de eventos e blocos via Kafka
- API HTTP por no com FastAPI
- painel web em React para operacao e demonstracao
- scripts para gerar eventos, simular fluxo completo e demonstrar fork com reorganizacao

## O que o projeto demonstra

O repositorio foi estruturado para mostrar, de ponta a ponta:

- criacao de materias-primas e produtos rastreaveis
- mempool local por no
- mineracao de blocos com `Proof of Work`
- propagacao de eventos e blocos entre nos
- deteccao de fork e reorganizacao da cadeia ativa
- rastreabilidade recursiva por composicao de insumos
- rejeicao de conflito de consumo, equivalente ao gasto duplo adaptado ao dominio

## Visao da arquitetura

Topologia padrao do projeto:

- `node-alpha`
  minerador automatico, API em `http://127.0.0.1:8001`
- `node-beta`
  no de controle manual, API em `http://127.0.0.1:8002`
- `node-gamma`
  no observador, API em `http://127.0.0.1:8003`
- `node-evil`
  no malicioso de mineracao automatica acelerada, API em `http://127.0.0.1:8004`
- `kafka`
  broker usado para propagar eventos e blocos entre os nos

Cada no mantem:

- uma cadeia ativa local
- forks candidatos conhecidos
- uma mempool propria
- uma visao local da rede para fins de monitoramento e demonstracao

## Estrutura do repositorio

- `backend/`
  blockchain, validacao de dominio, mineracao, Kafka, API HTTP, scripts, testes e docs tecnicas
- `frontend/`
  painel React que consome as APIs reais dos quatro nos
- `docs/`
  documentacao geral da entrega
- `infra/`
  infraestrutura compartilhada usada pelos scripts e pelo ambiente Kafka
- `docker-compose.yml`
  sobe o backend completo da demonstracao na raiz do projeto

## Como rodar

### 1. Subir o backend completo

Na raiz do repositorio:

```bash
docker compose up --build -d
```

Isso sobe:

- Kafka
- criacao automatica dos topicos
- `node-alpha`
- `node-beta`
- `node-gamma`
- `node-evil`

Para conferir o estado:

```bash
docker compose ps
curl http://127.0.0.1:8001/estado
curl http://127.0.0.1:8002/estado
curl http://127.0.0.1:8003/estado
curl http://127.0.0.1:8004/estado
```

### 2. Rodar o frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O painel abre em `http://localhost:5173` e, por padrao, consulta:

- `http://localhost:8001`
- `http://localhost:8002`
- `http://localhost:8003`
- `http://localhost:8004`

## Dificuldade global e hash power simulado

- a dificuldade do `Proof of Work` continua global e igual para toda a rede
- todos os nos validam blocos com a mesma regra de PoW
- o `node-evil` nao muda a validade do bloco; ele apenas recebe uma capacidade de mineracao simulada maior


## Componentes principais

### Backend

O backend fica em `backend/` e contem:

- `src/core/`
  modelos, hashing, validacao, mempool, mineracao, consenso e cadeia local
- `src/rede/`
  integracao Kafka e monitor local da rede
- `src/api_http/`
  camada HTTP de cada no
- `scripts/`
  inicializacao dos nos, gerador de eventos e scripts de simulacao
- `tests/`
  testes unitarios e de integracao

### Frontend

O frontend fica em `frontend/` e oferece paginas para:

- dashboard do cluster
- cadastro de eventos
- mempool
- mineracao manual
- visualizacao da cadeia
- rastreabilidade
- testes de comportamento
- comparacao entre nos

## Endpoints principais

Cada no expoe:

- `GET /`
- `POST /eventos`
- `GET /estado`
- `GET /cadeia`
- `GET /mempool`
- `GET /rastreabilidade/{identificador}`
- `GET /rede`
- `GET /demonstracao`
- `POST /demonstracao/minerar`

## Scripts uteis

A partir de `backend/`:

Gerar eventos validos e reproduziveis:

```bash
python -m scripts.gerar_eventos --url-api http://localhost:8001 --seed 42 --quantidade 20 --intervalo 0.5
```

Simular fluxo ponta a ponta:

```bash
python -u -m scripts.simular_fluxo_completo
```

Simular gasto duplo adaptado ao dominio:

```bash
python -m scripts.simular_ataque_gasto_duplo --alpha http://localhost:8001 --beta http://localhost:8002 --gamma http://localhost:8003
```

## Documentacao principal

- [docs/guia_de_execucao.md](docs/guia_de_execucao.md)
- [docs/modelagem_de_dados.md](docs/modelagem_de_dados.md)
- [backend/README.md](backend/README.md)
- [backend/docs/core_blockchain_execution_plan.md](backend/docs/core_blockchain_execution_plan.md)
- [backend/docs/integration_contract.md](backend/docs/integration_contract.md)
- [frontend/README.md](frontend/README.md)
- [docs/Avaliacao Unidade 1.pdf](docs/Avalia%C3%A7%C3%A3o%20Unidade%201.pdf)

## Encerramento

Para derrubar o ambiente do backend na raiz:

```bash
docker compose down -v
```
