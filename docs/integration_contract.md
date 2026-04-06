## Contrato Inicial de Integracao

Este documento descreve a interface minima entre o **core da blockchain** e a camada de comunicacao.

## 1. O que o core entrega

O core deve disponibilizar:

- serializacao de evento para `dict` e JSON
- desserializacao de evento a partir de `dict` e JSON
- serializacao de bloco para `dict` e JSON
- desserializacao de bloco a partir de `dict` e JSON
- validacao de bloco recebido externamente
- tentativa de anexar bloco valido na cadeia local

## 2. Entrada esperada da comunicacao

A camada de comunicacao deve entregar ao core:

- o payload JSON recebido
- o identificador do emissor, quando existir

## 3. Saida esperada do core

O core deve conseguir informar, no minimo:

- bloco anexado na cadeia principal
- bloco guardado como candidato de fork
- reorganizacao da cadeia ativa
- bloco ignorado por ter sido gerado pelo proprio no
- payload invalido ou bloco rejeitado na validacao

## 4. Observacoes

- a regra de ignorar mensagem enviada pelo proprio no pode ficar na camada de comunicacao
- o formato final do payload deve ser alinhado com a frente de Kafka
- hoje o core ja trabalha com retornos por status, o que ajuda a frente de comunicacao a decidir o que fazer em cada caso
