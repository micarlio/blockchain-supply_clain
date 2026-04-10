# Blockchain Distribuída para Supply Chain

Projeto acadêmico de blockchain distribuída com `Proof of Work` (PoW), voltado para rastrear a criação, a composição e a confirmação de itens em uma cadeia de suprimentos real-time.

O sistema combina:

- **Core**: Blockchain local em Python (PoW, validação de domínio e consenso).
- **Rede**: Propagação de eventos e blocos via Apache Kafka.
- **Interface**: API HTTP (FastAPI) em cada nó e painel Web (React/Vite).
- **Simulação**: Scripts para geração de carga, simulação de fluxos e ataques de bifurcação (*forks*).

## Tecnologias Principais

- **Backend**: Python 3.12+, FastAPI, Kafka-Python, Pydantic.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, TanStack Query.
- **Infra**: Docker & Docker Compose.

## O que o projeto demonstra

O repositório foi estruturado para mostrar, de ponta a ponta:

- **Ciclo de Vida**: Criação de matérias-primas e produtos rastreáveis.
- **Mempool**: Gestão local de transações pendentes por nó.
- **Consenso**: Mineração de blocos baseada em dificuldade variável.
- **P2P Simulada**: Propagação robusta de dados via Kafka.
- **Conflitos**: Detecção de *forks* e reorganização automática da cadeia ativa.
- **Rastreabilidade**: Navegação recursiva pela árvore de composição de insumos.
- **Integridade**: Rejeição de eventos inválidos ou conflitos de consumo (gasto duplo).

## Visão da Arquitetura

O projeto sobe um cluster local com a seguinte topologia:

- `node-alpha`
  minerador automático, API em `http://127.0.0.1:8001`
- `node-beta`
  nó de controle manual, API em `http://127.0.0.1:8002`
- `node-gamma`
  nó observador, API em `http://127.0.0.1:8003`
- `node-evil`
  nó malicioso de mineração automática acelerada, API em `http://127.0.0.1:8004`
- `kafka`
  broker usado para propagar eventos e blocos entre os nós

Cada nó mantém:

- uma cadeia ativa local
- forks candidatos conhecidos
- uma mempool própria
- uma visão local da rede para fins de monitoramento e demonstração

## Estrutura do Repositório

- `backend/`
  core da blockchain, validação de domínio, mineração, Kafka, API HTTP e scripts.
- `frontend/`
  painel React/UI que consome as APIs reais dos terminais.
- `docs/`
  documentação geral da entrega.
- `infra/`
  infraestrutura compartilhada usada pelos scripts e pelo ambiente Kafka.
- `docker-compose.yml`
  sobe o backend completo da demonstração na raiz do projeto.

## Como Rodar

### 1. Subir o backend completo

Na raiz do repositório:

```bash
docker compose up --build -d
```

Isso inicializa:

- Kafka
- criação automática dos tópicos
- `node-alpha`, `node-beta`, `node-gamma` e `node-evil`

Para conferir o estado:

```bash
docker compose ps
curl http://127.0.0.1:8001/estado
```

### 2. Rodar o frontend

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

O painel abre em `http://localhost:5173` e consulta as APIs locais dos nós.

## Dificuldade Global e Hash Power

- a dificuldade do `Proof of Work` continua global e igual para toda a rede.
- todos os nós validam blocos com a mesma regra rigorosa de PoW.
- o `node-evil` não muda a validade do bloco; ele apenas possui uma capacidade de mineração simulada maior para induzir reorganizações.

## Componentes principais

### Backend

O backend fica em `backend/` e contém:

- `src/core/`: modelos, hashing, validação, mempool, mineração e consenso.
- `src/rede/`: integração Kafka e monitor local da rede.
- `src/api_http/`: camada HTTP de cada nó.
- `scripts/`: inicialização, geradores e simuladores.

### Frontend

O frontend fica em `frontend/` e oferece páginas para:

- **Dashboard**: Visão geral do cluster e saúde dos nós.
- **Eventos**: Cadastro de novas transações de supply chain.
- **Mempool**: Inspeção de eventos aguardando mineração.
- **Mineração**: Controle manual ou automático do PoW.
- **Blockchain**: Visualização interativa da cadeia e blocos.
- **Rastreabilidade**: Gráfico de proveniência de produtos.
- **Logs & Depuração**: Observabilidade estruturada dos eventos internos.
- **Testes**: Execução de cenários de estresse e bifurcação.

## Endpoints Principais

Cada nó expõe:

- `GET /`: Status base.
- `POST /eventos`: Envio de transações.
- `GET /estado`: Resumo do nó.
- `GET /cadeia`: Download da blockchain.
- `GET /mempool`: Lista pendências.
- `GET /rastreabilidade/{id}`: Histórico do item.
- `GET /logs`: Logs estruturados.
- `GET /testes/cenarios`: Lista cenários.
- `POST /testes/executar/{id}`: Dispara simulação.

## Scripts úteis

Simular fluxo ponta a ponta:

```bash
python -u -m scripts.simular_fluxo_completo
```

Simular gasto duplo adaptado ao domínio:

```bash
python -m scripts.simular_ataque_gasto_duplo --alpha http://localhost:8001 --beta http://localhost:8002 --gamma http://localhost:8003
```

## Documentação principal

Consulte a pasta `docs/` e `backend/docs/` para detalhes sobre a modelagem de dados, algoritmos de consenso e contratos de integração.

## Encerramento

Para derrubar o ambiente:

```bash
docker compose down -v
```
