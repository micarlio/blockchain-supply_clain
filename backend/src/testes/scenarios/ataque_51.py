"""Cenario de ataque de 51% simulado.

Nesta simulacao a dificuldade do PoW continua global e igual para toda a rede.
O que muda e apenas a capacidade de mineracao configurada para o no atacante.

Para manter a demonstracao reproduzivel, o cenario usa uma construcao controlada
da cadeia alternativa no no alvo, em vez de depender de uma corrida aleatoria em
tempo real. Os blocos criados continuam validos para toda a rede.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from math import ceil
from uuid import uuid4

from src.core.models.block import Block
from src.core.models.event import SupplyChainEvent
from src.core.services.miner import Miner
from src.testes.models import (
    ScenarioDefinition,
    TestExecutionOutcome,
)
from src.testes.utils.blockchain_snapshot import (
    capturar_snapshot_cluster,
    localizar_evento_confirmado,
    obter_entrada,
    resumir_impacto_blockchain,
)
from src.testes.utils.context_builder import ScenarioRuntime

MAX_DIFICULDADE_DEMONSTRACAO_51 = 5


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _gerar_identificador(prefixo: str, seed: str, sufixo: str) -> str:
    """Monta ids estaveis e legiveis para os artefatos do cenario."""

    return f"{prefixo}-{seed}-{sufixo}"


def _evento_materia_prima(seed: str) -> dict[str, object]:
    """Cria a materia-prima inicial do cenario."""

    event_id = _gerar_identificador("EVT-TESTE-51", seed, "RAW")
    product_id = _gerar_identificador("RAW", seed, "BLOCO")
    return {
        "event_id": event_id,
        "event_type": "CADASTRAR_MATERIA_PRIMA",
        "entity_kind": "raw_material",
        "product_id": product_id,
        "product_name": "Matéria-prima do ataque simulado",
        "actor_id": "FORNECEDOR-TESTE-CNPJ",
        "actor_role": "FORNECEDOR",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "RAW"),
            "scenario": "attack-51-simulado",
        },
    }


def _evento_produto_honesto(raw_event_id: str, seed: str) -> dict[str, object]:
    """Cria o produto legitimo que consome o insumo raiz."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-51", seed, "HONESTO"),
        "event_type": "FABRICAR_PRODUTO_SIMPLES",
        "entity_kind": "simple_product",
        "product_id": _gerar_identificador("PROD", seed, "HONESTO"),
        "product_name": "Produto honesto confirmado",
        "actor_id": "FABRICANTE-HONESTO-CNPJ",
        "actor_role": "FABRICANTE",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [raw_event_id],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "HONESTO"),
            "scenario": "attack-51-simulado",
        },
    }


def _evento_produto_malicioso(raw_event_id: str, seed: str) -> dict[str, object]:
    """Cria o produto alternativo usando o mesmo insumo do ramo honesto."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-51", seed, "MALICIOSO"),
        "event_type": "FABRICAR_PRODUTO_SIMPLES",
        "entity_kind": "simple_product",
        "product_id": _gerar_identificador("PROD", seed, "MALICIOSO"),
        "product_name": "Produto malicioso concorrente",
        "actor_id": "FABRICANTE-MALICIOSO-CNPJ",
        "actor_role": "FABRICANTE",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [raw_event_id],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "MALICIOSO"),
            "scenario": "attack-51-simulado",
        },
    }


def _evento_extensao_maliciosa(
    produto_malicioso_event_id: str, seed: str
) -> dict[str, object]:
    """Cria a extensao que aumenta o trabalho acumulado da cadeia maliciosa."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-51", seed, "EXTENSAO"),
        "event_type": "FABRICAR_PRODUTO_COMPOSTO",
        "entity_kind": "composite_product",
        "product_id": _gerar_identificador("COMP", seed, "MALICIOSO"),
        "product_name": "Produto composto da cadeia maliciosa",
        "actor_id": "MONTADORA-MALICIOSA-CNPJ",
        "actor_role": "MONTADORA",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [produto_malicioso_event_id],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "EXTENSAO"),
            "scenario": "attack-51-simulado",
        },
    }


def _criar_bloco_fork(
    parent: Block,
    difficulty: int,
    events: list[SupplyChainEvent],
    miner_id: str,
) -> Block:
    """Monta um bloco apontando para um pai arbitrario do ramo alternativo."""

    return Block(
        index=parent.index + 1,
        timestamp=_timestamp_utc_atual(),
        previous_hash=parent.block_hash,
        difficulty=difficulty,
        nonce=0,
        event_count=0,
        data_hash="",
        events=events,
        block_hash="",
        miner_id=miner_id,
    )


def _minerar_bloco_controlado(
    minerador: Miner,
    bloco: Block,
) -> tuple[Block, dict[str, int]]:
    """Minera um bloco completo para os passos controlados do cenário."""

    bloco_minerado = minerador.minerar_bloco(bloco)
    if bloco_minerado is None:
        raise RuntimeError(
            f"falha_ao_minerar_bloco_controlado:dificuldade={bloco.difficulty}"
        )

    return bloco_minerado, {
        "nonce_final": bloco_minerado.nonce,
        "difficulty": bloco_minerado.difficulty,
    }


def _minerar_por_capacidade(
    minerador: Miner, bloco: Block
) -> tuple[Block, dict[str, int]]:
    """Minera usando janelas de nonce para respeitar o hash power configurado."""

    nonce_atual = 0
    ciclos = 0
    tentativas_por_ciclo = max(1, minerador.config.nonce_attempts_per_cycle)
    tentativas_estimadas = max(
        tentativas_por_ciclo * 500,
        4 * (16 ** max(bloco.difficulty, 1)),
    )
    max_ciclos = max(500, ceil(tentativas_estimadas / tentativas_por_ciclo))

    while ciclos < max_ciclos:
        bloco_minerado, proximo_nonce = minerador.tentar_minerar_bloco(
            bloco,
            nonce_inicial=nonce_atual,
            quantidade_tentativas=tentativas_por_ciclo,
        )
        ciclos += 1
        if bloco_minerado is not None:
            return bloco_minerado, {
                "ciclos": ciclos,
                "ciclos_maximos": max_ciclos,
                "nonce_final": bloco_minerado.nonce,
                "tentativas_por_ciclo": tentativas_por_ciclo,
                "tentativas_estimadas": tentativas_estimadas,
            }
        nonce_atual = proximo_nonce

    raise RuntimeError(
        f"falha_ao_minerar_ramo_malicioso:dificuldade={bloco.difficulty}:"
        f"tentativas_estimadas={tentativas_estimadas}:tentativas_por_ciclo={tentativas_por_ciclo}"
    )


def _aguardar_condicao(
    predicado,
    *,
    tentativas: int = 12,
    intervalo_segundos: float = 1.0,
) -> bool:
    """Executa polling simples para sincronizacao do cenario."""

    for _ in range(tentativas):
        if predicado():
            return True
        time.sleep(intervalo_segundos)
    return False


def _consultar_rastreabilidade_com_fallback(
    client_primario,
    client_fallback,
    identificador: str,
) -> dict[str, object]:
    """Tenta a consulta no no representativo e cai para o executor local."""

    try:
        return client_primario.consultar_rastreabilidade(identificador)
    except Exception:
        return client_fallback.consultar_rastreabilidade(identificador)


def _atualizar_contexto_baseline(runtime: ScenarioRuntime) -> None:
    """Sincroniza o contexto com o baseline real apos preparar o cluster."""

    snapshot_baseline = capturar_snapshot_cluster(
        runtime.clients,
        runtime.no_local.config.node_id,
    )
    entrada_alvo = obter_entrada(snapshot_baseline, runtime.no_alvo_id)
    runtime.snapshot_inicial = snapshot_baseline
    runtime.contexto.nos_conhecidos = [
        entrada.node for entrada in snapshot_baseline.entradas
    ]
    runtime.contexto.topo_cadeia_antes = (
        entrada_alvo.estado.get("hash_ponta")
        if entrada_alvo and entrada_alvo.estado
        else None
    )
    runtime.contexto.altura_cadeia_antes = (
        entrada_alvo.estado.get("altura_cadeia")
        if entrada_alvo and entrada_alvo.estado
        else None
    )
    runtime.contexto.mempool_antes = (
        entrada_alvo.estado.get("quantidade_mempool")
        if entrada_alvo and entrada_alvo.estado
        else None
    )
    runtime.contexto.snapshot_inicial = snapshot_baseline.para_dict()


def _escolher_no_honesto(runtime: ScenarioRuntime) -> str | None:
    """Escolhe um no secundario para formar a cadeia honesta controlada."""

    ordem_preferida = ["node-alpha", "node-beta", "node-gamma", "node-evil"]
    for node_id in ordem_preferida:
        if node_id == runtime.no_alvo_id:
            continue
        client = runtime.clients.get(node_id)
        if client is None or not client.disponivel:
            continue
        return node_id
    return None


def _restaurar_configuracoes(
    runtime: ScenarioRuntime,
    configuracoes_originais: dict[str, dict[str, object]],
    avisos: list[str],
) -> None:
    """Restaura o runtime dos nos ao final do cenario com melhor esforco."""

    for node_id, configuracao in configuracoes_originais.items():
        client = runtime.clients.get(node_id)
        if client is None or not client.disponivel:
            continue
        try:
            client.atualizar_configuracao_no(
                {
                    "papel_no": configuracao["papel_no"],
                    "perfil_mineracao": configuracao["perfil_mineracao"],
                    "intervalo_ciclo_segundos": configuracao[
                        "intervalo_ciclo_segundos"
                    ],
                    "tentativas_nonce_por_ciclo": configuracao[
                        "tentativas_nonce_por_ciclo"
                    ],
                }
            )
        except Exception as erro:  # pragma: no cover - melhor esforco operacional
            avisos.append(f"Falha ao restaurar configuracao de {node_id}: {erro}")


def _preparar_cluster_controlado(
    runtime: ScenarioRuntime,
    *,
    no_honesto_id: str,
    dificuldade_global_desejada: int,
    configuracoes_originais: dict[str, dict[str, object]],
    requests: list[dict[str, object]],
    responses: list[dict[str, object]],
) -> TestExecutionOutcome | None:
    """Coloca o cluster em um baseline reproduzivel antes do ataque."""

    for node_id, client in runtime.clients.items():
        if not client.disponivel:
            continue
        requests.append(
            {
                "etapa": "preparacao_limpeza_memoria",
                "node_id": node_id,
                "payload": {},
            }
        )
        responses.append(
            {
                "etapa": "preparacao_limpeza_memoria",
                "node_id": node_id,
                "response": client.limpar_memoria(),
            }
        )

    if not _aguardar_condicao(
        lambda: all(
            client.consultar_estado().get("altura_cadeia") == 1
            and client.consultar_estado().get("quantidade_mempool") == 0
            for client in runtime.clients.values()
            if client.disponivel
        ),
        tentativas=20,
        intervalo_segundos=0.5,
    ):
        return TestExecutionOutcome(
            status_execucao="precondicao_nao_atendida",
            teste_aprovado=False,
            resultado_observado="Nem todos os nós retornaram ao estado limpo antes do início do cenário.",
            mensagem_interpretada=(
                "O ataque de 51% precisa começar com o cluster em um baseline conhecido. "
                "Pelo menos um nó não convergiu para gênesis após a limpeza de memória."
            ),
            request_enviada=requests,
            response_recebida=responses,
        )

    for node_id, client in runtime.clients.items():
        if not client.disponivel:
            continue

        configuracao_original = configuracoes_originais.get(node_id)
        if configuracao_original is None:
            continue

        payload_config_no = {
            "papel_no": "controle",
            "perfil_mineracao": "customizado",
            "intervalo_ciclo_segundos": configuracao_original[
                "intervalo_ciclo_segundos"
            ],
            "tentativas_nonce_por_ciclo": configuracao_original[
                "tentativas_nonce_por_ciclo"
            ],
        }
        if node_id == runtime.no_alvo_id:
            payload_config_no = {
                "papel_no": "controle",
                "perfil_mineracao": "attack_51_vantagem",
                "intervalo_ciclo_segundos": 0.2,
                "tentativas_nonce_por_ciclo": 80000,
            }
        elif node_id == no_honesto_id:
            payload_config_no["papel_no"] = "controle"
            payload_config_no["perfil_mineracao"] = "honesto_controlado"
        elif configuracao_original["papel_no"] == "observador":
            payload_config_no["papel_no"] = "observador"
            payload_config_no["perfil_mineracao"] = configuracao_original[
                "perfil_mineracao"
            ]

        requests.append(
            {
                "etapa": "preparacao_configuracao_no",
                "node_id": node_id,
                "payload": payload_config_no,
            }
        )
        responses.append(
            {
                "etapa": "preparacao_configuracao_no",
                "node_id": node_id,
                "response": client.atualizar_configuracao_no(payload_config_no),
            }
        )

        requests.append(
            {
                "etapa": "preparacao_dificuldade_global_local",
                "node_id": node_id,
                "payload": {
                    "dificuldade_global": dificuldade_global_desejada,
                    "propagar_rede": False,
                },
            }
        )
        responses.append(
            {
                "etapa": "preparacao_dificuldade_global_local",
                "node_id": node_id,
                "response": client.atualizar_configuracao_rede(
                    {
                        "dificuldade_global": dificuldade_global_desejada,
                        "propagar_rede": False,
                    }
                ),
            }
        )

    if not _aguardar_condicao(
        lambda: all(
            client.consultar_estado().get("dificuldade_global")
            == dificuldade_global_desejada
            and client.consultar_estado().get("altura_cadeia") == 1
            and client.consultar_estado().get("quantidade_mempool") == 0
            for client in runtime.clients.values()
            if client.disponivel
        ),
        tentativas=20,
        intervalo_segundos=0.5,
    ):
        return TestExecutionOutcome(
            status_execucao="precondicao_nao_atendida",
            teste_aprovado=False,
            resultado_observado="A preparação do cluster não conseguiu alinhar todos os nós na mesma dificuldade global antes do ataque.",
            mensagem_interpretada=(
                "O cenário foi interrompido porque a rede não convergiu para um baseline comum de PoW. "
                "Tente novamente depois de confirmar que todos os nós estão online."
            ),
            request_enviada=requests,
            response_recebida=responses,
            contexto_relevante={
                "dificuldade_global_desejada": dificuldade_global_desejada,
                "estados_detectados": {
                    node_id: client.consultar_estado()
                    for node_id, client in runtime.clients.items()
                    if client.disponivel
                },
            },
        )

    return None


class Ataque51SimuladoScenario:
    """Primeiro cenario oficial do novo módulo de testes."""

    definition = ScenarioDefinition(
        id="attack-51-simulado",
        nome="Ataque de 51% (simulado)",
        descricao=(
            "Simula uma disputa de consenso em que um nó atacante ganha vantagem de "
            "mineração e tenta substituir a história honesta por uma cadeia alternativa "
            "que reutiliza o mesmo insumo em outro produto."
        ),
        categoria="consenso",
        severidade="critica",
        objetivo=(
            "Demonstrar, de forma visual e controlada, quando um atacante com maior "
            "hash power simulado consegue provocar fork, reorganização e mudança de "
            "rastreabilidade sem alterar a dificuldade global do PoW."
        ),
        precondicoes=[
            "O nó atacante selecionado deve estar online e acessível para executar o cenário.",
            "Pelo menos um segundo nó honesto precisa estar online para formar a cadeia honesta inicial.",
            "O cluster deve aceitar ajustes dinâmicos de papel, hash power e dificuldade global.",
            "Para demonstração reproduzível, use dificuldade global até 5 nesta versão do cenário.",
        ],
        comportamento_esperado=[
            "O teste deve criar uma história honesta e uma história maliciosa concorrente a partir do mesmo insumo.",
            "Se o atacante acumular trabalho suficiente, a cadeia maliciosa deve sobrepor a cadeia honesta na rede.",
            "O resultado final deve deixar claro se houve fork, reorg, vitória do atacante e mudança observável de rastreabilidade.",
        ],
        impactos_execucao=[
            "O cenário limpa a memória em todos os nós antes de começar para garantir um baseline reproduzível.",
            "A cadeia atual do cluster é descartada durante a preparação do teste.",
        ],
        requires_node_selection=True,
        node_selection_label="Nó atacante",
        node_selection_help=(
            "Escolha o nó que assumirá o papel de atacante durante o teste. "
            "Ele receberá a vantagem de mineração e construirá a cadeia maliciosa."
        ),
        input_fields=[],
        show_blockchain_impact=True,
        show_request_response=True,
        show_context=True,
        default_target_node_id="node-evil",
        tags=["consenso", "fork", "reorganizacao", "attack-51"],
    )

    def execute(
        self,
        runtime: ScenarioRuntime,
        payload: dict[str, object] | None = None,
    ) -> TestExecutionOutcome:
        """Executa o ataque de 51% de forma controlada e reproduzivel."""

        payload = payload or {}
        requests: list[dict[str, object]] = []
        responses: list[dict[str, object]] = []
        avisos_restauracao: list[str] = []

        if runtime.no_alvo_id != runtime.no_local.config.node_id:
            return TestExecutionOutcome(
                status_execucao="precondicao_nao_atendida",
                teste_aprovado=False,
                resultado_observado="O cenário foi chamado em um nó diferente do nó alvo informado.",
                mensagem_interpretada=(
                    "Execute o cenário diretamente no nó escolhido como atacante. "
                    "A implementação precisa acessar a blockchain local do nó alvo "
                    "para construir a cadeia alternativa controlada."
                ),
                request_enviada=requests,
                response_recebida=responses,
                contexto_relevante={
                    "motivo": "no_alvo_diferente_do_executor",
                    "no_executor_id": runtime.no_local.config.node_id,
                    "no_alvo_id": runtime.no_alvo_id,
                },
            )

        no_honesto_id = _escolher_no_honesto(runtime)
        if no_honesto_id is None:
            return TestExecutionOutcome(
                status_execucao="precondicao_nao_atendida",
                teste_aprovado=False,
                resultado_observado="Nenhum nó honesto adicional estava disponível para o cenário.",
                mensagem_interpretada=(
                    "O ataque de 51% precisa de pelo menos dois nós online: um atacante "
                    "e um nó honesto para produzir a cadeia legítima inicial."
                ),
                request_enviada=requests,
                response_recebida=responses,
            )

        no_honesto = runtime.obter_client(no_honesto_id)
        no_executor = runtime.obter_client(runtime.no_alvo_id)
        snapshot_inicial = runtime.snapshot_inicial
        estados_iniciais = {
            entrada.node.node_id: entrada.estado
            for entrada in snapshot_inicial.entradas
            if entrada.estado is not None
        }
        configuracoes_originais = {
            node_id: {
                "papel_no": estado.get("papel_no", "controle"),
                "perfil_mineracao": estado.get("capacidade_mineracao", {}).get(
                    "perfil",
                    "padrao",
                ),
                "intervalo_ciclo_segundos": estado.get("capacidade_mineracao", {}).get(
                    "intervalo_ciclo_segundos",
                    2.0,
                ),
                "tentativas_nonce_por_ciclo": estado.get(
                    "capacidade_mineracao", {}
                ).get(
                    "tentativas_nonce_por_ciclo",
                    10000,
                ),
            }
            for node_id, estado in estados_iniciais.items()
        }
        dificuldade_global_desejada = int(
            estados_iniciais.get(runtime.no_alvo_id, {}).get("dificuldade_global", 4)
        )

        if dificuldade_global_desejada > MAX_DIFICULDADE_DEMONSTRACAO_51:
            return TestExecutionOutcome(
                status_execucao="precondicao_nao_atendida",
                teste_aprovado=False,
                resultado_observado=(
                    "A dificuldade global selecionada excede o limite seguro para uma demonstração reproduzível do ataque de 51%."
                ),
                mensagem_interpretada=(
                    "Para manter o cenário didático e confiável, o ataque de 51% simulado atualmente deve ser executado com "
                    f"dificuldade global até {MAX_DIFICULDADE_DEMONSTRACAO_51}. Reduza a dificuldade e tente novamente."
                ),
                request_enviada=requests,
                response_recebida=responses,
                contexto_relevante={
                    "dificuldade_global_atual": dificuldade_global_desejada,
                    "dificuldade_maxima_recomendada": MAX_DIFICULDADE_DEMONSTRACAO_51,
                },
            )

        seed = uuid4().hex[:8]
        evento_raiz = _evento_materia_prima(seed)
        evento_honesto = _evento_produto_honesto(str(evento_raiz["event_id"]), seed)
        evento_malicioso = _evento_produto_malicioso(str(evento_raiz["event_id"]), seed)
        evento_extensao = _evento_extensao_maliciosa(
            str(evento_malicioso["event_id"]),
            seed,
        )

        runtime.contexto.insumo_alvo = {
            "event_id": evento_raiz["event_id"],
            "product_id": evento_raiz["product_id"],
            "lot_id": evento_raiz["metadata"]["lot_id"],
        }
        runtime.contexto.produto_honesto = {
            "event_id": evento_honesto["event_id"],
            "product_id": evento_honesto["product_id"],
            "lot_id": evento_honesto["metadata"]["lot_id"],
        }
        runtime.contexto.produto_malicioso = {
            "event_id": evento_malicioso["event_id"],
            "product_id": evento_malicioso["product_id"],
            "lot_id": evento_malicioso["metadata"]["lot_id"],
        }

        evento_raiz_modelo = SupplyChainEvent.de_dict(evento_raiz)
        evento_honesto_modelo = SupplyChainEvent.de_dict(evento_honesto)
        evento_malicioso_modelo = SupplyChainEvent.de_dict(evento_malicioso)
        evento_extensao_modelo = SupplyChainEvent.de_dict(evento_extensao)
        if any(
            evento is None
            for evento in [
                evento_raiz_modelo,
                evento_honesto_modelo,
                evento_malicioso_modelo,
                evento_extensao_modelo,
            ]
        ):
            raise RuntimeError("falha_modelagem_eventos_teste")

        try:
            resultado_preparacao = _preparar_cluster_controlado(
                runtime,
                no_honesto_id=no_honesto_id,
                dificuldade_global_desejada=dificuldade_global_desejada,
                configuracoes_originais=configuracoes_originais,
                requests=requests,
                responses=responses,
            )
            if resultado_preparacao is not None:
                return resultado_preparacao

            _atualizar_contexto_baseline(runtime)

            minerador_honesto = Miner(config=runtime.no_local.config)
            dificuldade_honesta = (
                runtime.no_local.blockchain.obter_dificuldade_global_ativa()
            )

            bloco_honesto_raw = _criar_bloco_fork(
                runtime.no_local.blockchain.obter_ultimo_bloco(),
                dificuldade_honesta,
                [evento_raiz_modelo],
                no_honesto_id,
            )
            bloco_honesto_raw, metricas_bloco_honesto_raw = _minerar_bloco_controlado(
                minerador_honesto,
                bloco_honesto_raw,
            )
            add_bloco_honesto_raw = runtime.no_local.blockchain.adicionar_bloco(
                bloco_honesto_raw
            )
            runtime.no_local.produtor.publicar_bloco(bloco_honesto_raw)

            requests.append(
                {
                    "etapa": "cadeia_honesta_bloco_1",
                    "node_id": no_honesto_id,
                    "payload": {
                        "evento": evento_raiz,
                        "dificuldade_global": dificuldade_honesta,
                    },
                }
            )
            responses.append(
                {
                    "etapa": "cadeia_honesta_bloco_1",
                    "node_id": no_honesto_id,
                    "response": {
                        "bloco": bloco_honesto_raw.para_dict(),
                        "adicionado_localmente": add_bloco_honesto_raw,
                        "metricas_mineracao": metricas_bloco_honesto_raw,
                    },
                }
            )

            bloco_honesto_produto = _criar_bloco_fork(
                bloco_honesto_raw,
                runtime.no_local.blockchain.obter_dificuldade_global_ativa(),
                [evento_honesto_modelo],
                no_honesto_id,
            )
            bloco_honesto_produto, metricas_bloco_honesto_produto = (
                _minerar_bloco_controlado(
                    minerador_honesto,
                    bloco_honesto_produto,
                )
            )
            add_bloco_honesto_produto = runtime.no_local.blockchain.adicionar_bloco(
                bloco_honesto_produto
            )
            runtime.no_local.produtor.publicar_bloco(bloco_honesto_produto)

            requests.append(
                {
                    "etapa": "cadeia_honesta_bloco_2",
                    "node_id": no_honesto_id,
                    "payload": {
                        "evento": evento_honesto,
                        "bloco_pai_hash": bloco_honesto_raw.block_hash,
                        "dificuldade_global": bloco_honesto_produto.difficulty,
                    },
                }
            )
            responses.append(
                {
                    "etapa": "cadeia_honesta_bloco_2",
                    "node_id": no_honesto_id,
                    "response": {
                        "bloco": bloco_honesto_produto.para_dict(),
                        "adicionado_localmente": add_bloco_honesto_produto,
                        "metricas_mineracao": metricas_bloco_honesto_produto,
                    },
                }
            )

            snapshot_honesto = capturar_snapshot_cluster(
                runtime.clients,
                runtime.no_local.config.node_id,
            )
            runtime.contexto.itens_confirmados_relevantes = {
                "insumo_alvo": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_honesto,
                        str(evento_raiz["event_id"]),
                    )
                },
                "produto_honesto": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_honesto,
                        str(evento_honesto["event_id"]),
                    )
                },
                "produto_malicioso": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_honesto,
                        str(evento_malicioso["event_id"]),
                    )
                },
            }

            rastreabilidade_inicial = {
                "produto_honesto": _consultar_rastreabilidade_com_fallback(
                    no_honesto,
                    no_executor,
                    str(evento_honesto["product_id"]),
                ),
                "produto_malicioso": _consultar_rastreabilidade_com_fallback(
                    no_honesto,
                    no_executor,
                    str(evento_malicioso["product_id"]),
                ),
            }

            cadeia_local = runtime.no_local.blockchain.copiar_cadeia()
            bloco_ancora = next(
                (
                    bloco
                    for bloco in cadeia_local
                    if any(
                        evento.event_id == str(evento_raiz["event_id"])
                        for evento in bloco.events
                    )
                ),
                None,
            )
            if bloco_ancora is None:
                raise RuntimeError("bloco_ancora_nao_encontrado")

            minerador_local = Miner(config=runtime.no_local.config)
            dificuldade_fork = (
                runtime.no_local.blockchain.obter_dificuldade_global_para_cadeia(
                    cadeia_local[: bloco_ancora.index + 1]
                )
            )

            bloco_malicioso = _criar_bloco_fork(
                bloco_ancora,
                dificuldade_fork,
                [evento_malicioso_modelo],
                runtime.no_alvo_id,
            )
            bloco_malicioso, metricas_bloco_malicioso = _minerar_por_capacidade(
                minerador_local,
                bloco_malicioso,
            )
            add_bloco_malicioso = runtime.no_local.blockchain.adicionar_bloco(
                bloco_malicioso
            )
            runtime.no_local.produtor.publicar_bloco(bloco_malicioso)

            bloco_extensao = _criar_bloco_fork(
                bloco_malicioso,
                runtime.no_local.blockchain.obter_dificuldade_global_para_cadeia(
                    cadeia_local[: bloco_ancora.index + 1] + [bloco_malicioso]
                ),
                [evento_extensao_modelo],
                runtime.no_alvo_id,
            )
            bloco_extensao, metricas_bloco_extensao = _minerar_por_capacidade(
                minerador_local,
                bloco_extensao,
            )
            add_bloco_extensao = runtime.no_local.blockchain.adicionar_bloco(
                bloco_extensao
            )
            runtime.no_local.produtor.publicar_bloco(bloco_extensao)

            runtime.no_local.monitor_rede.registrar_atividade(
                "attack_51_simulado",
                (
                    f"Ramo malicioso publicado por {runtime.no_alvo_id} com blocos "
                    f"#{bloco_malicioso.index} e #{bloco_extensao.index}."
                ),
                "warning",
                runtime.no_alvo_id,
                hash_relacionado=bloco_extensao.block_hash,
            )

            requests.extend(
                [
                    {
                        "etapa": "ramo_malicioso_bloco_1",
                        "node_id": runtime.no_alvo_id,
                        "payload": {
                            "evento": evento_malicioso,
                            "bloco_ancora_hash": bloco_ancora.block_hash,
                            "dificuldade_global": dificuldade_fork,
                        },
                    },
                    {
                        "etapa": "ramo_malicioso_bloco_2",
                        "node_id": runtime.no_alvo_id,
                        "payload": {
                            "evento": evento_extensao,
                            "bloco_pai_hash": bloco_malicioso.block_hash,
                            "dificuldade_global": bloco_extensao.difficulty,
                        },
                    },
                ]
            )
            responses.extend(
                [
                    {
                        "etapa": "ramo_malicioso_bloco_1",
                        "node_id": runtime.no_alvo_id,
                        "response": {
                            "bloco": bloco_malicioso.para_dict(),
                            "adicionado_localmente": add_bloco_malicioso,
                            "metricas_mineracao": metricas_bloco_malicioso,
                        },
                    },
                    {
                        "etapa": "ramo_malicioso_bloco_2",
                        "node_id": runtime.no_alvo_id,
                        "response": {
                            "bloco": bloco_extensao.para_dict(),
                            "adicionado_localmente": add_bloco_extensao,
                            "metricas_mineracao": metricas_bloco_extensao,
                        },
                    },
                ]
            )

            if not _aguardar_condicao(
                lambda: no_honesto.consultar_estado().get("altura_cadeia", 0) >= 4,
                tentativas=10,
                intervalo_segundos=0.5,
            ):
                avisos_restauracao.append(
                    "Rede honesta nao refletiu toda a reorganizacao dentro da janela curta de observacao."
                )

            snapshot_final = capturar_snapshot_cluster(
                runtime.clients,
                runtime.no_local.config.node_id,
            )
            rastreabilidade_final = {
                "produto_honesto": _consultar_rastreabilidade_com_fallback(
                    no_honesto,
                    no_executor,
                    str(evento_honesto["product_id"]),
                ),
                "produto_malicioso": _consultar_rastreabilidade_com_fallback(
                    no_honesto,
                    no_executor,
                    str(evento_malicioso["product_id"]),
                ),
            }

            nos_com_produto_honesto = localizar_evento_confirmado(
                snapshot_final,
                str(evento_honesto["event_id"]),
            )
            nos_com_produto_malicioso = localizar_evento_confirmado(
                snapshot_final,
                str(evento_malicioso["event_id"]),
            )
            cadeia_maliciosa_venceu = bool(nos_com_produto_malicioso) and not bool(
                nos_com_produto_honesto
            )

            impacto = resumir_impacto_blockchain(
                snapshot_honesto,
                snapshot_final,
                no_honesto_id,
                eventos_monitorados={
                    "insumo_alvo": str(evento_raiz["event_id"]),
                    "produto_honesto": str(evento_honesto["event_id"]),
                    "produto_malicioso": str(evento_malicioso["event_id"]),
                    "extensao_maliciosa": str(evento_extensao["event_id"]),
                },
            )
            impacto.update(
                {
                    "cadeia_vencedora": (
                        "maliciosa"
                        if cadeia_maliciosa_venceu
                        else "honesta_ou_indefinida"
                    ),
                    "nos_com_produto_honesto": nos_com_produto_honesto,
                    "nos_com_produto_malicioso": nos_com_produto_malicioso,
                    "rastreabilidade_inicial": rastreabilidade_inicial,
                    "rastreabilidade_final": rastreabilidade_final,
                    "houve_mudanca_rastreabilidade": (
                        rastreabilidade_inicial["produto_honesto"]
                        .get("estado_atual", {})
                        .get("status")
                        != rastreabilidade_final["produto_honesto"]
                        .get("estado_atual", {})
                        .get("status")
                        or rastreabilidade_inicial["produto_malicioso"]
                        .get("estado_atual", {})
                        .get("status")
                        != rastreabilidade_final["produto_malicioso"]
                        .get("estado_atual", {})
                        .get("status")
                    ),
                }
            )

            resultado_observado = (
                "A cadeia maliciosa ultrapassou a cadeia honesta e passou a carregar "
                "o produto alternativo confirmado na rede."
                if cadeia_maliciosa_venceu
                else "O fork foi criado, mas a cadeia honesta permaneceu ativa ao final da observação."
            )
            mensagem_interpretada = (
                "Ataque simulado bem-sucedido: houve fork válido e a cadeia maliciosa "
                "venceu a disputa após acumular mais trabalho."
                if cadeia_maliciosa_venceu
                else "Ataque simulado executado, mas a cadeia maliciosa não venceu no estado final observado."
            )
            if avisos_restauracao:
                mensagem_interpretada = f"{mensagem_interpretada} Avisos de restauração: {' | '.join(avisos_restauracao)}"

            return TestExecutionOutcome(
                status_execucao="concluido",
                teste_aprovado=cadeia_maliciosa_venceu,
                resultado_observado=resultado_observado,
                mensagem_interpretada=mensagem_interpretada,
                request_enviada=requests,
                response_recebida=responses,
                impacto_blockchain=impacto,
                contexto_relevante={
                    "no_honesto_id": no_honesto_id,
                    "no_atacante_id": runtime.no_alvo_id,
                    "vantagem_hash_power": {
                        "intervalo_ciclo_segundos": 0.2,
                        "tentativas_nonce_por_ciclo": 80000,
                    },
                    "pow_global_durante_teste": dificuldade_global_desejada,
                    "cadeia_honesta_inicial": snapshot_honesto.para_dict(),
                    "bloco_ancora_hash": bloco_ancora.block_hash,
                    "avisos_restauracao": avisos_restauracao,
                },
                snapshot_final=snapshot_final.para_dict(),
            )
        except Exception as erro:
            return TestExecutionOutcome(
                status_execucao="erro_tecnico",
                teste_aprovado=False,
                resultado_observado="A simulação foi interrompida por uma falha operacional no backend.",
                mensagem_interpretada=(
                    "O backend não conseguiu concluir o cenário de ataque de 51%. "
                    "A infraestrutura de teste foi acionada, mas a execução terminou com erro técnico."
                ),
                request_enviada=requests,
                response_recebida=responses,
                erro_tecnico={"mensagem": str(erro)},
                contexto_relevante={"avisos_restauracao": avisos_restauracao},
            )
        finally:
            _restaurar_configuracoes(
                runtime,
                configuracoes_originais,
                avisos_restauracao,
            )
