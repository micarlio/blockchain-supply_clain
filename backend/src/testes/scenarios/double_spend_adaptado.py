"""Cenario de double spend adaptado ao dominio de supply chain.

Neste sistema, double spend significa tentar consumir duas vezes o mesmo insumo
em eventos de fabricacao distintos. O problema aqui e semantico: a regra de
dominio deve impedir a segunda utilizacao antes que isso vire uma disputa de
consenso ou um fork entre cadeias.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from src.core.services.miner import Miner
from src.testes.models import ScenarioDefinition, TestExecutionOutcome
from src.testes.utils.blockchain_snapshot import (
    capturar_snapshot_cluster,
    localizar_evento_confirmado,
    obter_entrada,
    resumir_impacto_blockchain,
)
from src.testes.utils.context_builder import ScenarioRuntime


def _timestamp_utc_atual() -> str:
    """Retorna o horario atual em UTC no formato padrao do projeto."""

    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _gerar_identificador(prefixo: str, seed: str, sufixo: str) -> str:
    """Monta ids legiveis para os artefatos do cenario."""

    return f"{prefixo}-{seed}-{sufixo}"


def _payload_materia_prima(seed: str) -> dict[str, object]:
    """Cria o insumo base do cenario de reutilizacao."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-DS", seed, "RAW"),
        "event_type": "CADASTRAR_MATERIA_PRIMA",
        "entity_kind": "raw_material",
        "product_id": _gerar_identificador("RAW", seed, "LOTE"),
        "product_name": "Insumo com consumo unico",
        "actor_id": "FORNECEDOR-DS-CNPJ",
        "actor_role": "FORNECEDOR",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "RAW"),
            "scenario": "double-spend-adaptado",
        },
    }


def _payload_produto_legitimo(raw_event_id: str, seed: str) -> dict[str, object]:
    """Cria o primeiro uso valido do insumo."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-DS", seed, "LEGITIMO"),
        "event_type": "FABRICAR_PRODUTO_SIMPLES",
        "entity_kind": "simple_product",
        "product_id": _gerar_identificador("PROD", seed, "LEGITIMO"),
        "product_name": "Produto legitimo do cenário",
        "actor_id": "FABRICANTE-DS-CNPJ",
        "actor_role": "FABRICANTE",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [raw_event_id],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "LEGITIMO"),
            "scenario": "double-spend-adaptado",
        },
    }


def _payload_produto_concorrente(raw_event_id: str, seed: str) -> dict[str, object]:
    """Cria a tentativa invalida de reutilizar o mesmo insumo."""

    return {
        "event_id": _gerar_identificador("EVT-TESTE-DS", seed, "CONCORRENTE"),
        "event_type": "FABRICAR_PRODUTO_SIMPLES",
        "entity_kind": "simple_product",
        "product_id": _gerar_identificador("PROD", seed, "CONCORRENTE"),
        "product_name": "Produto concorrente inválido",
        "actor_id": "FABRICANTE-DS-CNPJ-2",
        "actor_role": "FABRICANTE",
        "timestamp": _timestamp_utc_atual(),
        "input_ids": [raw_event_id],
        "metadata": {
            "lot_id": _gerar_identificador("LOT", seed, "CONCORRENTE"),
            "scenario": "double-spend-adaptado",
        },
    }


def _atualizar_contexto_pre_tentativa(runtime: ScenarioRuntime, snapshot) -> None:
    """Atualiza o contexto para refletir o estado imediatamente antes da invalida."""

    entrada_alvo = obter_entrada(snapshot, runtime.no_alvo_id)
    runtime.snapshot_inicial = snapshot
    runtime.contexto.nos_conhecidos = [entrada.node for entrada in snapshot.entradas]
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
    runtime.contexto.snapshot_inicial = snapshot.para_dict()


class DoubleSpendAdaptadoScenario:
    """Segundo cenário oficial do novo módulo de testes."""

    definition = ScenarioDefinition(
        id="double-spend-adaptado",
        nome="Double spend adaptado ao supply chain",
        descricao=(
            "Demonstra o equivalente ao double spend no domínio da aplicação: "
            "tentar consumir duas vezes o mesmo input_id em fabricações incompatíveis."
        ),
        categoria="validacao_dominio",
        severidade="alta",
        objetivo=(
            "Mostrar que a regra de consumo único de insumos impede a reutilização "
            "semântica inválida antes que isso se torne um problema de consenso."
        ),
        precondicoes=[
            "O nó selecionado deve estar online e acessível para executar a validação.",
            "O cenário precisa conseguir minerar um bloco local para confirmar o primeiro uso legítimo do insumo.",
            "A mempool do nó selecionado será limpa no início para evitar interferência de eventos pendentes não relacionados.",
        ],
        comportamento_esperado=[
            "O teste deve confirmar o primeiro uso legítimo do insumo em um bloco válido.",
            "A segunda fabricação com o mesmo input_id deve ser rejeitada pelo domínio como reutilização inválida.",
            "Após a tentativa inválida, a cadeia, a mempool e a associação do insumo com o produto legítimo devem permanecer consistentes.",
        ],
        impactos_execucao=[
            "O cenário ajusta temporariamente o nó selecionado para modo controle manual.",
            "A mempool do nó selecionado é limpa antes da preparação do caso para evitar interferência externa.",
            "O cenário adiciona um bloco válido local ao nó selecionado para confirmar o primeiro uso legítimo do insumo.",
        ],
        requires_node_selection=True,
        node_selection_label="Nó de validação",
        node_selection_help=(
            "Escolha o nó onde a regra de consumo único de insumos será validada. "
            "Neste cenário não há disputa de consenso; a segunda utilização deve ser bloqueada localmente."
        ),
        input_fields=[],
        show_blockchain_impact=True,
        show_request_response=True,
        show_context=True,
        default_target_node_id="node-beta",
        tags=["validacao_dominio", "seguranca", "double-spend", "input-unico"],
    )

    def execute(
        self,
        runtime: ScenarioRuntime,
        payload: dict[str, object] | None = None,
    ) -> TestExecutionOutcome:
        """Executa o double spend adaptado no nó selecionado."""

        payload = payload or {}
        requests: list[dict[str, object]] = []
        responses: list[dict[str, object]] = []

        if runtime.no_alvo_id != runtime.no_local.config.node_id:
            return TestExecutionOutcome(
                status_execucao="precondicao_nao_atendida",
                teste_aprovado=False,
                resultado_observado="O cenário foi chamado em um nó diferente do nó selecionado para validação.",
                mensagem_interpretada=(
                    "Execute o teste diretamente no nó onde você quer validar a regra de consumo único do insumo."
                ),
                request_enviada=requests,
                response_recebida=responses,
                contexto_relevante={
                    "motivo": "no_alvo_diferente_do_executor",
                    "no_executor_id": runtime.no_local.config.node_id,
                    "no_alvo_id": runtime.no_alvo_id,
                },
            )

        no_alvo = runtime.obter_client(runtime.no_alvo_id)
        snapshot_runtime = runtime.snapshot_inicial
        entrada_alvo_inicial = obter_entrada(snapshot_runtime, runtime.no_alvo_id)
        estado_inicial = entrada_alvo_inicial.estado if entrada_alvo_inicial else None

        configuracao_original = {
            "papel_no": (estado_inicial or {}).get("papel_no", "controle"),
            "perfil_mineracao": (estado_inicial or {})
            .get("capacidade_mineracao", {})
            .get(
                "perfil",
                "padrao",
            ),
            "intervalo_ciclo_segundos": (estado_inicial or {})
            .get(
                "capacidade_mineracao",
                {},
            )
            .get("intervalo_ciclo_segundos", 2.0),
            "tentativas_nonce_por_ciclo": (estado_inicial or {})
            .get(
                "capacidade_mineracao",
                {},
            )
            .get("tentativas_nonce_por_ciclo", 10000),
        }

        seed = uuid4().hex[:8]
        payload_raw = _payload_materia_prima(seed)
        payload_legitimo = _payload_produto_legitimo(str(payload_raw["event_id"]), seed)
        payload_concorrente = _payload_produto_concorrente(
            str(payload_raw["event_id"]),
            seed,
        )

        runtime.contexto.insumo_alvo = {
            "event_id": payload_raw["event_id"],
            "product_id": payload_raw["product_id"],
            "lot_id": payload_raw["metadata"]["lot_id"],
        }
        runtime.contexto.produto_honesto = {
            "event_id": payload_legitimo["event_id"],
            "product_id": payload_legitimo["product_id"],
            "lot_id": payload_legitimo["metadata"]["lot_id"],
        }
        runtime.contexto.produto_malicioso = {
            "event_id": payload_concorrente["event_id"],
            "product_id": payload_concorrente["product_id"],
            "lot_id": payload_concorrente["metadata"]["lot_id"],
        }

        try:
            requests.append(
                {
                    "etapa": "preparacao_configuracao_no",
                    "node_id": runtime.no_alvo_id,
                    "payload": {
                        "papel_no": "controle",
                        "perfil_mineracao": "validacao_double_spend",
                        "intervalo_ciclo_segundos": configuracao_original[
                            "intervalo_ciclo_segundos"
                        ],
                        "tentativas_nonce_por_ciclo": configuracao_original[
                            "tentativas_nonce_por_ciclo"
                        ],
                    },
                }
            )
            responses.append(
                {
                    "etapa": "preparacao_configuracao_no",
                    "node_id": runtime.no_alvo_id,
                    "response": no_alvo.atualizar_configuracao_no(
                        {
                            "papel_no": "controle",
                            "perfil_mineracao": "validacao_double_spend",
                            "intervalo_ciclo_segundos": configuracao_original[
                                "intervalo_ciclo_segundos"
                            ],
                            "tentativas_nonce_por_ciclo": configuracao_original[
                                "tentativas_nonce_por_ciclo"
                            ],
                        }
                    ),
                }
            )

            with runtime.no_local.trava:
                runtime.no_local.mempool.limpar()
                runtime.no_local.produtor.reset_automatic_mining_state()

            requests.extend(
                [
                    {
                        "etapa": "preparacao_evento_legitimo_insumo",
                        "node_id": runtime.no_alvo_id,
                        "payload": payload_raw,
                    },
                    {
                        "etapa": "preparacao_evento_legitimo_fabricacao",
                        "node_id": runtime.no_alvo_id,
                        "payload": payload_legitimo,
                    },
                ]
            )

            resposta_raw = no_alvo.postar_evento(payload_raw, propagar_rede=False)
            resposta_legitimo = no_alvo.postar_evento(
                payload_legitimo,
                propagar_rede=False,
            )
            responses.extend(
                [
                    {
                        "etapa": "preparacao_evento_legitimo_insumo",
                        "node_id": runtime.no_alvo_id,
                        "response": resposta_raw,
                    },
                    {
                        "etapa": "preparacao_evento_legitimo_fabricacao",
                        "node_id": runtime.no_alvo_id,
                        "response": resposta_legitimo,
                    },
                ]
            )

            if resposta_raw.get("status") != "evento_adicionado":
                raise RuntimeError("falha_preparacao_insumo_legitimo")
            if resposta_legitimo.get("status") != "evento_adicionado":
                raise RuntimeError("falha_preparacao_produto_legitimo")

            with runtime.no_local.trava:
                minerador = Miner(config=runtime.no_local.config)
                bloco_legitimo = minerador.minerar_da_mempool(
                    runtime.no_local.blockchain,
                    runtime.no_local.mempool,
                )
            if bloco_legitimo is None:
                raise RuntimeError("falha_ao_confirmar_uso_legitimo_do_insumo")

            responses.append(
                {
                    "etapa": "mineracao_legitima",
                    "node_id": runtime.no_alvo_id,
                    "response": {
                        "status": "bloco_minerado",
                        "bloco": bloco_legitimo.para_dict(),
                    },
                }
            )

            snapshot_pre_tentativa = capturar_snapshot_cluster(
                runtime.clients,
                runtime.no_local.config.node_id,
            )
            _atualizar_contexto_pre_tentativa(runtime, snapshot_pre_tentativa)

            runtime.contexto.itens_confirmados_relevantes = {
                "insumo_alvo": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_pre_tentativa,
                        str(payload_raw["event_id"]),
                    )
                },
                "produto_legitimo": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_pre_tentativa,
                        str(payload_legitimo["event_id"]),
                    )
                },
                "produto_concorrente": {
                    "confirmado_em": localizar_evento_confirmado(
                        snapshot_pre_tentativa,
                        str(payload_concorrente["event_id"]),
                    )
                },
            }

            rastreabilidade_antes = {
                "insumo": no_alvo.consultar_rastreabilidade(
                    str(payload_raw["product_id"])
                ),
                "produto_legitimo": no_alvo.consultar_rastreabilidade(
                    str(payload_legitimo["product_id"])
                ),
                "produto_concorrente": no_alvo.consultar_rastreabilidade(
                    str(payload_concorrente["product_id"])
                ),
            }

            entrada_pre = obter_entrada(snapshot_pre_tentativa, runtime.no_alvo_id)
            altura_antes = (
                entrada_pre.estado.get("altura_cadeia")
                if entrada_pre and entrada_pre.estado
                else None
            )
            hash_antes = (
                entrada_pre.estado.get("hash_ponta")
                if entrada_pre and entrada_pre.estado
                else None
            )
            mempool_antes = (
                entrada_pre.mempool.get("quantidade")
                if entrada_pre and entrada_pre.mempool
                else None
            )

            requests.append(
                {
                    "etapa": "tentativa_reutilizacao_invalida",
                    "node_id": runtime.no_alvo_id,
                    "payload": payload_concorrente,
                }
            )
            resposta_concorrente = no_alvo.postar_evento(
                payload_concorrente,
                propagar_rede=False,
            )
            responses.append(
                {
                    "etapa": "tentativa_reutilizacao_invalida",
                    "node_id": runtime.no_alvo_id,
                    "response": {
                        "http_status_equivalente": (
                            200
                            if resposta_concorrente.get("status") == "evento_adicionado"
                            else 400
                        ),
                        **resposta_concorrente,
                    },
                }
            )

            snapshot_final = capturar_snapshot_cluster(
                runtime.clients,
                runtime.no_local.config.node_id,
            )
            entrada_final = obter_entrada(snapshot_final, runtime.no_alvo_id)
            altura_depois = (
                entrada_final.estado.get("altura_cadeia")
                if entrada_final and entrada_final.estado
                else None
            )
            hash_depois = (
                entrada_final.estado.get("hash_ponta")
                if entrada_final and entrada_final.estado
                else None
            )
            mempool_depois = (
                entrada_final.mempool.get("quantidade")
                if entrada_final and entrada_final.mempool
                else None
            )

            rastreabilidade_depois = {
                "insumo": no_alvo.consultar_rastreabilidade(
                    str(payload_raw["product_id"])
                ),
                "produto_legitimo": no_alvo.consultar_rastreabilidade(
                    str(payload_legitimo["product_id"])
                ),
                "produto_concorrente": no_alvo.consultar_rastreabilidade(
                    str(payload_concorrente["product_id"])
                ),
            }

            cadeia_inalterada = (
                altura_antes == altura_depois and hash_antes == hash_depois
            )
            mempool_inalterada = mempool_antes == mempool_depois
            produto_legitimo_confirmado = bool(
                localizar_evento_confirmado(
                    snapshot_final,
                    str(payload_legitimo["event_id"]),
                )
            )
            produto_concorrente_confirmado = bool(
                localizar_evento_confirmado(
                    snapshot_final,
                    str(payload_concorrente["event_id"]),
                )
            )
            produto_concorrente_em_mempool = bool(
                entrada_final
                and isinstance(entrada_final.mempool, dict)
                and any(
                    isinstance(evento, dict)
                    and evento.get("event_id") == payload_concorrente["event_id"]
                    for evento in entrada_final.mempool.get("eventos", [])
                )
            )

            rejeitado_como_esperado = (
                resposta_concorrente.get("status") == "evento_rejeitado"
                and resposta_concorrente.get("motivo") == "input_id_ja_consumido"
            )
            teste_aprovado = (
                rejeitado_como_esperado
                and cadeia_inalterada
                and mempool_inalterada
                and produto_legitimo_confirmado
                and not produto_concorrente_confirmado
                and not produto_concorrente_em_mempool
            )

            impacto = resumir_impacto_blockchain(
                snapshot_pre_tentativa,
                snapshot_final,
                runtime.no_alvo_id,
                eventos_monitorados={
                    "insumo_alvo": str(payload_raw["event_id"]),
                    "produto_legitimo": str(payload_legitimo["event_id"]),
                    "produto_concorrente": str(payload_concorrente["event_id"]),
                },
            )
            impacto.update(
                {
                    "altura_cadeia_antes_tentativa_invalida": altura_antes,
                    "altura_cadeia_depois_tentativa_invalida": altura_depois,
                    "hash_topo_antes_tentativa_invalida": hash_antes,
                    "hash_topo_depois_tentativa_invalida": hash_depois,
                    "mempool_antes_tentativa_invalida": mempool_antes,
                    "mempool_depois_tentativa_invalida": mempool_depois,
                    "cadeia_inalterada_apos_tentativa_invalida": cadeia_inalterada,
                    "mempool_inalterada_apos_tentativa_invalida": mempool_inalterada,
                    "produto_legitimo_confirmado": produto_legitimo_confirmado,
                    "produto_concorrente_confirmado": produto_concorrente_confirmado,
                    "produto_concorrente_em_mempool": produto_concorrente_em_mempool,
                    "rastreabilidade_antes": rastreabilidade_antes,
                    "rastreabilidade_depois": rastreabilidade_depois,
                }
            )

            resultado_observado = (
                "O backend rejeitou a segunda fabricação com o mesmo input_id e preservou a associação do insumo com o primeiro uso legítimo."
                if teste_aprovado
                else "A tentativa concorrente não foi bloqueada com as garantias esperadas de cadeia e mempool."
            )
            mensagem_interpretada = (
                "Backend rejeitou como esperado a reutilização do insumo. A regra de consumo único foi preservada."
                if teste_aprovado
                else "O cenário encontrou comportamento inesperado ao tentar reutilizar um insumo já consumido."
            )

            return TestExecutionOutcome(
                status_execucao="concluido",
                teste_aprovado=teste_aprovado,
                resultado_observado=resultado_observado,
                mensagem_interpretada=mensagem_interpretada,
                request_enviada=requests,
                response_recebida=responses,
                impacto_blockchain=impacto,
                contexto_relevante={
                    "no_alvo_id": runtime.no_alvo_id,
                    "insumo_escolhido": runtime.contexto.insumo_alvo,
                    "evento_legitimo_inicial": payload_raw,
                    "produto_legitimo_criado": runtime.contexto.produto_honesto,
                    "produto_concorrente_tentado": runtime.contexto.produto_malicioso,
                    "estado_insumo_antes": rastreabilidade_antes["insumo"],
                    "estado_insumo_depois": rastreabilidade_depois["insumo"],
                    "resposta_validacao": resposta_concorrente,
                },
            )
        except Exception as erro:
            return TestExecutionOutcome(
                status_execucao="erro_tecnico",
                teste_aprovado=False,
                resultado_observado="A simulação foi interrompida por uma falha operacional no backend.",
                mensagem_interpretada=(
                    "O backend não conseguiu concluir o cenário de double spend adaptado."
                ),
                request_enviada=requests,
                response_recebida=responses,
                erro_tecnico={"mensagem": str(erro)},
            )
        finally:
            try:
                no_alvo.atualizar_configuracao_no(
                    {
                        "papel_no": configuracao_original["papel_no"],
                        "perfil_mineracao": configuracao_original["perfil_mineracao"],
                        "intervalo_ciclo_segundos": configuracao_original[
                            "intervalo_ciclo_segundos"
                        ],
                        "tentativas_nonce_por_ciclo": configuracao_original[
                            "tentativas_nonce_por_ciclo"
                        ],
                    }
                )
            except Exception:
                pass
