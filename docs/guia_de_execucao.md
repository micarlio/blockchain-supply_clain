# Guia de Execução: Rede Blockchain Local com Kafka

Este documento detalha os passos necessários para configurar o ambiente e executar a simulação da rede blockchain distribuída, utilizando Apache Kafka para comunicação entre os nós e Python para o Core da aplicação.

## 1. Pré-requisitos

- Docker e Docker Compose instalados (com WSL 2 ativado no Windows).

- Python 3.8+ instalado.

- Acesso ao terminal (PowerShell, CMD ou Bash).

## 2. Passo 1: Subir a Infraestrutura (Kafka via Docker)

O Kafka gerencia a mensageria da rede. O ficheiro `docker-compose.yml` deve estar na raiz do projeto para criar os tópicos `supply-chain-blocks` e `supply-chain-events`.

1. Abra o terminal na raiz do projeto.

2. Execute o comando:

```
docker compose up -d
```

3. Aguarde cerca de 20 segundos para a inicialização completa dos tópicos. Pode verificar se os tópicos foram criados com:

```
docker exec -it blockchain-kafka kafka-topics --list --bootstrap-server localhost:9092
```

## 3. Passo 2: Configurar o Ambiente Virtual Python

Utilizar um ambiente virtual isola as bibliotecas do projeto da sua instalação global do sistema, evitando conflitos de versões.

1. Na raiz do projeto, crie o ambiente virtual:

```
python -m venv venv
```

2. Ative o ambiente:

- Windows (PowerShell): `.\venv\Scripts\Activate.ps1`

- Windows (CMD): `.\venv\Scripts\activate.bat`

- Linux/macOS: `source venv/bin/activate`

3. Instale as dependências:
Certifique-se de que o ficheiro `requirements.txt` existe e contém as bibliotecas necessárias (ex: `confluent-kafka`).

```
pip install -r requirements.txt
```

## 4. Passo 3: Executando a Simulação

Deverá abrir 3 terminais separados. Ative o ambiente virtual em todos eles antes de prosseguir com os comandos abaixo.

### Terminal 1: Nó Minerador (Alpha)

Este nó é responsável por validar eventos, minerar blocos (Proof of Work) e publicar o resultado na rede.

```
python local_node.py node-alpha
```

### Terminal 2: Nó Observador (Beta)

Este nó recebe blocos da rede e sincroniza a sua cadeia local sem realizar mineração ativa, validando o trabalho do Alpha.

```
python local_node.py node-beta --observer
```

### Terminal 3: Gerador de Eventos

Este script simula a entrada de dados reais (Supply Chain) na rede para que os mineradores tenham transações para processar.

```
python event_generator.py
```

## 5. O que observar nos Logs

**Terminal Alpha**: Exibirá mensagens de `[Miner] Sucesso! Publicando bloco...` e confirmações de entrega do Kafka.

**Terminal Beta**: Exibirá mensagens de `[Rede] Recebido bloco de 'node-alpha'` e `[Core] Bloco integrado com sucesso!`.

**Sincronização**: Verá que assim que o Alpha minera, o Beta atualiza a sua cadeia local quase instantaneamente.

## 6. Encerrando o Teste

1. Utilize `Ctrl + C` em cada um dos terminais Python para interromper os scripts.

2. Para desligar e remover os contêineres do Kafka, execute no terminal:

```
docker compose down
```