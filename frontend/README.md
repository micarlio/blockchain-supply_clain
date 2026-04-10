# Frontend Supply Chain

Painel web do projeto de blockchain distribuída para supply chain.

O frontend foi feito com:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query

## Objetivo

O painel serve para operar e demonstrar o sistema real:

- cadastrar eventos do domínio
- acompanhar a mempool
- disparar mineração manual
- visualizar a cadeia local
- comparar nós
- consultar rastreabilidade recursiva
- validar cenários de rejeição do backend

## Dependências

O frontend não sobe Kafka nem os nós automaticamente.

Antes de abrir o painel, o ideal é ter estes serviços em execução:

1. Kafka
2. `node-alpha` em `http://127.0.0.1:8001`
3. `node-beta` em `http://127.0.0.1:8002`
4. `node-gamma` em `http://127.0.0.1:8003`
5. `node-evil` em `http://127.0.0.1:8004`

O jeito mais simples de garantir isso hoje é:

```bash
cd ..
docker compose up --build -d
```

## Como rodar

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
```

Verificação estática:

```bash
npm run lint
```

## Variáveis de ambiente

Se quiser apontar para outras URLs, crie um `.env` local com:

```bash
VITE_NODE_ALPHA_URL=http://127.0.0.1:8001
VITE_NODE_BETA_URL=http://127.0.0.1:8002
VITE_NODE_GAMMA_URL=http://127.0.0.1:8003
VITE_NODE_EVIL_URL=http://127.0.0.1:8004
```

## Fluxo recomendado de uso

1. Abrir o dashboard e conferir se os três nós estão online.
2. Ir para `Eventos` e cadastrar uma matéria-prima.
3. Ir para `Mempool` ou `Mineração` e minerar um bloco.
4. Criar um produto simples usando um `input_id` válido.
5. Criar um produto composto usando o produto simples e outros insumos permitidos.
6. Ir para `Blockchain` para inspecionar os blocos.
7. Ir para `Rastreabilidade` para consultar a árvore de origem.
8. Ir para `Testes` para validar rejeições de consumo indevido e payload inválido.

## Observações

- O frontend usa as APIs reais do projeto; ele não depende de mocks para o fluxo principal.
- A lista de itens exibida no painel é derivada da cadeia, da mempool e das atividades observadas nos nós.
- A UI agora tambem reconhece o `node-evil`, exibindo o papel do no, a dificuldade global compartilhada e a capacidade de mineracao simulada por no.
